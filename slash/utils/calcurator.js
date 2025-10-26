import Decimal from "decimal.js";

// ====== 유틸 ======
const num = (v) => (v === "" || v == null || isNaN(+v)) ? null : +v;
const floor4 = (a) => a.map(x => Math.floor(x ?? NaN));
const toFixed2 = (x) => new Decimal(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

// ====== 추정/검증 로직 ======
const ESET = Array.from({ length: ((575 - 435) / 5) + 1 }, (_, i) => 575 - i * 5);

// S0 계산
function s0_from_k_u_jjyal(k, u) {
    const fac = k / 100;
    const vhp = (u.hp + 4.5) * fac;
    const vatk = (u.atk + 4.5) * fac;
    const vdef = (u.def + 4.5) * fac;
    const vagi = (u.agi + 4.5) * fac;
    const s_hp = Math.floor(vhp * 4 + vatk + vdef + vagi);
    const s_atk = Math.floor(vhp * 0.1 + vatk + vdef * 0.1 + vagi * 0.05);
    const s_def = Math.floor(vhp * 0.1 + vatk * 0.1 + vdef + vagi * 0.05);
    const s_agi = Math.floor(vagi);
    return [s_hp, s_atk, s_def, s_agi];
}

// SG → u 역산
function solveUFromSG_STRICT(SG, e) {
    try {
        if (!SG || ![SG.hp, SG.atk, SG.def, SG.agi].every(Number.isFinite)) return null;
        Decimal.set({ precision: 50, rounding: Decimal.ROUND_HALF_UP });

        const eD = new Decimal(e);
        const f = eD.dividedBy(10000);

        const u_agi = new Decimal(SG.agi).times(10000).dividedBy(eD).minus(4.5).round();
        const dPlus45 = u_agi.plus(4.5);

        const rhs1 = new Decimal(SG.hp).minus(dPlus45.times(f)).dividedBy(f);
        const rhs2 = new Decimal(SG.atk).minus(dPlus45.times(f).times(0.05)).dividedBy(f);
        const rhs3 = new Decimal(SG.def).minus(dPlus45.times(f).times(0.05)).dividedBy(f);

        let A = [
            [new Decimal(4), new Decimal(1), new Decimal(1), rhs1],
            [new Decimal(0.1), new Decimal(1), new Decimal(0.1), rhs2],
            [new Decimal(0.1), new Decimal(0.1), new Decimal(1), rhs3],
        ];

        for (let i = 0; i < 3; i++) {
            let mr = i; let mv = A[i][i].abs();
            for (let j = i + 1; j < 3; j++) {
                const t = A[j][i].abs();
                if (t.greaterThan(mv)) { mr = j; mv = t; }
            }
            if (mr !== i) { [A[i], A[mr]] = [A[mr], A[i]]; }
            const piv = A[i][i];
            for (let j = i; j < 4; j++) A[i][j] = A[i][j].dividedBy(piv);
            for (let k = 0; k < 3; k++) {
                if (k === i) continue;
                const fac = A[k][i];
                for (let j = i; j < 4; j++) A[k][j] = A[k][j].minus(fac.times(A[i][j]));
            }
        }

        const [aPrime, bPrime, cPrime] = [A[0][3], A[1][3], A[2][3]];
        const u_hp = aPrime.minus(4.5).round();
        const u_atk = bPrime.minus(4.5).round();
        const u_def = cPrime.minus(4.5).round();

        const r2 = x => new Decimal(x).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const hp_chk = r2(f.times((u_hp.plus(4.5).times(4).plus(u_atk.plus(4.5)).plus(u_def.plus(4.5)).plus(u_agi.plus(4.5)))));
        const atk_chk = r2(f.times((u_hp.plus(4.5).times(0.1).plus(u_atk.plus(4.5)).plus(u_def.plus(4.5).times(0.1)).plus(u_agi.plus(4.5).times(0.05)))));
        const def_chk = r2(f.times((u_hp.plus(4.5).times(0.1).plus(u_atk.plus(4.5).times(0.1)).plus(u_def.plus(4.5)).plus(u_agi.plus(4.5).times(0.05)))));
        const agi_chk = r2(f.times(u_agi.plus(4.5)));

        if (!(hp_chk.eq(r2(SG.hp)) && atk_chk.eq(r2(SG.atk)) && def_chk.eq(r2(SG.def)) && agi_chk.eq(r2(SG.agi)))) return null;
        return { u: { hp: +u_hp, atk: +u_atk, def: +u_def, agi: +u_agi }, e: +e };
    } catch { return null; }
}

// S0와 SG로 k,u 추정
function inferKU_STRICT(S0, SG) {
    const S0int = S0.map(x => Math.floor(x));
    for (const e of ESET) {
        const sol = solveUFromSG_STRICT(SG, e);
        if (!sol) continue;
        for (let k = 10; k <= 100; k++) {
            const s = s0_from_k_u_jjyal(k, sol.u);
            if (s[0] === S0int[0] && s[1] === S0int[1] && s[2] === S0int[2] && s[3] === S0int[3]) {
                return { k: Math.round(k), u: sol.u, e: sol.e };
            }
        }
    }
    return null;
}

// R8 집계
function collectR8ObsForKU(k, u) {
    Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
    const fac = new Decimal(k).dividedBy(100);
    const seen = new Map();

    for (let ar = -2; ar <= 2; ar++) {
        for (let dr = -2; dr <= 2; dr++) {
            for (let gr = -2; gr <= 2; gr++) {
                for (let hr = -2; hr <= 2; hr++) {
                    for (let ab = 0; ab <= 10; ab++) {
                        for (let db = 0; db <= 10; db++) {
                            for (let gb = 0; gb <= 10; gb++) {
                                const hb = 10 - ab - db - gb;
                                if (hb < 0 || hb > 10) continue;

                                const baseA = new Decimal(u.atk + ar + ab);
                                const baseD = new Decimal(u.def + dr + db);
                                const baseG = new Decimal(u.agi + gr + gb);
                                const baseH = new Decimal(u.hp + hr + hb);

                                const iA = baseA.times(fac);
                                const iD = baseD.times(fac);
                                const iG = baseG.times(fac);
                                const iH = baseH.times(fac);

                                const atk = iH.times(0.1).plus(iA).plus(iD.times(0.1)).plus(iG.times(0.05)).floor().toNumber();
                                const def = iH.times(0.1).plus(iA.times(0.1)).plus(iD).plus(iG.times(0.05)).floor().toNumber();
                                const agi = iG.floor().toNumber();
                                const hp = iH.times(4).plus(iA).plus(iD).plus(iG).floor().toNumber();

                                const key = `${hp},${atk},${def},${agi}`;
                                let s = seen.get(key);
                                if (!s) { s = new Set(); seen.set(key, s); }
                                s.add(ar + dr + gr + hr);
                            }
                        }
                    }
                }
            }
        }
    }

    const out = [];
    for (const [key, set] of seen.entries()) {
        if (set.size === 1 && set.has(8)) {
            out.push(key.split(',').map(n => +n));
        }
    }
    out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    return out;
}

export { s0_from_k_u_jjyal, solveUFromSG_STRICT, inferKU_STRICT, collectR8ObsForKU };
