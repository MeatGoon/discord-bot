const { SlashCommandBuilder } = require('discord.js');
const { upsertPet, deletePet } = require('../data/petStore');

const registerCmd = {
    data: new SlashCommandBuilder()
        .setName('펫등록')
        .setDescription('펫 S0/SG 등록 (data/pets.json 저장)')
        .addStringOption(o => o.setName('이름').setDescription('펫 이름').setRequired(true))
        // S0
        .addNumberOption(o => o.setName('hp').setDescription('S0 hp').setRequired(true))
        .addNumberOption(o => o.setName('atk').setDescription('S0 atk').setRequired(true))
        .addNumberOption(o => o.setName('def').setDescription('S0 def').setRequired(true))
        .addNumberOption(o => o.setName('agi').setDescription('S0 agi').setRequired(true))
        // SG
        .addNumberOption(o => o.setName('hp성장률').setDescription('SG hp').setRequired(true))
        .addNumberOption(o => o.setName('atk성장률').setDescription('SG atk').setRequired(true))
        .addNumberOption(o => o.setName('def성장률').setDescription('SG def').setRequired(true))
        .addNumberOption(o => o.setName('agi성장률').setDescription('SG agi').setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('이름', true);

        const s0 = {
            hp:  interaction.options.getNumber('hp', true),
            atk: interaction.options.getNumber('atk', true),
            def: interaction.options.getNumber('def', true),
            agi: interaction.options.getNumber('agi', true),
        };

        const sg = {
            hp:  interaction.options.getNumber('hp성장률', true),
            atk: interaction.options.getNumber('atk성장률', true),
            def: interaction.options.getNumber('def성장률', true),
            agi: interaction.options.getNumber('agi성장률', true),
        };

        const r = upsertPet({ name, s0, sg });
        if (!r.ok) return interaction.reply({ content: `❌ 펫등록 실패: ${r.error}`, ephemeral: true });

        return interaction.reply(
            `✅ 펫등록(${r.existed ? '수정' : '신규'}): **${name}**\n` +
            `S0: ${s0.hp}/${s0.atk}/${s0.def}/${s0.agi}\n` +
            `SG: ${sg.hp}/${sg.atk}/${sg.def}/${sg.agi}`
        );
    },
};

const deleteCmd = {
    data: new SlashCommandBuilder()
        .setName('펫삭제')
        .setDescription('펫 삭제 (data/pets.json 반영)')
        .addStringOption(o => o.setName('이름').setDescription('펫 이름').setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('이름', true);
        const r = deletePet(name);
        if (!r.ok) return interaction.reply({ content: `❌ 펫삭제 실패: ${r.error}`, ephemeral: true });
        return interaction.reply(`🗑️ 펫삭제 완료: **${name}**`);
    },
};

module.exports = [registerCmd, deleteCmd];
