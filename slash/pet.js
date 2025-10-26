const { inferKU_STRICT } = require('./utils/calcurator.js');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register') // 기본은 영문 소문자
        .setNameLocalizations({ko: '등록'}) // 한국어 표시/검색 이름
        .setDescription('Register pet stats')
        .setDescriptionLocalizations({ko: '펫 능력치를 등록합니다.'})
        .addIntegerOption(o =>
            o.setName('atk')
                .setNameLocalizations({ko: '공'})
                .setDescription('Attack')
                .setDescriptionLocalizations({ko: '공(공격력)'})
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('def')
                .setNameLocalizations({ko: '방'})
                .setDescription('Defense')
                .setDescriptionLocalizations({ko: '방(방어력)'})
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('agi')
                .setNameLocalizations({ko: '민첩'})
                .setDescription('Agility')
                .setDescriptionLocalizations({ko: '민첩'})
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName('hp')
                .setNameLocalizations({ko: '체력'})
                .setDescription('Hit Points')
                .setDescriptionLocalizations({ko: '체력'})
                .setRequired(true)
        )
        .addNumberOption(o =>
            o.setName('growth1')
                .setNameLocalizations({ko: '성장률1'})
                .setDescription('Growth 1')
                .setDescriptionLocalizations({ko: '성장률1 (소수 허용)'})
                .setRequired(true)
        )
        .addNumberOption(o =>
            o.setName('growth2')
                .setNameLocalizations({ko: '성장률2'})
                .setDescription('Growth 2')
                .setDescriptionLocalizations({ko: '성장률2 (소수 허용)'})
                .setRequired(true)
        )
        .addNumberOption(o =>
            o.setName('growth3')
                .setNameLocalizations({ko: '성장률3'})
                .setDescription('Growth 3')
                .setDescriptionLocalizations({ko: '성장률3 (소수 허용)'})
                .setRequired(true)
        )
        .addNumberOption(o =>
            o.setName('growth4')
                .setNameLocalizations({ko: '성장률4'})
                .setDescription('Growth 4')
                .setDescriptionLocalizations({ko: '성장률4 (소수 허용)'})
                .setRequired(true)
        ),

    async execute(interaction) {
        const atk = interaction.options.getInteger('atk', true);
        const def = interaction.options.getInteger('def', true);
        const agi = interaction.options.getInteger('agi', true);
        const hp = interaction.options.getInteger('hp', true);
        const g1 = interaction.options.getNumber('growth1', true);
        const g2 = interaction.options.getNumber('growth2', true);
        const g3 = interaction.options.getNumber('growth3', true);
        const g4 = interaction.options.getNumber('growth4', true);

        // 계산기
        // 입력 구조화
        const S0 = [hp, atk, def, agi];
        const SG = { hp: g1, atk: g2, def: g3, agi: g4 };

        // 계산 수행
        const result = inferKU_STRICT(S0, SG);

        console.log(result);

        if (!result) {
            await interaction.reply("❌ 가능한 k, u, e 조합을 찾지 못했습니다.");
            return;
        }

        // 봇의 역할(가장 높은 색상 역할) 색상 사용, 없으면 기본값
        const me = interaction.guild?.members?.me;
        const embedColor = me?.roles?.color?.color || 0x2b90d9;
        // 닉네임(서버 닉네임 > 글로벌 이름 > 사용자명) 우선 순위
        const displayName = interaction.member?.nickname ?? interaction.user.globalName ?? interaction.user.username;
        const avatarUrl = interaction.user.displayAvatarURL({extension: 'png', size: 256});

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('펫 등록 완료')
            .setDescription('입력한 능력치와 성장률이 등록되었습니다.')
            .addFields(
                // 행 4: 체 | 성4
                {name: '체력', value: String(hp), inline: true},
                {name: '성장률(체력)', value: String(g4), inline: true},
                {name: '\u200B', value: '\u200B', inline: true},

                // 행 1: 공 | 성1
                {name: '공', value: String(atk), inline: true},
                {name: '성장률(공)', value: String(g1), inline: true},
                {name: '\u200B', value: '\u200B', inline: true},

                // 행 2: 방 | 성2
                {name: '방', value: String(def), inline: true},
                {name: '성장률(방)', value: String(g2), inline: true},
                {name: '\u200B', value: '\u200B', inline: true},

                // 행 3: 민 | 성3
                {name: '순', value: String(agi), inline: true},
                {name: '성장률(순)', value: String(g3), inline: true},
                {name: '\u200B', value: '\u200B', inline: true}
            )
            .setFooter({
                text: `요청자 : ${displayName}`,
                iconURL: interaction.user.displayAvatarURL({extension: 'png', size: 128}),
            })
            .setTimestamp();

        // 메세지 전송
        await interaction.reply({embeds: [embed]});
    },
};

function calculator(atk, def, agi, hp, g1, g2, g3, g4) {
    console.log(atk, def, agi, hp, g1, g2, g3, g4);
}