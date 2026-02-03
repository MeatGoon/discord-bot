const fs = require('fs');
const path = require('path');

const PETS_PATH = path.resolve(__dirname, '../pets.json');

function ensureFile() {
    const dir = path.dirname(PETS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(PETS_PATH)) fs.writeFileSync(PETS_PATH, JSON.stringify({}, null, 2), 'utf8');
}

function loadDB() {
    ensureFile();
    const raw = fs.readFileSync(PETS_PATH, 'utf8');
    try {
        const obj = JSON.parse(raw);
        return obj && typeof obj === 'object' ? obj : {};
    } catch {
        return {};
    }
}

function saveDB(db) {
    ensureFile();
    fs.writeFileSync(PETS_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function upsertPet({ name, s0, sg, note }) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: '이름이 비어있습니다.' };
    if (!s0 || !sg) return { ok: false, error: 's0/sg 누락' };

    const nums = [s0.hp, s0.atk, s0.def, s0.agi, sg.hp, sg.atk, sg.def, sg.agi];
    if (!nums.every(Number.isFinite)) return { ok: false, error: '숫자 값이 올바르지 않습니다.' };

    const db = loadDB();
    const existed = !!db[name];

    db[name] = {
        ...(db[name] || {}),
        s0,
        sg,
        ...(note ? { note } : {}),
    };

    saveDB(db);
    return { ok: true, existed, pet: db[name] };
}

function deletePet(name) {
    name = String(name || '').trim();
    if (!name) return { ok: false, error: '이름이 비어있습니다.' };

    const db = loadDB();
    if (!db[name]) return { ok: false, error: '해당 이름의 펫이 없습니다.' };

    const removed = db[name];
    delete db[name];
    saveDB(db);
    return { ok: true, removed };
}

function getPet(name) {
    name = String(name || '').trim();
    if (!name) return null;
    const db = loadDB();
    const row = db[name];
    return row ? { name, ...row } : null;
}

module.exports = { loadDB, saveDB, upsertPet, deletePet, getPet, PETS_PATH };
