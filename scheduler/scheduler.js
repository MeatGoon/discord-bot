const fs = require('node:fs');
const path = require('node:path');

const TIMER_PATH = path.join(__dirname, '../timer.json');
const TIMEZONE = 'Asia/Seoul';

const WEEKDAY_MAP = {
    // English
    Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat', Sun: 'sun',
    // Korean
    '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',
};

function loadTimers() {
    try {
        const raw = fs.readFileSync(TIMER_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
        return {};
    }
}

function getKstNowParts() {
    const dtf = new Intl.DateTimeFormat('ko-KR', {
        timeZone: TIMEZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = dtf.formatToParts(new Date());
    const weekdayRaw = parts.find(p => p.type === 'weekday')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;

    const dayKey = WEEKDAY_MAP[weekdayRaw] ?? null;
    const timeKey = `${hour}:${minute}`;

    return { dayKey, timeKey };
}

/**
 * scheduleMap key: `${guildId}|${channelId}|${dayKey}|${timeKey}`
 * value: payload
 */
const scheduleMap = new Map();

function rebuildScheduleFromFile() {
    scheduleMap.clear();
    const timers = loadTimers();

    for (const guildId of Object.keys(timers)) {
        const channelsObj = timers[guildId];
        if (!channelsObj || typeof channelsObj !== 'object') continue;

        for (const channelId of Object.keys(channelsObj)) {
            const channelNode = channelsObj[channelId];
            if (!channelNode || typeof channelNode !== 'object') continue;

            for (const dayKey of Object.keys(channelNode)) {
                const dayNode = channelNode[dayKey];
                if (!dayNode || typeof dayNode !== 'object') continue;

                for (const timeKey of Object.keys(dayNode)) {
                    const payload = dayNode[timeKey];
                    const k = `${guildId}|${channelId}|${dayKey}|${timeKey}`;
                    scheduleMap.set(k, payload);
                }
            }
        }
    }
}

function addSchedule({ guildId, channelId, dayKey, timeKey, payload }) {
    const k = `${guildId}|${channelId}|${dayKey}|${timeKey}`;
    scheduleMap.set(k, payload);
}

function removeSchedule({ guildId, channelId, dayKey, timeKey }) {
    const k = `${guildId}|${channelId}|${dayKey}|${timeKey}`;
    return scheduleMap.delete(k);
}

async function tick(client) {
    const { dayKey, timeKey } = getKstNowParts();
    if (!dayKey) return;

    for (const [k, payload] of scheduleMap.entries()) {
        const [, channelId, d, t] = k.split('|');
        if (d !== dayKey || t !== timeKey) continue;

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel?.isTextBased()) continue;

            const text =
                payload?.message
                    ? `${payload.message}`
                    : `${d} ${t}`;

            await channel.send(text);
        } catch {
        }
    }
}

function startTimerScheduler(client) {
    rebuildScheduleFromFile();

    // 같은 분 중복 발송 방지
    const fired = new Set();

    setInterval(async () => {
        const { dayKey, timeKey } = getKstNowParts();
        if (!dayKey) return;

        const minuteKey = `${dayKey}|${timeKey}`;
        if (fired.has(minuteKey)) return;
        fired.add(minuteKey);
        if (fired.size > 3000) fired.clear();

        await tick(client);
    }, 15_000);
}

module.exports = {
    startTimerScheduler,
    rebuildScheduleFromFile,
    addSchedule,
    removeSchedule,
};
