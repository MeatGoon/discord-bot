// thread/thread.js
const {Events, PermissionFlagsBits} = require('discord.js');

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {
        let thread;
        try {
            // 봇이 보낸 메시지나 DM은 무시
            if (message.author.bot || !message.guild) return;

            // 채널 이름이 "건의사항"이 아닐 경우 무시
            if (message.channel.name !== '건의사항') return;

            const content = message.content?.trim() || '(내용 없음)';

            // 🔹 비공개 스레드 생성
            thread = await message.startThread({
                name: `${message.author.username}님의 건의사항`,
                autoArchiveDuration: 10080, // 7일 (삭제 전까지 유지)
                type: 12, // Private thread
                invitable: false,
            });

            // 작성자 추가
            await thread.members.add(message.author.id);

            // 전체 멤버 조회
            await message.guild.members.fetch();

            // 관리자 권한 가진 멤버 모두
            const adminMembers = message.guild.members.cache.filter(member => {
                const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
                const hasTribeChiefRole = member.roles.cache.some(role => role.name === '부족장');

                // 기존 예외 유지: 특정 ID는 작성자가 동일 ID일 때만 포함
               const isBlocked = member.id === '185747474613272577' && message.author.id !== '185747474613272577';

                return (isAdmin || hasTribeChiefRole) && !isBlocked;
                // return (isAdmin || hasTribeChiefRole);
            });
            // 현재 스레드 멤버 목록 로드
            const threadMembers = await thread.members.fetch();

            // 속도 제한 대비
            const sleep = ms => new Promise(res => setTimeout(res, ms));

            for (const [userId, member] of adminMembers) {
                if (threadMembers.has(userId)) continue; // 이미 초대됨
                try {
                    await thread.members.add(userId);
                    await sleep(300); // rate limit 여유
                } catch (e) {
                    console.warn(`스레드 초대 실패: ${member.user.tag} (${userId})`, e?.message || e);
                }
            }

            // 원본 메시지 삭제
            await message.delete().catch(() => {
            });

            // 안내 메시지 (작성자가 쓴 원문 포함)
            await thread.send({
                content: `📩 **${message.author}님의 건의사항입니다.**\n\n> ${content}`,
            });
        } catch (error) {
            // 스레드 삭제
            await thread.delete()
            console.error('❌ 스레드 생성 중 오류:', error);
        }
    },
};