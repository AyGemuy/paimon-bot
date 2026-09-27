import axios from "axios";
import chalk from "chalk";
import * as Baileys from "@whiskeysockets/baileys";
import {
  getExpNeeded
} from "./tools.js";
import {
  contactQuoted,
  metaQuoted
} from "../lib/quoted.js";
import {
  badwordList
} from "../lib/badword.js";
import db from "../data/db.js";
import {
  extractMessageText,
  resolveLidToJid,
  decodeJid,
  extractNum,
  resizeImage
} from "./serialize.js";
const cooldowns = new Map();
const userSpamMap = new Map();

function getSha256Hex(rawSha) {
  if (!rawSha) return null;
  try {
    if (Buffer.isBuffer(rawSha) || rawSha instanceof Uint8Array || Array.isArray(rawSha)) {
      return Buffer.from(rawSha).toString("hex").toLowerCase();
    }
    if (typeof rawSha === "string") {
      if (/^[0-9a-f]{64}$/i.test(rawSha)) return rawSha.toLowerCase();
      return Buffer.from(rawSha, "base64").toString("hex").toLowerCase();
    }
    if (typeof rawSha === "object" && rawSha.data) {
      return Buffer.from(rawSha.data).toString("hex").toLowerCase();
    }
  } catch {}
  return null;
}

function sanitizeQuotedMessage(msg, targetJid, isGroup) {
  if (!msg || !msg.key) return msg;
  const cleanMsg = {
    ...msg,
    key: {
      ...msg.key,
      remoteJid: !isGroup ? targetJid : msg.key.remoteJid
    }
  };
  if (!isGroup) {
    delete cleanMsg.key.participant;
    delete cleanMsg.key.participantAlt;
    delete cleanMsg.key.remoteJidAlt;
  }
  return cleanMsg;
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1e3 % 60);
  const min = Math.floor(ms / (1e3 * 60) % 60);
  const hrs = Math.floor(ms / (1e3 * 60 * 60) % 24);
  const days = Math.floor(ms / (1e3 * 60 * 60 * 24));
  const parts = [];
  if (days) parts.push(`${days} hari`);
  if (hrs) parts.push(`${hrs} jam`);
  if (min) parts.push(`${min} menit`);
  if (sec || parts.length === 0) parts.push(`${sec} detik`);
  return parts.join(" ");
}

function getRankTitle(level) {
  if (level >= 100) return "🌟 Mythic Overlord";
  if (level >= 75) return "👑 Grandmaster";
  if (level >= 50) return "⚔️ Master";
  if (level >= 35) return "💎 Diamond Hero";
  if (level >= 20) return "🛡️ Platinum Knight";
  if (level >= 10) return "🥉 Gold Warrior";
  if (level >= 5) return "🥈 Silver Adventurer";
  return "🌱 Novice Traveler";
}
export async function migrateLidToJid(dbData, sock = null) {
  if (!dbData?.user) return;
  const users = dbData.user;
  let changed = false;
  for (const key of Object.keys(users)) {
    if (!key.endsWith("@lid")) continue;
    const realJid = sock ? await resolveLidToJid(key, sock) : null;
    const jidKey = realJid && !realJid.endsWith("@lid") ? realJid : null;
    if (jidKey) {
      users[jidKey] = users[jidKey] ? {
        ...users[key],
        ...users[jidKey]
      } : users[key];
      delete users[key];
      changed = true;
      console.log(chalk.yellow(`[DB MIGRATE] ${key} → ${jidKey}`));
    }
  }
  if (changed) {
    db.write(dbData);
    console.log(chalk.green("[DB MIGRATE] Migrasi Database Selesai."));
  }
}
async function normalizeLidCtx(ctx, sock = null) {
  const groupPtcp = ctx.participants || [];
  if (ctx.sender?.endsWith("@lid")) {
    ctx.sender = await resolveLidToJid(ctx.sender, sock, ctx.senderAlt || ctx.userPhoneJid, groupPtcp);
  }
  if (ctx.chat?.endsWith("@lid") && !ctx.isGroup) {
    ctx.chat = ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : await resolveLidToJid(ctx.chat, sock, null, groupPtcp);
    ctx.id = ctx.chat;
  }
  if (ctx.userPhoneJid?.endsWith("@lid")) {
    ctx.userPhoneJid = await resolveLidToJid(ctx.userPhoneJid, sock, ctx.senderAlt, groupPtcp);
    ctx.senderNumber = extractNum(ctx.userPhoneJid);
  }
  if (ctx.botId && !ctx.botId.endsWith("@lid")) {
    ctx.botJid = Baileys.jidNormalizedUser(ctx.botId);
  }
  if (ctx.quoted && ctx.quoted.sender?.endsWith("@lid")) {
    ctx.quoted.sender = await resolveLidToJid(ctx.quoted.sender, sock, null, groupPtcp);
    if (!ctx.isGroup && ctx.quoted.sender.endsWith("@lid")) {
      ctx.quoted.sender = ctx.chat;
    }
    ctx.quoted.senderNumber = extractNum(ctx.quoted.sender);
    if (ctx.quoted.key) {
      ctx.quoted.key.participant = ctx.quoted.sender;
    }
    if (ctx.quoted.fakeObj?.key) {
      ctx.quoted.fakeObj.key.participant = ctx.quoted.sender;
    }
  }
}
async function getParticipantPhoneJid(p, sock = null) {
  if (!p) return null;
  const raw = p.phoneNumber || p.jid || p.id;
  if (!raw) return null;
  const decoded = decodeJid(raw);
  if (!decoded.endsWith("@lid")) return Baileys.jidNormalizedUser(decoded);
  return await resolveLidToJid(decoded, sock);
}
async function generateLevelUpCard({
  avatar,
  username = "Player",
  currentLevel = 1,
  nextLevel = 2,
  userData = {}
}) {
  try {
    const now = new Date();
    const estDate = `EST. ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
    const payload = {
      sub_title: "PROTOCOL: LEVEL_UP_EVOLUTION",
      title_l: "LEVEL",
      title_r: `.${nextLevel}`,
      version: "RPG ENGINE V3.0",
      est: estDate,
      users: `Lv. ${nextLevel}`,
      u_title: getRankTitle(nextLevel),
      desc_title: "Character Evolution",
      desc: `Selamat kepada ${username}! Status karakter kamu berhasil meningkat ke Level ${nextLevel}. Pertahankan ritme bertualangmu!`,
      tag_a: `LVL_${nextLevel}`,
      tag_b: "EXP_BOOST",
      tag_c: "RANK_UP",
      adm_title: "Player Profile",
      adm_name: `@${username.replace(/\s+/g, "_").slice(0, 10)}`,
      adm_stat: "ACTIVE",
      cr_name: "HP +20",
      cr_stat: "BUFF",
      ds_name: "ATK +3",
      ds_stat: "BUFF",
      act_title: "Attributes Load",
      avg_title: "MAX_HP",
      avg_count: `${userData.hpMax || 120}`,
      msg_title: "ATK",
      msg_count: `${userData.atk || 13}`,
      file_title: "DEF",
      file_count: `${userData.def || 7}`,
      avatar: avatar || "https://picsum.photos/seed/cyber/200/200"
    };
    const {
      data
    } = await axios.post("https://wudysoft.my.id/api/maker/grup/v1", payload, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 1e4
    });
    return Buffer.from(data);
  } catch (err) {
    return null;
  }
}
export async function UpsertMsgHandle(sock, msg, ctx, {
  cmd
}) {
  if (!ctx || !msg) return;
  global.cmd = cmd;
  global.loader = cmd;
  global.msgStore = global.msgStore || new Map();
  const keyId = msg.key?.id || ctx.key?.id;
  if (keyId) {
    const existingCache = global.msgStore.get(keyId);
    global.msgStore.set(keyId, {
      ...typeof existingCache === "object" && existingCache !== null ? existingCache : {},
      ...ctx,
      msg: msg,
      rawMessage: msg.message || ctx.rawMessage,
      message: msg.message || ctx.rawMessage,
      sender: ctx.sender || msg.key?.participant || msg.key?.remoteJid,
      chat: ctx.id || ctx.chat || msg.key?.remoteJid,
      text: ctx.text || extractMessageText(msg.message || msg) || "",
      isEdited: Boolean(ctx.isEdited),
      isFromMe: Boolean(msg.key?.fromMe || ctx.isFromMe),
      quoted: ctx.quoted || null,
      timestamp: Date.now()
    });
    if (global.msgStore.size > 3e3) {
      const oldestKey = global.msgStore.keys().next().value;
      global.msgStore.delete(oldestKey);
    }
  }
  if (global.db && Object.keys(global.db?.user || {}).some(k => k.endsWith("@lid"))) {
    await migrateLidToJid(global.db, sock);
  }
  const rawSender = ctx.sender || msg.key?.participant || msg.key?.remoteJid;
  const rawSenderAlt = msg.key?.participantAlt || msg.key?.remoteJidAlt || ctx.senderAlt;
  const sender = await resolveLidToJid(decodeJid(rawSender), sock, rawSenderAlt);
  const senderAlt = rawSenderAlt ? decodeJid(rawSenderAlt) : null;
  const rawChatId = decodeJid(ctx.id || ctx.chat || msg.key?.remoteJid);
  const isGroup = rawChatId?.endsWith("@g.us") || Boolean(ctx.group || ctx.isGroup);
  if (!sender || sender === "status@broadcast" || sender.endsWith("@newsletter")) return;
  const userPhoneJid = !sender.endsWith("@lid") ? sender : senderAlt && !senderAlt.endsWith("@lid") ? senderAlt : sender;
  const senderNumber = extractNum(userPhoneJid);
  let chatId = isGroup ? rawChatId : userPhoneJid && !userPhoneJid.endsWith("@lid") ? userPhoneJid : sender;
  db.ensureUser(userPhoneJid, ctx.pushname || senderNumber);
  let groupData = null;
  if (isGroup && chatId) {
    db.ensureGroup(chatId);
    groupData = global.db?.group?.[chatId];
    if (groupData?.bans === true) return;
  }
  const isFromMe = Boolean(msg.key?.fromMe || ctx.isFromMe);
  const botId = decodeJid(sock.user?.id || sock.user?.jid || "");
  const botLid = sock.user?.lid ? decodeJid(sock.user.lid) : null;
  const botJid = Baileys.jidNormalizedUser(botId || "");
  const botJidAlt = botLid ? Baileys.jidNormalizedUser(botLid) : null;
  const isBot = isFromMe || Baileys.areJidsSameUser(sender, botJid) || botLid && Baileys.areJidsSameUser(sender, botLid) || senderAlt && Baileys.areJidsSameUser(senderAlt, botJid) || senderAlt && botLid && Baileys.areJidsSameUser(senderAlt, botLid) || Boolean(ctx.isBot);
  if ((isFromMe || isBot) && !global.bot?.selfbot) return;
  if ((isFromMe || isBot) && ctx.isBaileys) return;
  const isAntiBotActive = global.bot?.antiBot === true || isGroup && groupData?.antibot === true;
  if ((ctx.isBot || ctx.isBaileys) && !isFromMe && isAntiBotActive) return;
  const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
  const ownerNumbers = new Set();
  const ownerJids = new Set();
  for (const o of rawOwners) {
    const num = String(o).replace(/\D/g, "");
    if (num.length >= 6) {
      ownerNumbers.add(num);
      ownerJids.add(`${num}@s.whatsapp.net`);
    }
  }
  for (const num of ownerNumbers) {
    if (rawSender?.endsWith("@lid")) {
      if (userPhoneJid.includes(num) || ctx.senderNumber === num) {
        global.lidPhoneCache.set(rawSender, `${num}@s.whatsapp.net`);
      }
    }
  }
  const checkIsOwner = (candidates = []) => {
    return candidates.filter(Boolean).some(cand => {
      const cleanCand = decodeJid(cand);
      const candNum = extractNum(cleanCand);
      return ownerJids.has(cleanCand) || ownerNumbers.has(candNum) || ownerJids.has(Baileys.jidNormalizedUser(cleanCand));
    });
  };
  let isOwnerJid = checkIsOwner([sender, senderAlt, userPhoneJid, ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, rawSender, rawSenderAlt]);
  let isOwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isOwner === true;
  let isROwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isROwner === true;
  const userData = global.db?.user?.[userPhoneJid] || global.db?.user?.[ctx.sender];
  if (userData && userData.limit === undefined) {
    userData.limit = global.bot?.limit?.free || global.bot?.defaultLimit || 20;
  }
  if (userData?.ownerAcces === true) isOwner = true;
  let isPremium = Boolean(userData?.premium?.status || isOwner);
  if (userData && ctx.pushname && userData.name !== ctx.pushname) {
    userData.name = ctx.pushname;
  }
  ctx.sock = sock;
  ctx.sender = userPhoneJid;
  ctx.senderAlt = senderAlt;
  ctx.userPhoneJid = userPhoneJid;
  ctx.senderNumber = senderNumber;
  ctx.chat = chatId;
  ctx.id = chatId;
  ctx.isGroup = isGroup;
  ctx.isFromMe = isFromMe;
  ctx.isBot = isBot;
  ctx.botId = botId;
  ctx.botLid = botLid;
  ctx.isOwner = isOwner;
  ctx.isROwner = isROwner;
  ctx.isPremium = isPremium;
  ctx.user = userData;
  ctx.groupData = isGroup ? groupData : null;
  ctx.db = global.db;
  ctx.botJid = botJid;
  ctx.reply = async (content, opt = {}) => {
    const targetSend = ctx.isGroup ? ctx.chat : ctx.chat.endsWith("@lid") ? ctx.sender : ctx.chat;
    const text = typeof content === "string" ? content : content?.text || JSON.stringify(content);
    const safeQuote = sanitizeQuotedMessage(msg, targetSend, ctx.isGroup);
    try {
      return await sock.sendMessage(targetSend, {
        text: text,
        ...opt
      }, {
        quoted: opt?.quoted !== undefined ? opt.quoted : safeQuote
      });
    } catch (_) {
      try {
        return await sock.sendMessage(targetSend, {
          text: text,
          ...opt
        });
      } catch (err) {
        console.error(chalk.red("[REPLY FAILED]"), err?.message || err);
        return null;
      }
    }
  };
  await normalizeLidCtx(ctx, sock);
  let textBody = (ctx.selectedId || ctx.selectedRowId || typeof ctx.text === "string" && ctx.text.trim() || extractMessageText(ctx.rawMessage || msg?.message || msg) || "").trim();
  ctx.text = textBody;
  ctx.body = textBody;
  ctx.groupMetadata = null;
  ctx.participants = [];
  ctx.groupAdmins = [];
  ctx.isAdmin = false;
  ctx.isBotAdmin = false;
  if (isGroup) {
    try {
      const groupMeta = global.groupCache?.get(chatId)?.data || await sock.groupMetadata(chatId).catch(() => null);
      if (groupMeta) {
        ctx.groupMetadata = groupMeta;
        ctx.participants = groupMeta.participants || [];
        const adminParticipants = ctx.participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
        const adminJidSet = new Set();
        for (const p of adminParticipants) {
          const pj = await getParticipantPhoneJid(p, sock);
          if (pj) adminJidSet.add(pj);
        }
        ctx.groupAdmins = Array.from(adminJidSet);
        const senderIdentities = [userPhoneJid, senderAlt, sender, ctx.sender, ctx.userPhoneJid].filter(Boolean);
        ctx.isAdmin = adminParticipants.some(p => {
          const pIds = [p.id, p.lid, p.jid].filter(Boolean);
          return pIds.some(pId => senderIdentities.some(sId => Baileys.areJidsSameUser(pId, sId)));
        });
        ctx.isBotAdmin = adminParticipants.some(p => {
          const pj = p.phoneNumber ? `${p.phoneNumber}@s.whatsapp.net` : p.id;
          if (pj && Baileys.areJidsSameUser(pj, botJid)) return true;
          const pidNorm = p.id ? Baileys.jidNormalizedUser(p.id) : null;
          return pidNorm && botJidAlt && Baileys.areJidsSameUser(pidNorm, botJidAlt);
        });
        await normalizeLidCtx(ctx, sock);
        if (!isOwner) {
          isOwnerJid = checkIsOwner([ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, sender, userPhoneJid]);
          isOwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isOwner || userData?.ownerAcces === true;
          isROwner = isOwnerJid || isFromMe && global.bot?.selfbot === true || ctx.isROwner;
          isPremium = Boolean(userData?.premium?.status || isOwner);
          ctx.isOwner = isOwner;
          ctx.isROwner = isROwner;
          ctx.isPremium = isPremium;
        }
      }
    } catch (_) {}
  }
  const isAfkCmd = /^[!./#]?\s*(afk|away)(\s+.*)?$/i.test(textBody.trim());
  if (userData?.afk?.afkTime && !isAfkCmd) {
    const afkDuration = formatDuration(Date.now() - userData.afk.afkTime);
    const reason = userData.afk.reason || "Tanpa alasan";
    delete userData.afk;
    db.write(global.db);
    await ctx.reply(`👋 *Selamat Datang Kembali!*\n\nKamu telah berhenti AFK.\n📌 *Alasan Sebelumnya:* ${reason}\n⏱️ *Durasi:* ${afkDuration}`);
  }
  if (ctx.mentionedJid?.length > 0) {
    for (const jid of ctx.mentionedJid) {
      const phoneJid = await resolveLidToJid(decodeJid(jid), sock, null, ctx.participants || []);
      const targetUser = global.db?.user?.[phoneJid];
      if (targetUser?.afk?.afkTime) {
        const afkDuration = formatDuration(Date.now() - targetUser.afk.afkTime);
        await ctx.reply(`💤 *PENGGUNA SEDANG AFK*\n\nPengguna @${extractNum(phoneJid)} sedang AFK!\n📌 *Alasan:* ${targetUser.afk.reason || "Tanpa alasan"}\n⏱️ *Sejak:* ${afkDuration} yang lalu`, {
          mentions: [phoneJid]
        });
      }
    }
  }
  if (isGroup && groupData?.antilink && !isOwner && !ctx.isAdmin) {
    const isLink = /(https?:\/\/)?(chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}|whatsapp\.com\/channel\/[0-9A-Za-z]{20,24})/i.test(textBody);
    if (isLink) {
      if (ctx.isBotAdmin && typeof ctx.delete === "function") await ctx.delete().catch(() => {});
      return ctx.reply(`⚠️ *LINK TERDETEKSI!*\n\nMaaf @${senderNumber}, dilarang mengirim tautan grup/channel di sini!`, {
        mentions: [userPhoneJid]
      });
    }
  }
  const validBadwords = Array.isArray(badwordList) ? badwordList : [];
  if (isGroup && groupData?.antitoxic && !isOwner && !ctx.isAdmin && validBadwords.length > 0) {
    if (validBadwords.some(w => textBody.toLowerCase().includes(w))) {
      if (ctx.isBotAdmin && typeof ctx.delete === "function") await ctx.delete().catch(() => {});
      return ctx.reply(`⚠️ *KATA KASAR TERDETEKSI!*\n\nHarap jaga perkataanmu @${senderNumber}!`, {
        mentions: [userPhoneJid]
      });
    }
  }
  if (isGroup && groupData?.mute === true && !isOwner && !ctx.isAdmin) return;
  if (global.bot?.self === true && !isOwner) return;
  if (global.bot?.maintenance === true && !isOwner) {
    return ctx.reply("🛠️ *Bot sedang dalam pemeliharaan (Maintenance Mode).* Silakan coba beberapa saat lagi.");
  }
  if (userData?.banned === true && !isOwner) {
    return ctx.reply(`🚫 *Akses Ditolak!* Akun kamu sedang dibanned.\nAlasan: ${userData?.banReason || "Melanggar aturan penggunaan bot."}`);
  }
  const spamKey = `${userPhoneJid}_spam`;
  const lastSpamTime = userSpamMap.get(spamKey) || 0;
  if (Date.now() - lastSpamTime < 600 && !isOwner) {
    return;
  }
  userSpamMap.set(spamKey, Date.now());
  const beforeHandlers = cmd?.getBeforeHandlers?.() || [];
  for (const {
      fn
    }
    of beforeHandlers) {
    try {
      if (typeof fn === "function") {
        const stop = await fn(msg, {
          sock: sock,
          ctx: ctx,
          cmd: cmd,
          db: {
            data: global.db?.cmd || {}
          },
          isOwner: isOwner,
          isROwner: isROwner,
          isPremium: isPremium
        });
        if (stop) return;
      }
    } catch (e) {
      console.error(chalk.red("[BEFORE HANDLER ERROR]"), e.message);
    }
  }
  let command = null;
  const groupPrefix = isGroup && groupData?.prefix ? [groupData.prefix] : null;
  const prefixConfig = groupPrefix || global.bot?.prefix || global.bot?.defaultPrefix || ["!", ".", "/", "#"];
  let matchedPrefix = null;
  if (prefixConfig instanceof RegExp) {
    matchedPrefix = textBody.match(prefixConfig)?.[0] || null;
  } else if (Array.isArray(prefixConfig)) {
    matchedPrefix = prefixConfig.find(p => textBody.startsWith(p)) || null;
  } else if (typeof prefixConfig === "string" && textBody.startsWith(prefixConfig)) {
    matchedPrefix = prefixConfig;
  }
  if (matchedPrefix) {
    const rawWithoutPrefix = textBody.slice(matchedPrefix.length).trim();
    const parts = rawWithoutPrefix.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const cmdName = (parts[0] || "").toLowerCase();
    const findCmd = cmd?.getCommand?.(cmdName);
    if (findCmd) {
      ctx.prefix = matchedPrefix;
      ctx.cmd = cmdName;
      ctx.command = cmdName;
      ctx.args = parts.slice(1);
      ctx.query = rawWithoutPrefix.slice((parts[0] || "").length).trim();
      command = findCmd;
    }
  }
  if (!command && (global.bot?.noprefix || !matchedPrefix) && textBody) {
    const parts = textBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const firstWord = (parts[0] || "").toLowerCase();
    const directCmd = cmd?.getCommand?.(firstWord);
    if (directCmd) {
      ctx.prefix = "";
      ctx.cmd = firstWord;
      ctx.command = firstWord;
      ctx.args = parts.slice(1);
      ctx.query = textBody.slice((parts[0] || "").length).trim();
      command = directCmd;
    }
  }
  if (!command && textBody) {
    command = cmd?.getCommandByRegex?.(textBody);
    if (command) {
      const parts = textBody.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
      ctx.cmd = command.name || parts[0]?.toLowerCase() || "";
      ctx.command = ctx.cmd;
      ctx.args = parts.slice(1);
      ctx.query = textBody;
    }
  }
  if (!ctx.cmd || !command) return;
  if (global.bot?.autoRead !== false) sock.readMessages([msg.key]).catch(() => {});
  if (global.bot?.autoTyping) sock.sendPresenceUpdate("composing", chatId).catch(() => {});
  const cdTime = (command.cooldown || global.bot?.cooldown || 3) * 1e3;
  const userCdKey = `${userPhoneJid}_${command.name || ctx.cmd}`;
  const now = Date.now();
  if (cooldowns.has(userCdKey) && !isOwner && !ctx.isEdited) {
    const expirationTime = cooldowns.get(userCdKey) + cdTime;
    if (now < expirationTime) {
      const timeLeft = ((expirationTime - now) / 1e3).toFixed(1);
      return ctx.reply(`⏳ Harap tunggu *${timeLeft}s* sebelum memakai command ini lagi.`);
    }
  }
  cooldowns.set(userCdKey, now);
  setTimeout(() => cooldowns.delete(userCdKey), cdTime);
  const time = new Date().toLocaleTimeString("id-ID", {
    hour12: false
  });
  const badge = isGroup ? chalk.bgHex("#0284C7").bold(" GRP ") : chalk.bgHex("#7C3AED").bold(" PVT ");
  const editBadge = ctx.isEdited ? chalk.bgHex("#EC4899").bold(" [EDIT] ") : "";
  const userName = ctx.pushname || ctx.pushName || "Unknown";
  const userTag = chalk.hex("#F59E0B")(userName) + chalk.hex("#64748B")(` (${senderNumber})`);
  const groupSubject = ctx.groupMetadata?.subject || groupData?.subject || "Group";
  const locationTag = isGroup ? chalk.hex("#38BDF8")(`[${groupSubject}]`) : chalk.hex("#A855F7")("[Private Chat]");
  const cmdFormatted = chalk.hex("#10B981").bold(`${ctx.prefix || ""}${ctx.cmd}`);
  console.log(`${chalk.hex("#475569")(`[${time}]`)} ${badge}${editBadge} ${chalk.hex("#EF4444")("⚡")} ${cmdFormatted} ${chalk.hex("#64748B")("from")} ${userTag} ${chalk.hex("#64748B")("in")} ${locationTag}`);
  const msgs = global.bot?.msg || {};
  if (command.owner && !isOwner) return ctx.reply(msgs.owner || "❌ Perintah ini hanya untuk Owner Bot!");
  if (command.premium && !isPremium) return ctx.reply(msgs.premium || "💎 Perintah ini khusus untuk *Pengguna Premium*!");
  if (command.register && !isOwner) {
    const isRegistered = userData?.registered === true || userData?.name && userData.name !== senderNumber;
    if (!isRegistered) return ctx.reply(msgs.unreg || "❌ Anda belum terdaftar!\nKetik *.register <nama>* untuk mendaftar.");
  }
  if (command.group && !isGroup) return ctx.reply(msgs.group || "❌ Hanya bisa digunakan di dalam grup!");
  if (command.private && isGroup) return ctx.reply(msgs.private || "❌ Hanya bisa digunakan di chat pribadi!");
  if (command.admin && !ctx.isAdmin && !isOwner) return ctx.reply(msgs.admin || "❌ Hanya untuk Admin Grup!");
  if (command.botAdmin && !ctx.isBotAdmin) return ctx.reply(msgs.botAdmin || "❌ Jadikan bot sebagai Admin Grup terlebih dahulu!");
  if (command.nsfw && isGroup && groupData?.nsfw !== true && !isOwner) {
    return ctx.reply(`🔞 *FITUR NSFW DINONAKTIFKAN*\n\nMode konten dewasa (+18) sedang nonaktif di grup ini.`);
  }
  if (command.limit && !isOwner && !isPremium) {
    const userLimit = userData?.limit ?? 0;
    if (userLimit <= 0) {
      return ctx.reply(msgs.limit || "❌ *Limit harian kamu sudah habis!*\n\n📌 Limit akan direset setiap pukul 00.00 WIB.\n💎 Upgrade ke *Premium* untuk akses tanpa batas.");
    }
    userData.limit = userLimit - 1;
    db.write(global.db);
  }
  const execFn = command.execute || command.run || command.handler || command.default || (typeof command === "function" ? command : null);
  if (!execFn || typeof execFn !== "function") {
    console.error(chalk.redBright(`[EXEC ERROR] Command "${ctx.cmd}" tidak memiliki handler fungsi yang valid.`));
    return ctx.reply(`❌ Format plugin *${ctx.cmd}* tidak valid (fungsi run/execute tidak ditemukan).`);
  }
  try {
    const extra = {
      sock: sock,
      msg: msg,
      ctx: ctx,
      args: ctx.args || [],
      text: ctx.query || "",
      query: ctx.query || "",
      command: ctx.cmd,
      prefix: ctx.prefix || "",
      isOwner: isOwner,
      isROwner: isROwner,
      isPremium: isPremium,
      isAdmin: ctx.isAdmin,
      isBotAdmin: ctx.isBotAdmin
    };
    await execFn.call(command, sock, ctx, msg, extra);
    global.db.stats = global.db.stats || {};
    global.db.stats[ctx.cmd] = (global.db.stats[ctx.cmd] || 0) + 1;
    global.db.totalHits = (global.db.totalHits || 0) + 1;
    if (userData) {
      const multiplier = isPremium ? 2 : 1;
      userData.exp = (userData.exp || 0) + (Math.floor(Math.random() * 15) + 5) * multiplier;
      userData.money = (userData.money || 0) + (Math.floor(Math.random() * 10) + 2) * multiplier;
      db.write(global.db);
    }
  } catch (err) {
    console.error(chalk.redBright(`[COMMAND ERROR : ${ctx.cmd}]`), err);
    return ctx.reply(`⚠️ Terjadi kesalahan saat mengeksekusi perintah:\n\`\`\`${err?.message || err}\`\`\``);
  }
  if (userData && groupData?.autolevelup !== false) {
    try {
      userData.level = Number(userData.level) || 1;
      userData.exp = Number(userData.exp) || 0;
      userData.hpMax = Number(userData.hpMax) || 100;
      userData.manaMax = Number(userData.manaMax) || 50;
      userData.atk = Number(userData.atk) || 10;
      userData.def = Number(userData.def) || 5;
      let needed = typeof getExpNeeded === "function" ? getExpNeeded(userData.level) : 1e3;
      let hasLeveledUp = false;
      while (needed > 0 && userData.exp >= needed) {
        hasLeveledUp = true;
        const oldLevel = userData.level;
        userData.exp -= needed;
        userData.level += 1;
        const newLevel = userData.level;
        userData.hpMax += 20;
        userData.manaMax += 10;
        userData.atk += 3;
        userData.def += 2;
        userData.hp = userData.hpMax;
        userData.mana = userData.manaMax;
        const quotedObj = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof contactQuoted === "function" ? contactQuoted(ctx) : msg?.key ? sanitizeQuotedMessage(msg, chatId, isGroup) : undefined;
        const playerName = userData.name || ctx.pushname || ctx.pushName || senderNumber;
        let avatarUrl = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
        try {
          avatarUrl = await sock.profilePictureUrl(userPhoneJid, "image");
        } catch {}
        const cardBuffer = await generateLevelUpCard({
          avatar: avatarUrl,
          username: playerName,
          currentLevel: oldLevel,
          nextLevel: newLevel,
          userData: userData
        });
        let finalThumbnail = await resizeImage(cardBuffer, 300, 150, "image/jpeg").catch(() => null);
        if (!finalThumbnail && avatarUrl) {
          finalThumbnail = await resizeImage(avatarUrl, 300, 150, "image/jpeg").catch(() => null);
        }
        const rankName = getRankTitle(newLevel);
        const bodyText = `╭─〔 *LEVEL UP EVOLUTION* 〕─⬿\n` + `│ ✨ Selamat *${playerName}*!\n` + `│ Naik dari Level *${oldLevel}* ➔ *${newLevel}*!\n` + `│ 🎖️ Rank: *${rankName}*\n` + `├────────────────────────\n` + `│ 💚 • HP Max : +20 (${userData.hpMax})\n` + `│ 💙 • Mana   : +10 (${userData.manaMax})\n` + `│ ⚔️ • ATK    : +3 (${userData.atk})\n` + `│ 🛡️ • DEF    : +2 (${userData.def})\n` + `╰─〔 ${global.bot?.name || "WhatsApp"} RPG Engine 〕─⬿`;
        const footerText = `${rankName} • Player Level Up`;
        const buttons = [{
          name: "quick_reply",
          display_text: "👤 Cek Profil",
          id: `${ctx.prefix || "."}profile`
        }, {
          name: "quick_reply",
          display_text: "🎒 Inventory",
          id: `${ctx.prefix || "."}inv`
        }];
        const options = {
          location: {
            degreesLatitude: 0,
            degreesLongitude: 0,
            name: `✦ LEVEL UP: Lv. ${oldLevel} ➔ Lv. ${newLevel} ✦`,
            address: `👤 ${playerName} • Status: ${rankName}`,
            jpegThumbnail: finalThumbnail || undefined
          },
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Menu Karakter RPG",
              button_title: "Opsi Level"
            }
          },
          quoted: quotedObj
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options).catch(() => {
            sock.sendMessage(chatId, {
              text: bodyText
            }, {
              quoted: quotedObj
            }).catch(() => {
              sock.sendMessage(chatId, {
                text: bodyText
              }).catch(() => {});
            });
          });
        } else {
          await sock.sendMessage(chatId, {
            text: bodyText
          }, {
            quoted: quotedObj
          }).catch(() => {
            sock.sendMessage(chatId, {
              text: bodyText
            }).catch(() => {});
          });
        }
        needed = typeof getExpNeeded === "function" ? getExpNeeded(userData.level) : 1e3;
      }
      if (hasLeveledUp) db.write(global.db);
    } catch (lvlErr) {
      console.error(chalk.red("[RPG LEVEL UP ERROR]"), lvlErr.message);
    }
  }
}