const { getPet } = require('../data/petStore');
const { calcKUFromS0SG, calcRank8ProbByObserved } = require('../data/petCalcBase');

function toIntOrNull(x) {
    if (x == null) return null;
    const n = Number(x);
    return Number.isFinite(n) ? (n | 0) : null;
}

module.exports = {
    name: '펫',
    async execute(message, args) {
        const name = args?.[0];
        const hp  = toIntOrNull(args?.[1]);
        const atk = toIntOrNull(args?.[2]);
        const def = toIntOrNull(args?.[3]);
        const agi = toIntOrNull(args?.[4]);

        if (!name || [hp, atk, def, agi].some(v => v == null)) {
            return message.reply('사용법: `!펫 <이름> <hp> <atk> <def> <agi>` (정수 4개)');
        }

        const pet = getPet(name);
        if (!pet) return message.reply(`❌ 펫을 찾지 못함: ${name}`);

        let k = null;
        let u = null;
        let kuSrc = '';

        if (
            Number.isFinite(pet?.k) &&
            pet?.u &&
            [pet.u.hp, pet.u.atk, pet.u.def, pet.u.agi].every(Number.isFinite)
        ) {
            k = pet.k;
            u = pet.u;
            kuSrc = `saved${pet.ku_override ? ':override' : ''}`;
        } else {
            const r = calcKUFromS0SG({ s0: pet.s0, sg: pet.sg });
            if (!r.ok) {
                return message.reply(
                    `❌ ${name}: k/u 없음 + STRICT 추정 실패\n` +
                    `- 사유: ${r.error}\n` +
                    `- 해결: 관리자 페이지에서 k/u 오버라이드 저장하거나 S0/SG 확인`
                );
            }
            k = r.k;
            u = r.u;
            kuSrc = `strict-auto (e≈${Number(r.e).toFixed(2)})`;
        }

        const target = { hp, atk, def, agi };
        const pr = calcRank8ProbByObserved(k, u, target);

        if (!pr.ok) return message.reply(`❌ 계산 실패: ${pr.error}`);

        const header =
            `**${name}**\n` +
            `k/u: k=${k}, u=(${u.hp},${u.atk},${u.def},${u.agi}) [${kuSrc}]\n` +
            `관측: (${hp}, ${atk}, ${def}, ${agi})`;

        if (pr.totalHit === 0) {
            return message.reply(
                `${header}\n` +
                `결과: 해당 관측값을 만드는 조합이 없습니다. (확률 0%)`
            );
        }

        return message.reply(
            `${header}\n` +
            `전체 조합 중 관측 일치: ${pr.totalHit}건\n` +
            `그 중 8등급(rollSum=8): ${pr.rank8Hit}건\n` +
            `➡️ 8등급 확률: **${pr.probPercent.toFixed(4)}%** (=${pr.prob.toFixed(6)})`
        );
    }
};
