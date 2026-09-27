import fs from "fs";
import path from "path";
import pino from "pino";
import chalk from "chalk";
import QRCode from "qrcode";
import {
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  proto
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import {
  SerializeMessage,
  decodeJid,
  extractNum
} from "./serialize.js";
import {
  UpsertMsgHandle
} from "./handler.js";
const JADIBOT_DIR = path.resolve("./session_jadibot");
const MAX_ATTEMPTS = 3;

function ensureJadibotDir() {
  if (!fs.existsSync(JADIBOT_DIR)) {
    fs.mkdirSync(JADIBOT_DIR, {
      recursive: true
    });
  }
}
export function isSessionRegistered(sessionPath) {
  try {
    const credsPath = path.join(sessionPath, "creds.json");
    if (!fs.existsSync(credsPath)) return false;
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
    return Boolean(creds && (creds.registered === true || creds.me?.id));
  } catch (_) {
    return false;
  }
}
global.jadiBots = global.jadiBots || new Map();

function closeSocketInstance(instance) {
  if (!instance || !instance.sock) return;
  try {
    instance.sock.ev.removeAllListeners();
    if (instance.sock.ws) {
      instance.sock.ws.close();
      instance.sock.ws.terminate?.();
    }
    instance.sock.end?.(undefined);
  } catch (_) {}
}
export async function startJadiBot(parentSock, senderJid, options = {}) {
  ensureJadibotDir();
  const cleanNum = extractNum(senderJid);
  const targetPhoneJid = `${cleanNum}@s.whatsapp.net`;
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  const mode = (options.mode || "pair").toLowerCase();
  if (global.jadiBots.has(cleanNum)) {
    closeSocketInstance(global.jadiBots.get(cleanNum));
    global.jadiBots.delete(cleanNum);
  }
  const {
    version
  } = await fetchLatestBaileysVersion();
  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(sessionPath);
  const sock = makeWASocket({
    version: version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({
        level: "silent"
      }))
    },
    browser: Browsers.macOS("Chrome"),
    logger: pino({
      level: "silent"
    }),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 25e3,
    connectTimeoutMs: 3e4,
    defaultQueryTimeoutMs: 3e4,
    retryRequestDelayMs: 200,
    fireInitQueries: true,
    emitOwnEvents: true,
    getMessage: async key => {
      if (!key?.id) return undefined;
      const cached = global.msgStore?.get(key.id);
      if (cached) {
        const raw = cached.rawMessage || cached.message || cached.msg?.message || cached.msg;
        if (raw) return proto.Message.fromObject(raw);
      }
      return undefined;
    }
  });
  const enrichSubBotUser = () => {
    if (!sock.user && state.creds?.me) sock.user = {
      ...state.creds.me
    };
    if (sock.user) {
      const rawId = sock.user.id || "";
      const cleanJid = decodeJid(rawId);
      const userNum = extractNum(cleanJid);
      sock.user.id = rawId;
      sock.user.jid = cleanJid;
      sock.user.number = userNum;
      sock.user.phone = userNum;
      sock.user.name = sock.user.name || state.creds?.me?.name || `SubBot-${cleanNum}`;
    }
  };
  enrichSubBotUser();
  const botInstance = {
    sock: sock,
    userJid: targetPhoneJid,
    number: cleanNum,
    startTime: Date.now(),
    status: "CONNECTING",
    mode: mode,
    speed: 120,
    qrAttempts: 0,
    pairAttempts: 0
  };
  const isRegistered = Boolean(state.creds && (state.creds.registered === true || state.creds.me?.id));
  if (!isRegistered && mode === "pair" && typeof options.onPairingCode === "function") {
    setTimeout(async () => {
      try {
        botInstance.pairAttempts += 1;
        if (botInstance.pairAttempts > MAX_ATTEMPTS) {
          console.log(chalk.yellow(`[JADIBOT PAIR MAX ATTEMPTS: ${cleanNum}] Batas 3x percobaan pairing tercapai.`));
          closeSocketInstance(botInstance);
          deleteJadiBot(cleanNum);
          await parentSock.sendMessage(targetPhoneJid, {
            text: `🛑 *Batas Percobaan Habis (3/3)*\n\nPenautan Jadibot dihentikan karena tidak ada respon setelah 3x percobaan pairing. Ketik *.jadibot pair* jika ingin mencoba lagi.`
          }).catch(() => {});
          return;
        }
        const code = await sock.requestPairingCode(cleanNum);
        options.onPairingCode(code, botInstance.pairAttempts, MAX_ATTEMPTS);
      } catch (err) {
        console.error(chalk.red(`[JADIBOT PAIR ERROR: ${cleanNum}]`), err.message);
      }
    }, 2500);
  }
  sock.ev.on("creds.update", async () => {
    await saveCreds();
    enrichSubBotUser();
  });
  sock.ev.on("connection.update", async ({
    connection,
    lastDisconnect,
    qr
  }) => {
    if (qr && !isRegistered && mode === "qr" && typeof options.onQR === "function") {
      botInstance.qrAttempts += 1;
      if (botInstance.qrAttempts > MAX_ATTEMPTS) {
        console.log(chalk.yellow(`[JADIBOT QR MAX ATTEMPTS: ${cleanNum}] Batas 3x QR code tercapai.`));
        closeSocketInstance(botInstance);
        deleteJadiBot(cleanNum);
        await parentSock.sendMessage(targetPhoneJid, {
          text: `🛑 *Batas Percobaan Habis (3/3)*\n\nQR Code tidak di-scan setelah 3x percobaan. Sesi dibatalkan otomatis untuk menghemat sumber daya server. Ketik *.jadibot qr* untuk memulai ulang.`
        }).catch(() => {});
        return;
      }
      try {
        const qrBuffer = await QRCode.toBuffer(qr, {
          scale: 8,
          margin: 2
        });
        options.onQR(qrBuffer, botInstance.qrAttempts, MAX_ATTEMPTS);
      } catch (err) {
        console.error(chalk.red(`[JADIBOT QR ERROR: ${cleanNum}]`), err.message);
      }
    }
    if (connection === "open") {
      enrichSubBotUser();
      botInstance.status = "ONLINE";
      botInstance.startTime = Date.now();
      botInstance.qrAttempts = 0;
      botInstance.pairAttempts = 0;
      global.jadiBots.set(cleanNum, botInstance);
      const metaPath = path.join(sessionPath, "meta.json");
      let metaData = {
        connectedAt: Date.now(),
        number: cleanNum,
        platform: "WhatsApp Web (Baileys Multi-Device)"
      };
      if (fs.existsSync(metaPath)) {
        try {
          const oldMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          metaData.connectedAt = oldMeta.connectedAt || metaData.connectedAt;
        } catch (_) {}
      }
      fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
      const botName = sock.user?.name || `Sub-Bot (+${cleanNum})`;
      console.log(chalk.greenBright(`\n[ JADIBOT CONNECTED ] ${botName} Berhasil Aktif & Masuk List!`));
      await sock.sendPresenceUpdate("available").catch(() => {});
      await parentSock.sendMessage(targetPhoneJid, {
        text: `🎉 *SELAMAT JADIBOT BERHASIL AKTIF!*\n\n` + `• *Nomor Bot:* +${cleanNum}\n` + `• *Status:* 🟢 ONLINE (24/7)\n` + `• *Waktu Join:* ${new Date().toLocaleString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB\n` + `• *Fitur:* Seluruh perintah & fungsi bot aktif.\n\n` + `_Ketik *.menu* di bot ini untuk mulai menggunakannya._`
      }).catch(() => {});
    }
    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode ?? (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : undefined);
      console.log(chalk.yellow(`[ JADIBOT DISCONNECTED: ${cleanNum} ] Status code: ${statusCode}`));
      if (botInstance.status === "ONLINE") {
        botInstance.status = "OFFLINE";
      }
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
        console.log(chalk.red(`[ JADIBOT LOGGED OUT: ${cleanNum} ] Menghapus sesi...`));
        deleteJadiBot(cleanNum);
        await parentSock.sendMessage(targetPhoneJid, {
          text: `⚠️ *Jadibot Terputus!* Sesi kamu telah keluar dari WhatsApp. Ketik *.jadibot* jika ingin menautkan kembali.`
        }).catch(() => {});
        return;
      }
      if (isSessionRegistered(sessionPath)) {
        setTimeout(() => {
          if (fs.existsSync(sessionPath)) {
            startJadiBot(parentSock, targetPhoneJid, options);
          }
        }, 4e3);
      } else {
        deleteJadiBot(cleanNum);
      }
    }
  });
  sock.ev.on("messages.upsert", async ({
    messages
  }) => {
    for (const msg of messages) {
      try {
        const jid = msg.key?.remoteJid;
        if (!jid || jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;
        let rawM = msg.message;
        if (rawM?.ephemeralMessage) rawM = rawM.ephemeralMessage.message;
        if (rawM?.viewOnceMessage) rawM = rawM.viewOnceMessage.message;
        if (rawM?.viewOnceMessageV2) rawM = rawM.viewOnceMessageV2.message;
        if (rawM?.documentWithCaptionMessage) rawM = rawM.documentWithCaptionMessage.message;
        if (msg.key?.id && rawM) {
          global.msgStore.set(msg.key.id, {
            rawMessage: rawM,
            message: rawM,
            msg: msg,
            sender: msg.key.participant || msg.key.remoteJid,
            timestamp: Date.now()
          });
        }
        if (global.bot?.autoRead !== false) {
          sock.readMessages([msg.key]).catch(() => {});
        }
        if (msg.key?.participant && msg.key?.participant.endsWith("@lid")) {
          const rawSender = msg.participant || msg.key.remoteJid;
          if (rawSender && !rawSender.endsWith("@lid")) {
            global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(rawSender));
          }
        }
        const ctx = await SerializeMessage(sock, msg);
        if (!ctx) continue;
        ctx.loader = global.loader;
        ctx.isJadiBot = true;
        ctx.parentSock = parentSock;
        UpsertMsgHandle(sock, msg, ctx, {
          cmd: global.loader
        }).catch(e => {
          console.error(chalk.red("[JADIBOT HANDLER ERROR]"), e.message);
        });
      } catch (e) {
        console.error(chalk.red("[JADIBOT MSG ERROR]"), e.message);
      }
    }
  });
  return botInstance;
}
export async function deleteJadiBot(number) {
  const cleanNum = String(number).replace(/\D/g, "");
  const sessionPath = path.join(JADIBOT_DIR, cleanNum);
  if (global.jadiBots.has(cleanNum)) {
    closeSocketInstance(global.jadiBots.get(cleanNum));
    global.jadiBots.delete(cleanNum);
  }
  if (fs.existsSync(sessionPath)) {
    try {
      fs.rmSync(sessionPath, {
        recursive: true,
        force: true
      });
      return true;
    } catch (_) {
      return false;
    }
  }
  return true;
}
export function stopAllJadiBots() {
  if (!global.jadiBots || !global.jadiBots.size) return;
  for (const [num, bot] of global.jadiBots.entries()) {
    try {
      closeSocketInstance(bot);
    } catch (_) {}
  }
  global.jadiBots.clear();
}
export function getJadiBotsList() {
  ensureJadibotDir();
  const sessionsOnDisk = fs.readdirSync(JADIBOT_DIR).filter(f => {
    const full = path.join(JADIBOT_DIR, f);
    return fs.statSync(full).isDirectory() && isSessionRegistered(full);
  });
  return sessionsOnDisk.map(num => {
    const fullPath = path.join(JADIBOT_DIR, num);
    const isLive = global.jadiBots.has(num) && global.jadiBots.get(num).status === "ONLINE";
    const instance = global.jadiBots.get(num);
    let meta = {};
    const metaPath = path.join(fullPath, "meta.json");
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (_) {}
    }
    const connectedAt = meta.connectedAt || instance?.startTime || null;
    return {
      number: num,
      jid: `${num}@s.whatsapp.net`,
      status: isLive ? "ONLINE" : "OFFLINE",
      uptime: isLive && instance?.startTime ? Date.now() - instance.startTime : 0,
      connectedAt: connectedAt,
      platform: meta.platform || "WhatsApp Web (Baileys Multi-Device)",
      speed: isLive ? instance?.speed || 120 : 0
    };
  });
}
export async function initAllJadiBots(parentSock) {
  ensureJadibotDir();
  const list = getJadiBotsList();
  if (!list.length) return;
  console.log(chalk.cyanBright(`[ JADIBOT ] Memulihkan ${list.length} sesi Jadibot terdaftar secara bertahap...`));
  for (const bot of list) {
    try {
      await startJadiBot(parentSock, bot.jid, {
        mode: "pair"
      });
      await new Promise(r => setTimeout(r, 2500));
    } catch (e) {
      console.error(chalk.red(`[ JADIBOT RESTORE ERROR: ${bot.number} ]`), e.message);
    }
  }
}