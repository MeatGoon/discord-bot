// JavaScript
const fs = require('fs');
const path = require('path');
const { REST, Routes, Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');
const { token, prefix } = require('./config.json');
const thread = require('./thread/thread.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.slashCommands = new Collection();

// 유틸: 안전한 require
function safeRequire(modulePath) {
  try {
    return require(modulePath);
  } catch (e) {
    console.error(`❌ require 실패: ${modulePath}\n`, e);
    return null;
  }
}

// 메시지 명령어 로딩
function loadMessageCommands(commandsDir) {
  if (!fs.existsSync(commandsDir)) {
    console.warn(`⚠️ commands 폴더가 없습니다: ${commandsDir}`);
    return;
  }
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = safeRequire(path.join(commandsDir, file));
    if (!mod) continue;

    const list = Array.isArray(mod) ? mod : [mod];
    for (const cmd of list) {
      if (!cmd?.name || typeof cmd.execute !== 'function') {
        console.warn(`⚠️ 메시지 명령어 스킵: ${file} (name/execute 누락)`);
        continue;
      }
      client.commands.set(cmd.name, cmd);
      console.log(`✅ 메시지 명령어 로드: ${cmd.name}`);
    }
  }
}

// 슬래시 명령어 로딩
function loadSlashCommands(slashDir) {
  const commandsData = [];
  if (!fs.existsSync(slashDir)) {
    console.warn(`⚠️ slash 폴더가 없습니다: ${slashDir}`);
    return commandsData;
  }
  const files = fs.readdirSync(slashDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const mod = safeRequire(path.join(slashDir, file));
    if (!mod?.data?.name || typeof mod.data.toJSON !== 'function') {
      console.warn(`⚠️ 슬래시 스킵: ${file} (data.name/toJSON 누락)`);
      continue;
    }
    client.slashCommands.set(mod.data.name, mod);
    commandsData.push(mod.data.toJSON());
    console.log(`✅ 슬래시 로드: /${mod.data.name}`);
  }
  return commandsData;
}

// 슬래시 명령어 등록 (길드 단위, 병렬 등록)
async function registerSlashCommands(commandsData) {
  if (!commandsData.length) {
    console.warn('⚠️ 등록할 슬래시 명령어가 없습니다.');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const app = await rest.get(Routes.oauth2CurrentApplication());
  const clientId = app.id;

  const guilds = Array.from(client.guilds.cache.values());
  if (!guilds.length) {
    console.warn('⚠️ 봇이 가입된 길드가 없습니다. 최소 한 개의 서버에 봇을 초대하세요.');
    return;
  }

  console.log(`🔄 슬래시 명령어 등록 시작: ${guilds.length}개 길드`);
  await Promise.all(
      guilds.map(async (guild) => {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commandsData });
          const names = commandsData.map(c => c.name).join(', ');
          console.log(`✅ [${guild.name}] 등록 완료: ${names}`);
        } catch (err) {
          console.error(`❌ [${guild.name}] 등록 실패:`, err?.message || err);
        }
      })
  );
}

// 스레드 기능
client.on(Events.MessageCreate, thread.execute);

// 메시지 명령어 처리
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error('❌ 메시지 명령어 실행 오류:', err);
    try {
      await message.reply('명령어 실행 중 오류가 발생했습니다.');
    } catch (e) {
      // ignore
    }
  }
});

// 슬래시 명령어 처리
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) {
    return interaction.reply({ content: '알 수 없는 슬래시 명령어입니다.', ephemeral: true });
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error('❌ 슬래시 명령어 실행 오류:', err);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true });
      } else {
        await interaction.reply({ content: '명령어 실행 중 오류가 발생했습니다.', ephemeral: true });
      }
    } catch {
      // ignore
    }
  }
});

// 준비 완료
client.once(Events.ClientReady, async () => {
  console.log(`${client.user.tag} 에 로그인됨 ✅`);

  const commandsDir = path.resolve(__dirname, 'commands');
  const slashDir = path.resolve(__dirname, 'slash');

  loadMessageCommands(commandsDir);
  const commandsData = loadSlashCommands(slashDir);

  await registerSlashCommands(commandsData);
});

client.login(token);