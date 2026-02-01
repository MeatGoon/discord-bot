const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const { addSchedule, removeSchedule } = require('../scheduler/scheduler');

const TIMER_PATH = path.join(__dirname, '../timer.json');

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_KO_LABEL = {mon: '월', tue: '화', wed: '수', thu: '목', fri: '금', sat: '토',sun: '일',};
const DAY_ALIAS = {
    // 한글 1글자
    '월': 'mon', '화': 'tue', '수': 'wed', '목': 'thu', '금': 'fri', '토': 'sat', '일': 'sun',

    // 한글 풀네임
    '월요일': 'mon', '화요일': 'tue', '수요일': 'wed', '목요일': 'thu',
    '금요일': 'fri', '토요일': 'sat', '일요일': 'sun',

    'mon': 'mon', 'monday': 'mon',
    'tue': 'tue', 'tues': 'tue', 'tuesday': 'tue',
    'wed': 'wed', 'wednesday': 'wed',
    'thu': 'thu', 'thurs': 'thu', 'thursday': 'thu',
    'fri': 'fri', 'friday': 'fri',
    'sat': 'sat', 'saturday': 'sat',
    'sun': 'sun', 'sunday': 'sun',
};

/* ------------------ file io ------------------ */

function loadTimers() {
    try {
        const raw = fs.readFileSync(TIMER_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
        return {};
    }
}

function saveTimers(timers) {
    fs.writeFileSync(TIMER_PATH, JSON.stringify(timers, null, 2), 'utf8');
}

/* ------------------ parsing ------------------ */

function parseAndNormalizeTime(input) {
    const m = /^([0-9]|1[0-9]|2[0-3]):([0-5]\d)$/.exec(String(input).trim());
    if (!m) return null;
    return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function normalizeDayInput(input) {
    const s = String(input).trim().toLowerCase();
    return DAY_ALIAS[s] ?? s;
}

function expandDays(dayInput) {
    const raw = String(dayInput).trim();

    // 단일: mon / 월 / 일요일
    if (!raw.includes('~')) {
        const d = normalizeDayInput(raw);
        return DAY_ORDER.includes(d) ? [d] : null;
    }

    // 범위: mon~fri / 월~금 / 월요일~금요일
    const [startRaw, endRaw] = raw.split('~').map(v => v.trim());
    const start = normalizeDayInput(startRaw);
    const end = normalizeDayInput(endRaw);

    const a = DAY_ORDER.indexOf(start);
    const b = DAY_ORDER.indexOf(end);
    if (a === -1 || b === -1 || a > b) return null;

    return DAY_ORDER.slice(a, b + 1);
}

/* ------------------ data ops ------------------ */

function ensurePath(timers, guildId, channelId) {
    timers[guildId] ??= {};
    timers[guildId][channelId] ??= {};
    return timers[guildId][channelId];
}

function getChannelNode(timers, guildId, channelId) {
    return timers?.[guildId]?.[channelId] ?? null;
}

function setTimer(timers, guildId, channelId, day, time, value) {
    const channelNode = ensurePath(timers, guildId, channelId);
    channelNode[day] ??= {};
    channelNode[day][time] = value;
}

function removeTimer(timers, guildId, channelId, day, time) {
    const channelNode = getChannelNode(timers, guildId, channelId);
    if (!channelNode) return false;

    const dayNode = channelNode[day];
    if (!dayNode || typeof dayNode !== 'object') return false;

    if (!(time in dayNode)) return false;

    delete dayNode[time];

    if (Object.keys(dayNode).length === 0) delete channelNode[day];
    if (Object.keys(channelNode).length === 0) delete timers[guildId][channelId];
    if (timers[guildId] && Object.keys(timers[guildId]).length === 0) delete timers[guildId];

    return true;
}

function listTimersForChannel(timers, guildId, channelId) {
    const channelNode = getChannelNode(timers, guildId, channelId);
    if (!channelNode) return [];

    const rows = [];
    for (const day of DAY_ORDER) {
        const dayNode = channelNode[day];
        if (!dayNode) continue;

        const times = Object.keys(dayNode).sort();
        for (const time of times) rows.push({ day, time, value: dayNode[time] });
    }
    return rows;
}

/* ------------------ command ------------------ */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setNameLocalizations({ ko: '알람' })
        .setDescription('Timer 관리')
        .setDescriptionLocalizations({ ko: '알람을 설정/삭제/조회 합니다.' })

        .addSubcommand(sc =>
            sc.setName('set')
                .setNameLocalizations({ ko: '설정' })
                .setDescription('타이머 설정')
                .setDescriptionLocalizations({ ko: '타이머를 설정합니다.' })
                .addStringOption(o =>
                    o.setName('day')
                        .setNameLocalizations({ ko: '요일' })
                        .setDescription('mon,tue... or mon~fri (한글: 월, 화... 월~금)')
                        .setDescriptionLocalizations({ ko: 'mon,tue... 또는 mon~fri (한글: 월, 화... 월~금)' })
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName('time')
                        .setNameLocalizations({ ko: '시간' })
                        .setDescription('HH:MM (예: 6:06, 06:06, 23:59)')
                        .setDescriptionLocalizations({ ko: 'HH:MM (예: 9:30, 09:30, 23:59)' })
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName('message')
                        .setNameLocalizations({ ko: '메시지' })
                        .setDescription('알람 문구')
                        .setDescriptionLocalizations({ ko: '알람 문구' })
                        .setRequired(true)
                )
        )
        .addSubcommand(sc =>
            sc.setName('remove')
                .setNameLocalizations({ ko: '삭제' })
                .setDescription('타이머 삭제')
                .setDescriptionLocalizations({ ko: '타이머를 삭제합니다.' })
                .addStringOption(o =>
                    o.setName('day')
                        .setNameLocalizations({ ko: '요일' })
                        .setDescription('mon,tue... (한글: 월, 화...)')
                        .setDescriptionLocalizations({ ko: 'mon,tue... (한글: 월, 화...)' })
                        .setRequired(true)
                )
                .addStringOption(o =>
                    o.setName('time')
                        .setNameLocalizations({ ko: '시간' })
                        .setDescription('HH:MM (예: 6:06, 06:06, 23:59)')
                        .setDescriptionLocalizations({ ko: 'HH:MM (예: 9:30, 09:30, 23:59)' })
                        .setRequired(true)
                )
        )

        .addSubcommand(sc =>
            sc.setName('list')
                .setNameLocalizations({ ko: '목록' })
                .setDescription('현재 채널 타이머 목록')
                .setDescriptionLocalizations({ ko: '현재 채널의 타이머 목록을 출력합니다.' })
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const channelId = interaction.channelId;

        if (!guildId) {
            return interaction.reply({ content: '서버(길드)에서만 사용할 수 있습니다.' });
        }

        const timers = loadTimers();

        /* ---------- set ---------- */
        if (sub === 'set') {
            const dayRaw = interaction.options.getString('day', true);
            const timeRaw = interaction.options.getString('time', true);
            const message = interaction.options.getString('message') ?? undefined;

            const days = expandDays(dayRaw);
            if (!days) {
                return interaction.reply({ content: 'day 형식 오류 (예: mon, mon~fri, 월, 월~금)' });
            }

            const time = parseAndNormalizeTime(timeRaw);
            if (!time) {
                return interaction.reply({ content: 'time 형식 오류 (예: 9:30, 09:30, 23:59)' });
            }

            for (const d of days) {
                const payload = {
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString(),
                    message,
                };

                setTimer(timers, guildId, channelId, d, time, payload);
                addSchedule({ guildId, channelId, dayKey: d, timeKey: time, payload });
            }

            saveTimers(timers);

            const displayDays = days.map(d => DAY_KO_LABEL[d] ?? d);

            const embed = new EmbedBuilder()
                .setTitle('✅ 알람 설정 완료')
                .setDescription(
                    `Channel: <#${channelId}>\n` +
                    `Day: \`${displayDays.join(', ')}\`\n` +
                    `Time: \`${time}\`` +
                    (message ? `\nMessage: ${message}` : '')
                );

            return interaction.reply({ embeds: [embed] });
        }

        /* ---------- remove ---------- */
        if (sub === 'remove') {
            const dayRaw = interaction.options.getString('day', true);
            const timeRaw = interaction.options.getString('time', true);

            const day = normalizeDayInput(dayRaw);
            const time = parseAndNormalizeTime(timeRaw);

            if (!DAY_ORDER.includes(day)) {
                return interaction.reply({ content: 'day 형식 오류 (예: mon 또는 월/일)' });
            }
            if (!time) {
                return interaction.reply({ content: 'time 형식 오류 (예: 9:30, 09:30, 23:59)' });
            }

            const ok = removeTimer(timers, guildId, channelId, day, time);
            if (!ok) {
                return interaction.reply({ content: '해당 알람이 존재하지 않습니다.' });
            }

            saveTimers(timers);
            removeSchedule({ guildId, channelId, dayKey: day, timeKey: time });

            return interaction.reply({ content: `🗑️ 삭제 완료: \`${day}\` \`${time}\` (채널 <#${channelId}>)` });
        }

        /* ---------- list ---------- */
        if (sub === 'list') {
            const rows = listTimersForChannel(timers, guildId, channelId);
            if (rows.length === 0) {
                return interaction.reply({ content: '현재 채널에 설정된 알람이 없습니다.' });
            }

            const grouped = new Map();
            for (const r of rows) {
                if (!grouped.has(r.day)) grouped.set(r.day, []);
                grouped.get(r.day).push(r.time);
            }

            const lines = [];
            for (const day of DAY_ORDER) {
                const times = grouped.get(day);
                if (!times) continue;
                lines.push(`**${day}**: ${times.map(t => `\`${t}\``).join(', ')}`);
            }

            const embed = new EmbedBuilder()
                .setTitle('⏰ Timer List')
                .setDescription(lines.join('\n'));

            return interaction.reply({ embeds: [embed] });
        }

        return interaction.reply({ content: '지원하지 않는 서브커맨드입니다.' });
    },
};
