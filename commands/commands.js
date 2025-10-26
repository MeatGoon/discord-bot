// commands/pingpong.js
module.exports = [
    {
        name: 'ping',
        description: '봇의 응답 속도를 확인합니다.',
        async execute(message, args) {
            const sent = await message.reply('🏓 Pong!');
            sent.edit(`🏓 Pong! (${sent.createdTimestamp - message.createdTimestamp}ms)`);
        }
    },
    {
        name: 'pong',
        description: '봇의 응답 속도를 확인합니다.',
        async execute(message, args) {
            const sent = await message.reply('🏓 Ping!');
            sent.edit(`🏓 Ping! (${sent.createdTimestamp - message.createdTimestamp}ms)`);
        }
    }
];
