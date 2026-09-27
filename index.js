import readline from "readline";
import pino from "pino";
import qrcode from "qrcode-terminal";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import JSZip from "jszip";
import {
  makeWASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
  DisconnectReason,
  generateWAMessageFromContent,
  proto,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import chalk from "chalk";
import "./core/config.js";
import {
  SerializeMessage,
  getMessagePayload,
  downloadMediaNode,
  decodeJid,
  extractNum,
  resolveLidToJid,
  resizeImage,
  formatCtaButtons,
  safeRelayInteractive
} from "./core/serialize.js";
import {
  CommandLoader
} from "./core/loader.js";
import {
  UpsertMsgHandle
} from "./core/handler.js";
import {
  initAllJadiBots
} from "./core/jadibot.js";
import db from "./data/db.js";
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
global.msgStore = global.msgStore || new Map();
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.groupCache = global.groupCache || new Map();
global.lastConnectNotice = global.lastConnectNotice || 0;
global.botStartTime = Date.now();
let currentSock = null;
const safeExit = async signal => {
  console.log(chalk.yellowBright(`\n[ SYSTEM ] Sinyal ${signal} diterima. Menyimpan data & mematikan bot...`));
  try {
    if (global.db) db.write(global.db);
    if (currentSock) {
      currentSock.ev?.removeAllListeners();
      try {
        currentSock.ws?.close();
      } catch (_) {}
      try {
        currentSock.end?.(undefined);
      } catch (_) {}
    }
  } catch (_) {}
  process.exit(0);
};
process.on("SIGINT", () => safeExit("SIGINT"));
process.on("SIGTERM", () => safeExit("SIGTERM"));
process.on("uncaughtException", err => {
  console.error(chalk.redBright("[ ANTI-CRASH Exception ]:"), err?.message || err);
});
process.on("unhandledRejection", reason => {
  console.error(chalk.redBright("[ ANTI-CRASH Rejection ]:"), reason?.message || reason);
});
const ask = prompt => new Promise(resolve => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(prompt, ans => {
    rl.close();
    resolve(ans);
  });
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

function formatRuntime(seconds) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + "h " : ""}${h > 0 ? h + "j " : ""}${m > 0 ? m + "m " : ""}${s}d`;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
async function getFastGroupMetadata(sock, jid) {
  const cached = global.groupCache.get(jid);
  if (cached && Date.now() - cached.time < 5 * 60 * 1e3) {
    return cached.data;
  }
  const meta = await sock.groupMetadata(jid).catch(() => null);
  if (meta) {
    global.groupCache.set(jid, {
      data: meta,
      time: Date.now()
    });
  }
  return meta;
}
async function createSessionZip(sessionDir) {
  try {
    if (!fs.existsSync(sessionDir)) return null;
    const zip = new JSZip();

    function addFiles(currentPath, zipFolder) {
      const files = fs.readdirSync(currentPath);
      for (const file of files) {
        if (file.endsWith(".lock") || file.includes(".tmp")) continue;
        const fullPath = path.join(currentPath, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addFiles(fullPath, zipFolder.folder(file));
        } else {
          try {
            zipFolder.file(file, fs.readFileSync(fullPath));
          } catch (_) {}
        }
      }
    }
    addFiles(sessionDir, zip);
    return await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 4
      }
    });
  } catch (err) {
    return null;
  }
}
const getTargetOwnerJid = sock => {
  const rawOwner = Array.isArray(global.bot?.owner) ? global.bot.owner[0] : global.bot?.owner;
  if (!rawOwner) return sock.user?.jid;
  const cleanNum = String(rawOwner).replace(/\D/g, "");
  return cleanNum ? `${cleanNum}@s.whatsapp.net` : sock.user?.jid;
};
async function generateWelcomeCard({
  group_avatar,
  group_name = "Grup WhatsApp",
  status_dot = "On",
  avatar,
  status = "ACTIVE",
  userid = "UID-786B-44F9",
  usertype = "netizen",
  title = "Welcome",
  username = "User",
  message = "Welcome to this server!",
  foot_up = "Terhubung ke Jaringan WhatsApp",
  foot_end = `Hak Cipta © ${new Date().getFullYear()}, ${global.bot?.name || "Cyberdyne Systems"}`,
  template = 1
}) {
  try {
    const payload = {
      group_avatar: group_avatar || "https://files.catbox.moe/g2e6i5.jpg",
      group_name: group_name,
      status_dot: status_dot,
      avatar: avatar || "https://files.catbox.moe/8ugr9a.jpg",
      status: status,
      userid: userid,
      usertype: usertype,
      title: title,
      username: username,
      message: message,
      foot_up: foot_up,
      foot_end: foot_end,
      template: template
    };
    const response = await axios.post("https://wudysoft.my.id/api/maker/welcome/v1", payload, {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 1e4
    });
    return Buffer.from(response.data);
  } catch (_) {
    return null;
  }
}
async function sendGroupCtaMessage(sock, jid, {
    title = "",
    subtitle = "",
    body = "",
    footer = "",
    media = null,
    buttons = [],
    mentions = []
  }) {
    const targetJid = decodeJid(jid);
    try {
      let thumbnailBuffer = null;
      if (media) {
        if (Buffer.isBuffer(media)) {
          thumbnailBuffer = await resizeImage(media, 300, 150, "image/jpeg").catch(() => media);
        } else if (typeof media === "string" && /^https?:\/\//i.test(media)) {
          thumbnailBuffer = await resizeImage(media, 300, 150, "image/jpeg").catch(() => null);
        }
      }
      const messageContent = proto.Message.fromObject({
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({
                text: body
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: footer
              }),
              header: proto.Message.InteractiveMessage.Header.create({
                title: title,
                subtitle: subtitle,
                hasMediaAttachment: true,
                locationMessage: {
                  degreesLatitude: 0,
                  degreesLongitude: 0,
                  name: title || global.bot?.name || "Notification",
                  address: subtitle || "Group Notification",
                  jpegThumbnail: thumbnailBuffer || undefined
                }
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: formatCtaButtons(buttons),
                messageParamsJson: JSON.stringify({
                  bottom_sheet: {
                    in_thread_buttons_limit: 2,
                    list_title: "Menu Grup",
                    button_title: "Opsi Cepat"
                  }
                })
              }),
              contextInfo: {
                mentionedJid: mentions
              }
            })
          }
        }
      });
      const msgsr = await generateWAMessageFromContent(targetJid, messageContent, {
        ephemeralExpiration: WA_DEFAULT_EPHEMERAL
      });
      await safeRelayInteractive(sock, targetJid, msgsr.message, {
        messageId: msgsr.key.id
      });
      return msgsr;
    } catch (_) {
      return await sock.sendMessage(targetJid, {
        text: `*〔 ${title} 〕*\n\n${body}\n\n_${footer}_`,
        mentions: mentions
      }).catch(() => null);
    }
  }
  (async () => {
    const loader = new CommandLoader({
      dir: path.join(process.cwd(), "./plugins"),
      logger: {
        log: console.log,
        info: console.log,
        error: console.error,
        warn: console.warn
      }
    });
    global.loader = loader;
    await loader.loadAll();
    loader.watch();
    const total = Object.values(loader.getCommandsByCategory()).flat().length;
    console.clear();
    console.log(`
  ${chalk.bold.hex("#F43F5E")(global.bot?.name || "WUDYSOFT BOT")} ${chalk.hex("#94A3B8")(`v${global.bot?.versions || "2.0.0"}`)}
  ${chalk.hex("#38BDF8")("•")} ${chalk.white("Status Online")}   : ${chalk.greenBright("SELALU AKTIF [Online 24/7]")}
  ${chalk.hex("#38BDF8")("•")} ${chalk.white("Centang Dua")}    : ${chalk.greenBright("AUTO ACK READ [Aktif Instan]")}
  ${chalk.hex("#38BDF8")("•")} ${chalk.white("Engine Sesi")}     : ${chalk.greenBright("STABLE [Anti-Crash & Jadibot Ready]")}
  ${chalk.hex("#38BDF8")("•")} ${chalk.white("Total Command")}  : ${chalk.yellow(total)} Plugins Terdaftar
`);
    const saved = db.read();
    global.db = {
      user: saved?.user || {},
      group: saved?.group || {},
      cmd: saved?.cmd || {},
      stats: saved?.stats || {},
      totalHits: saved?.totalHits || 0
    };
    let selectedPairing = null;
    const start = async () => {
      if (currentSock) {
        try {
          currentSock.ev.removeAllListeners();
          if (currentSock.ws) currentSock.ws.close();
          currentSock.end?.(undefined);
        } catch (_) {}
        currentSock = null;
      }
      const {
        version
      } = await fetchLatestBaileysVersion();
      const sessionDir = path.join(process.cwd(), "session");
      const {
        state,
        saveCreds
      } = await useMultiFileAuthState(sessionDir);
      const isRegistered = Boolean(state.creds && (state.creds.registered === true || Boolean(state.creds.me?.id) || Boolean(state.creds.account)));
      if (!isRegistered && selectedPairing === null) {
        console.log(chalk.whiteBright("\n [ Pairing Configuration ]"));
        const mode = await ask(chalk.cyan("  > ") + chalk.whiteBright("Gunakan mode pairing (kode)? ") + chalk.greenBright("[yes/no]: "));
        selectedPairing = mode.trim().toLowerCase() === "yes";
      }
      const pairing = !isRegistered && (selectedPairing ?? false);
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
      currentSock = sock;
      const enrichSockUser = () => {
        if (!sock.user && state.creds?.me) sock.user = {
          ...state.creds.me
        };
        if (sock.user) {
          const rawId = sock.user.id || "";
          const cleanJid = decodeJid(rawId);
          const cleanNum = extractNum(cleanJid);
          const cleanLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
          const botName = sock.user.name || state.creds?.me?.name || global.bot?.name || "Wudysoft";
          sock.user.id = rawId;
          sock.user.jid = cleanJid;
          sock.user.phoneJid = cleanJid;
          sock.user.lid = cleanLid;
          sock.user.number = cleanNum;
          sock.user.phone = cleanNum;
          sock.user.name = botName;
          sock.user.pushname = botName;
          sock.user.pushName = botName;
          if (cleanLid && cleanJid) global.lidPhoneCache.set(cleanLid, cleanJid);
        }
      };
      enrichSockUser();
      if (pairing) {
        console.log(chalk.whiteBright("\n [ Pairing WhatsApp ]"));
        const number = await ask(chalk.cyan("  > ") + chalk.whiteBright("Masukkan nomor WhatsApp ") + chalk.gray("(contoh: 628xxx / 08xxx)") + chalk.whiteBright(": "));
        let cleanNumber = number.replace(/\D/g, "");
        if (cleanNumber.startsWith("0")) cleanNumber = "62" + cleanNumber.slice(1);
        try {
          const code = await sock.requestPairingCode(cleanNumber);
          console.log(chalk.whiteBright("\n ╭───────────────────────────────╮"));
          console.log(chalk.whiteBright(" │ ") + chalk.yellowBright("KODE PAIRING ANDA: ") + chalk.bold.cyanBright(code) + chalk.whiteBright("  │"));
          console.log(chalk.whiteBright(" ╰───────────────────────────────╯\n"));
        } catch (e) {
          console.error(chalk.redBright("[ PAIRING ERROR ]"), e.message);
        }
      }
      let isRestarting = false;
      const reconnect = async (delayTime = 2e3) => {
        if (isRestarting) return;
        isRestarting = true;
        detachAllEvents();
        await sleep(delayTime);
        return start();
      };
      const onCredsUpdate = async () => {
        await saveCreds();
        enrichSockUser();
      };
      const onConnectionUpdate = async ({
        connection,
        lastDisconnect,
        qr
      }) => {
        if (qr && !isRegistered && !pairing) {
          console.log(chalk.whiteBright("\n [ Scan QR Code ]"));
          qrcode.generate(qr, {
            small: true
          });
        }
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode ?? (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output?.statusCode : undefined);
          console.log(chalk.gray(`\n [ DISCONNECT ] Status code: ${statusCode}`));
          if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
            console.log(chalk.redBright("\n [ LOGGED OUT ] Sesi dicabut. Menghapus folder session..."));
            try {
              fs.rmSync(sessionDir, {
                recursive: true,
                force: true
              });
            } catch (_) {}
            process.exit(1);
          }
          if (statusCode === DisconnectReason.connectionReplaced) return reconnect(5e3);
          if (statusCode === DisconnectReason.restartRequired) return reconnect(1e3);
          return reconnect(2500);
        }
        if (connection === "open") {
          isRestarting = false;
          enrichSockUser();
          await sock.sendPresenceUpdate("available").catch(() => {});
          const botPhone = sock.user?.number || sock.user?.jid?.split("@")[0] || "Unknown";
          const botPushName = sock.user?.name || global.bot?.name || "Bot";
          console.log(chalk.greenBright("\n [ CONNECTED ]") + " Status: " + chalk.bold.greenBright("ONLINE (Centang 2 Aktif)") + chalk.hex("#64748B")(` (+${botPhone})`));
          if (typeof initAllJadiBots === "function") {
            initAllJadiBots(sock).catch(e => {
              console.error(chalk.red("[JADIBOT INIT ERROR]"), e.message);
            });
          }
          setImmediate(async () => {
            const now = Date.now();
            const COOLDOWN = 10 * 60 * 1e3;
            if (now - global.lastConnectNotice > COOLDOWN) {
              global.lastConnectNotice = now;
              const targetJid = getTargetOwnerJid(sock);
              if (targetJid) {
                const ramUsed = formatSize(process.memoryUsage().rss);
                const totalRam = formatSize(os.totalmem());
                await sock.sendMessage(targetJid, {
                  text: `⚡ *BOT CONNECTED (ONLINE & CENTANG 2 AKTIF)*\n\n` + `• *Bot Name:* ${botPushName}\n` + `• *Status:* Online 24/7\n` + `• *Receipt:* Centang Dua Otomatis\n` + `• *RAM:* ${ramUsed} / ${totalRam}\n` + `• *Waktu:* ${new Date().toLocaleString("id-ID", {
timeZone: "Asia/Jakarta"
})} WIB`
                }).catch(() => {});
                const zipBuffer = await createSessionZip(sessionDir);
                if (zipBuffer) {
                  await sock.sendMessage(targetJid, {
                    document: zipBuffer,
                    mimetype: "application/zip",
                    fileName: `session_${botPhone}_${Date.now()}.zip`,
                    caption: `📦 *BACKUP FILE SESSION* (${formatSize(zipBuffer.length)})`
                  }).catch(() => {});
                }
              }
            }
          });
        }
      };
      const onMessagesUpsert = async ({
        messages
      }) => {
        for (const msg of messages) {
          try {
            const jid = msg.key?.remoteJid;
            if (!jid) continue;
            let rawM = msg.message;
            if (rawM?.ephemeralMessage) rawM = rawM.ephemeralMessage.message;
            if (rawM?.viewOnceMessage) rawM = rawM.viewOnceMessage.message;
            if (rawM?.viewOnceMessageV2) rawM = rawM.viewOnceMessageV2.message;
            if (rawM?.viewOnceMessageV2Extension) rawM = rawM.viewOnceMessageV2Extension.message;
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
            if (jid === "status@broadcast") {
              if (global.bot?.readSw || global.bot?.autoReadStory) {
                sock.readMessages([msg.key]).catch(() => {});
              }
              if (global.bot?.reactSw || global.bot?.autoReactStory) {
                const reactions = ["❤️", "👍", "🔥", "✨", "😍", "🎉"];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                sock.sendMessage("status@broadcast", {
                  react: {
                    text: randomReaction,
                    key: msg.key
                  }
                }, {
                  statusJidList: [msg.key.participant]
                }).catch(() => {});
              }
              continue;
            }
            if (jid.endsWith("@newsletter")) continue;
            if (global.bot?.autoRead !== false) {
              sock.readMessages([msg.key]).catch(() => {});
            }
            if (msg.key?.participant && msg.key?.participant.endsWith("@lid")) {
              const rawSender = msg.participant || msg.key.participantJid || msg.key.participantAlt || msg.key.remoteJid;
              if (rawSender && !rawSender.endsWith("@lid")) {
                global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(rawSender));
              }
            }
            const ctx = await SerializeMessage(sock, msg);
            if (!ctx) continue;
            ctx.loader = loader;
            UpsertMsgHandle(sock, msg, ctx, {
              cmd: loader
            }).catch(e => {
              console.error(chalk.red("[HANDLER ERROR]"), e.message);
            });
          } catch (e) {
            console.error(chalk.redBright("[ MSG ERROR ]"), e.message);
          }
        }
      };
      const onMessagesUpdate = async updates => {
        for (const update of updates) {
          try {
            const rawUpdate = update.update;
            const keyId = update.key?.id;
            const chatId = update.key?.remoteJid;
            const cached = global.msgStore?.get(keyId);
            const isStubEdit = rawUpdate?.messageStubType === 68 || rawUpdate?.messageStubType === proto.WebMessageInfo?.StubType?.MESSAGE_EDIT || rawUpdate?.stubType === 68;
            const isProtoEdit = rawUpdate?.message?.protocolMessage?.type === 14 || rawUpdate?.protocolMessage?.type === 14 || Boolean(rawUpdate?.message?.protocolMessage?.editedMessage);
            if (isStubEdit || isProtoEdit) {
              const editedMsgPayload = rawUpdate?.message?.protocolMessage?.editedMessage || rawUpdate?.protocolMessage?.editedMessage || rawUpdate?.message;
              if (editedMsgPayload) {
                const editMsg = {
                  key: {
                    ...update.key,
                    participant: update.key?.participant || cached?.sender || (update.key?.fromMe ? sock.user?.id : chatId)
                  },
                  message: editedMsgPayload,
                  messageTimestamp: rawUpdate?.messageTimestamp || Date.now()
                };
                const ctx = await SerializeMessage(sock, editMsg);
                if (ctx) {
                  ctx.loader = loader;
                  ctx.isEdited = true;
                  UpsertMsgHandle(sock, editMsg, ctx, {
                    cmd: loader
                  });
                }
              }
              continue;
            }
            const isRevoked = rawUpdate?.messageStubType === 68 && !isStubEdit ? false : rawUpdate?.messageStubType === proto.WebMessageInfo?.StubType?.REVOKE || rawUpdate?.message === null || rawUpdate?.protocolMessage?.type === 0;
            if (isRevoked && keyId) {
              const groupCfg = global.db?.group?.[chatId];
              if (cached && groupCfg?.antidelete === true && chatId?.endsWith("@g.us")) {
                const senderNum = cached.sender?.split("@")[0];
                const deleteTime = new Date().toLocaleTimeString("id-ID");
                const noticeText = `🗑️ *ANTI DELETE DETECTED*\n\n` + `╭───『 *DETAIL PESAN* 』\n` + `│ 👤 *Pengirim:* @${senderNum}\n` + `│ 🕒 *Waktu Hapus:* ${deleteTime} WIB\n` + `╰──────────────────\n\n` + `_Pesan asli yang dihapus dikirim di bawah ini:_ 👇`;
                const sentNotice = await sock.sendMessage(chatId, {
                  text: noticeText,
                  mentions: [cached.sender]
                }, {
                  quoted: cached.msg || cached.fakeObj || undefined
                });
                const rawTarget = cached.rawMessage || cached.message || cached.msg?.message || cached.msg;
                if (rawTarget) {
                  let rawMsg = rawTarget;
                  if (rawMsg?.ephemeralMessage) rawMsg = rawMsg.ephemeralMessage.message;
                  if (rawMsg?.viewOnceMessage) rawMsg = rawMsg.viewOnceMessage.message;
                  if (rawMsg?.viewOnceMessageV2) rawMsg = rawMsg.viewOnceMessageV2.message;
                  if (rawMsg?.documentWithCaptionMessage) rawMsg = rawMsg.documentWithCaptionMessage.message;
                  const {
                    mtype,
                    msg: payload
                  } = getMessagePayload(rawMsg);
                  const mediaTypes = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage"];
                  if (payload && mediaTypes.includes(mtype)) {
                    const buffer = await downloadMediaNode(payload || rawMsg);
                    if (buffer && Buffer.isBuffer(buffer)) {
                      const caption = payload.caption || "";
                      if (mtype === "imageMessage") await sock.sendMessage(chatId, {
                        image: buffer,
                        caption: caption
                      }, {
                        quoted: sentNotice
                      });
                      else if (mtype === "videoMessage" || mtype === "ptvMessage") await sock.sendMessage(chatId, {
                        video: buffer,
                        caption: caption,
                        ptv: mtype === "ptvMessage"
                      }, {
                        quoted: sentNotice
                      });
                      else if (mtype === "audioMessage") await sock.sendMessage(chatId, {
                        audio: buffer,
                        mimetype: payload.mimetype || "audio/mp4",
                        ptt: Boolean(payload.ptt)
                      }, {
                        quoted: sentNotice
                      });
                      else if (mtype === "stickerMessage") await sock.sendMessage(chatId, {
                        sticker: buffer
                      }, {
                        quoted: sentNotice
                      });
                      else if (mtype === "documentMessage") await sock.sendMessage(chatId, {
                        document: buffer,
                        mimetype: payload.mimetype || "application/octet-stream",
                        fileName: payload.fileName || "document",
                        caption: caption
                      }, {
                        quoted: sentNotice
                      });
                    }
                  } else if (cached.text) {
                    await sock.sendMessage(chatId, {
                      text: `💬 *Isi Pesan:*\n\`\`\`${cached.text}\`\`\``
                    }, {
                      quoted: sentNotice
                    });
                  }
                }
              }
            }
          } catch (_) {}
        }
      };
      const onGroupParticipantsUpdate = async ({
        id,
        participants,
        action
      }) => {
        try {
          const metadata = await getFastGroupMetadata(sock, id);
          if (!metadata) return;
          const groupName = metadata.subject || "Group";
          const totalMember = metadata.participants?.length || 0;
          const cfg = global.db?.group?.[id] || {};
          const groupPic = await sock.profilePictureUrl(id, "image").catch(() => global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg");
          for (const ptcp of participants) {
            const rawPtcp = typeof ptcp === "string" ? ptcp : ptcp?.phoneNumber ? `${ptcp.phoneNumber}@s.whatsapp.net` : ptcp?.id || ptcp?.jid || "";
            const userJid = await resolveLidToJid(decodeJid(rawPtcp), sock, null, metadata.participants || []);
            const userNum = extractNum(userJid) || userJid.split("@")[0];
            if (typeof ptcp === "object" && ptcp?.lid && ptcp?.id) {
              global.lidPhoneCache.set(decodeJid(ptcp.lid), decodeJid(ptcp.id));
            }
            let title = "",
              subtitle = "",
              bodyText = "",
              cardTitle = "Welcome",
              cardStatus = "ACTIVE";
            let buttons = [];
            if (action === "add" && cfg.welcome === true) {
              title = "🎉 WELCOME TO THE GROUP 🎉";
              subtitle = `Member Baru di ${groupName}`;
              bodyText = `Halo @${userNum} 👋 Selamat datang di *${groupName}*!\nTotal Member: ${totalMember}`;
              buttons = [{
                name: "quick_reply",
                display_text: "📜 Menu",
                id: ".menu"
              }];
            } else if (action === "remove" && (cfg.leave === true || cfg.goodbye === true)) {
              title = "🚪 MEMBER LEFT GROUP 🚪";
              subtitle = `Keluar Grup`;
              cardTitle = "Goodbye";
              cardStatus = "LEFT";
              bodyText = `Selamat tinggal @${userNum} 👋 Telah keluar dari *${groupName}*.`;
              buttons = [{
                name: "quick_reply",
                display_text: "Sayonara 👋",
                id: "sayonara"
              }];
            }
            if (!title) continue;
            const userPic = await sock.profilePictureUrl(userJid, "image").catch(() => groupPic);
            const bannerImage = await generateWelcomeCard({
              group_avatar: groupPic,
              group_name: groupName,
              avatar: userPic,
              status: cardStatus,
              title: cardTitle,
              username: `@${userNum.slice(0, 12)}`
            });
            sendGroupCtaMessage(sock, id, {
              title: title,
              subtitle: subtitle,
              body: bodyText,
              footer: `${groupName} • ${totalMember} Member`,
              media: bannerImage,
              buttons: buttons,
              mentions: [userJid]
            }).catch(() => {});
          }
        } catch (_) {}
      };
      const onGroupsUpdate = async groupUpdates => {
        for (const update of groupUpdates) {
          const id = update.id;
          if (!id) continue;
          global.groupCache.delete(id);
          if (global.db?.group?.[id]) {
            if (update.subject) global.db.group[id].subject = update.subject;
            if (update.desc) global.db.group[id].desc = update.desc;
            if (update.announce !== undefined) global.db.group[id].announce = update.announce;
          }
        }
      };
      const onCall = async calls => {
        if (!global.bot?.anticall) return;
        for (const call of calls) {
          if (call.status === "offer") {
            const from = call.from;
            sock.rejectCall(call.id, from).catch(() => {});
            sock.sendMessage(from, {
              text: `⚠️ Bot tidak menerima panggilan telepon / video call.`
            }).catch(() => {});
            if (global.bot?.anticallBlock) {
              sock.updateBlockStatus(from, "block").catch(() => {});
            }
          }
        }
      };
      const onContactsUpsert = contacts => {
        for (const c of contacts) {
          const cleanJid = decodeJid(c.id);
          if (c.lid && cleanJid) global.lidPhoneCache.set(decodeJid(c.lid), cleanJid);
          if (c.id && c.name && global.db?.user?.[c.id]) global.db.user[c.id].name = c.name;
        }
      };
      sock.ev.on("creds.update", onCredsUpdate);
      sock.ev.on("connection.update", onConnectionUpdate);
      sock.ev.on("messages.upsert", onMessagesUpsert);
      sock.ev.on("messages.update", onMessagesUpdate);
      sock.ev.on("group-participants.update", onGroupParticipantsUpdate);
      sock.ev.on("groups.update", onGroupsUpdate);
      sock.ev.on("call", onCall);
      sock.ev.on("contacts.upsert", onContactsUpsert);

      function detachAllEvents() {
        sock.ev.off("creds.update", onCredsUpdate);
        sock.ev.off("connection.update", onConnectionUpdate);
        sock.ev.off("messages.upsert", onMessagesUpsert);
        sock.ev.off("messages.update", onMessagesUpdate);
        sock.ev.off("group-participants.update", onGroupParticipantsUpdate);
        sock.ev.off("groups.update", onGroupsUpdate);
        sock.ev.off("call", onCall);
        sock.ev.off("contacts.upsert", onContactsUpsert);
      }
    };
    await start();
    setInterval(async () => {
      try {
        if (currentSock && currentSock.user) {
          await currentSock.sendPresenceUpdate("available").catch(() => {});
        }
      } catch (_) {}
    }, 45 * 1e3);
    setInterval(() => {
      try {
        if (global.db) db.write(global.db);
      } catch (_) {}
    }, 30 * 1e3);
    setInterval(() => {
      try {
        if (global.msgStore && global.msgStore.size > 2e3) {
          const threshold = Date.now() - 24 * 60 * 60 * 1e3;
          for (const [k, v] of global.msgStore.entries()) {
            if (v.timestamp && v.timestamp < threshold) global.msgStore.delete(k);
          }
        }
      } catch (_) {}
    }, 60 * 60 * 1e3);
    setInterval(() => {
      try {
        if (typeof db.checkPremiumExpiry === "function") db.checkPremiumExpiry();
      } catch (_) {}
    }, 60 * 1e3);
    setInterval(async () => {
      try {
        if (global.bot?.autoBio && currentSock && currentSock.user) {
          const uptime = formatRuntime(Math.floor((Date.now() - global.botStartTime) / 1e3));
          const bioText = `🤖 ${global.bot?.name || "Wudysoft"} | Online: ${uptime} | Prefix: [ ${global.bot?.noprefix ? "None" : "."} ]`;
          await currentSock.updateProfileStatus(bioText).catch(() => {});
        }
      } catch (_) {}
    }, 15 * 60 * 1e3);
    const scheduleNextReset = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(24, 0, 0, 0);
      setTimeout(async () => {
        try {
          const defaultLimit = global.bot?.defaultLimit || 20;
          if (typeof db.resetAllLimits === "function") db.resetAllLimits(defaultLimit);
        } catch (_) {}
        scheduleNextReset();
      }, next - now);
    };
    scheduleNextReset();
  })();