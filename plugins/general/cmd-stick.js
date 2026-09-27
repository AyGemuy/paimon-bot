import fs from "fs";
import path from "path";
import crypto from "crypto";
import chalk from "chalk";
import db from "../../data/db.js";
const STICKER_DIR = path.resolve("./data/stickercmd");

function ensureStickerDir() {
  if (!fs.existsSync(STICKER_DIR)) {
    fs.mkdirSync(STICKER_DIR, {
      recursive: true
    });
  }
}
global.db = global.db || {};
global.db.stickerCmd = global.db.stickerCmd || {};
const stickerCooldowns = new Map();

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

function extractPageNumber(query = "", args = []) {
  const match = query.match(/--page[=\s]+(\d+)/i) || query.match(/--p[=\s]+(\d+)/i);
  if (match) return parseInt(match[1]);
  for (const arg of args) {
    if (!isNaN(arg) && parseInt(arg) > 0) return parseInt(arg);
  }
  return 1;
}
export default {
  name: "stickercmd",
  aliases: ["addcmd", "setcmd", "delcmd", "deletecmd", "listcmd", "cmdsticker"],
  description: "Pasang perintah pada stiker & kirim stiker langsung dari menu list",
  category: "Tools",
  example: "Reply stiker dengan .addcmd .menu | .delcmd | .listcmd",
  before: async (msg, {
    sock,
    ctx,
    cmd,
    isOwner,
    isROwner,
    isPremium
  }) => {
    try {
      if (!ctx || ctx.isFromMe || ctx.isBot) return false;
      const userTypedText = (typeof ctx.text === "string" && ctx.text.trim() || typeof ctx.body === "string" && ctx.body.trim() || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      if (userTypedText.length > 0) {
        return false;
      }
      let messageRoot = msg?.message;
      if (messageRoot?.ephemeralMessage) messageRoot = messageRoot.ephemeralMessage.message;
      if (messageRoot?.viewOnceMessage) messageRoot = messageRoot.viewOnceMessage.message;
      if (messageRoot?.viewOnceMessageV2) messageRoot = messageRoot.viewOnceMessageV2.message;
      const isActualSticker = Boolean(messageRoot?.stickerMessage);
      if (!isActualSticker) return false;
      global.db = global.db || {};
      global.db.stickerCmd = global.db.stickerCmd || {};
      const rawSha = messageRoot?.stickerMessage?.fileSha256;
      let shaHex = getSha256Hex(rawSha);
      if (!shaHex && typeof ctx.download === "function") {
        try {
          const buf = await ctx.download();
          if (buf && Buffer.isBuffer(buf)) {
            shaHex = crypto.createHash("sha256").update(buf).digest("hex").toLowerCase();
          }
        } catch (_) {}
      }
      if (!shaHex || !global.db.stickerCmd[shaHex]) return false;
      const targetEntry = global.db.stickerCmd[shaHex];
      const boundCommand = (targetEntry?.command || "").trim();
      if (!boundCommand) return false;
      const prefixConfig = global.bot?.prefix || global.bot?.defaultPrefix || ["!", ".", "/", "#"];
      let matchedPrefix = "";
      if (prefixConfig instanceof RegExp) {
        matchedPrefix = boundCommand.match(prefixConfig)?.[0] || "";
      } else if (Array.isArray(prefixConfig)) {
        matchedPrefix = prefixConfig.find(p => boundCommand.startsWith(p)) || "";
      } else if (typeof prefixConfig === "string" && boundCommand.startsWith(prefixConfig)) {
        matchedPrefix = prefixConfig;
      }
      const cleanCommand = matchedPrefix ? boundCommand.slice(matchedPrefix.length).trim() : boundCommand;
      const parts = cleanCommand.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
      const cmdName = (parts[0] || "").toLowerCase();
      const cmdArgs = parts.slice(1);
      const cmdQuery = cleanCommand.slice((parts[0] || "").length).trim();
      const commandObj = cmd?.getCommand?.(cmdName) || cmd?.getCommandByRegex?.(boundCommand);
      if (!commandObj) {
        await ctx.reply(boundCommand);
        return true;
      }
      const execFn = commandObj.execute || commandObj.run || commandObj.handler || commandObj.default || (typeof commandObj === "function" ? commandObj : null);
      if (!execFn || typeof execFn !== "function") return false;
      ctx.prefix = matchedPrefix;
      ctx.cmd = cmdName;
      ctx.command = cmdName;
      ctx.args = cmdArgs;
      ctx.query = cmdQuery;
      ctx.isStickerCmd = true;
      if (global.bot?.autoRead !== false) sock.readMessages([msg.key]).catch(() => {});
      if (global.bot?.autoTyping) sock.sendPresenceUpdate("composing", ctx.chat).catch(() => {});
      const userPhoneJid = ctx.userPhoneJid || ctx.sender;
      const cdTime = (commandObj.cooldown || global.bot?.cooldown || 3) * 1e3;
      const userCdKey = `stk_${userPhoneJid}_${cmdName}`;
      const now = Date.now();
      if (stickerCooldowns.has(userCdKey) && !isOwner) {
        const expirationTime = stickerCooldowns.get(userCdKey) + cdTime;
        if (now < expirationTime) {
          const timeLeft = ((expirationTime - now) / 1e3).toFixed(1);
          await ctx.reply(`⏳ Harap tunggu *${timeLeft}s* sebelum memakai stiker perintah ini lagi.`);
          return true;
        }
      }
      stickerCooldowns.set(userCdKey, now);
      setTimeout(() => stickerCooldowns.delete(userCdKey), cdTime);
      const time = new Date().toLocaleTimeString("id-ID", {
        hour12: false
      });
      const badge = ctx.isGroup ? chalk.bgHex("#0284C7").bold(" GRP ") : chalk.bgHex("#7C3AED").bold(" PVT ");
      const stickerBadge = chalk.bgHex("#10B981").bold(" [STICKER-CMD] ");
      const userName = ctx.pushname || ctx.pushName || "Unknown";
      const userTag = chalk.hex("#F59E0B")(userName) + chalk.hex("#64748B")(` (${ctx.senderNumber})`);
      const groupSubject = ctx.groupMetadata?.subject || "Group";
      const locationTag = ctx.isGroup ? chalk.hex("#38BDF8")(`[${groupSubject}]`) : chalk.hex("#A855F7")("[Private Chat]");
      const cmdFormatted = chalk.hex("#10B981").bold(`${matchedPrefix}${cmdName}`);
      console.log(`${chalk.hex("#475569")(`[${time}]`)} ${badge}${stickerBadge} ${chalk.hex("#EF4444")("⚡")} ${cmdFormatted} ${chalk.hex("#64748B")("from")} ${userTag} ${chalk.hex("#64748B")("in")} ${locationTag}`);
      const msgs = global.bot?.msg || {};
      const userData = global.db?.user?.[userPhoneJid] || {};
      if (commandObj.owner && !isOwner) {
        await ctx.reply(msgs.owner || "❌ Perintah stiker ini hanya untuk Owner Bot!");
        return true;
      }
      if (commandObj.premium && !isPremium) {
        await ctx.reply(msgs.premium || "💎 Perintah stiker ini khusus untuk *Pengguna Premium*!");
        return true;
      }
      if (commandObj.group && !ctx.isGroup) {
        await ctx.reply(msgs.group || "❌ Hanya bisa digunakan di grup!");
        return true;
      }
      if (commandObj.private && ctx.isGroup) {
        await ctx.reply(msgs.private || "❌ Hanya bisa digunakan di chat pribadi!");
        return true;
      }
      if (commandObj.admin && !ctx.isAdmin && !isOwner) {
        await ctx.reply(msgs.admin || "❌ Hanya untuk Admin Grup!");
        return true;
      }
      if (commandObj.botAdmin && !ctx.isBotAdmin) {
        await ctx.reply(msgs.botAdmin || "❌ Jadikan bot sebagai Admin Grup terlebih dahulu!");
        return true;
      }
      if (commandObj.limit && !isOwner && !isPremium) {
        const userLimit = userData?.limit ?? 0;
        if (userLimit <= 0) {
          await ctx.reply(msgs.limit || "❌ *Limit kamu sudah habis!*\n\n📌 Limit reset setiap hari pukul 00.00 WIB.");
          return true;
        }
        userData.limit = userLimit - 1;
        db.write(global.db);
      }
      const extraPayload = {
        sock: sock,
        msg: msg,
        ctx: ctx,
        args: cmdArgs,
        text: cmdQuery,
        query: cmdQuery,
        command: cmdName,
        prefix: matchedPrefix,
        isOwner: isOwner,
        isROwner: isROwner,
        isPremium: isPremium,
        isAdmin: ctx.isAdmin,
        isBotAdmin: ctx.isBotAdmin
      };
      await execFn.call(commandObj, sock, ctx, msg, extraPayload);
      global.db.stats = global.db.stats || {};
      global.db.stats[cmdName] = (global.db.stats[cmdName] || 0) + 1;
      global.db.totalHits = (global.db.totalHits || 0) + 1;
      if (userData) {
        userData.exp = (userData.exp || 0) + Math.floor(Math.random() * 15) + 5;
        userData.money = (userData.money || 0) + Math.floor(Math.random() * 10) + 2;
        db.write(global.db);
      }
      return true;
    } catch (err) {
      console.error(chalk.red("[STICKER CMD DIRECT EXEC ERROR]:"), err);
      await ctx.reply(`⚠️ Terjadi kesalahan saat menjalankan perintah stiker:\n\`\`\`${err?.message || err}\`\`\``);
      return true;
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      ensureStickerDir();
      const alias = (ctx.cmd || ctx.command || "stickercmd").toLowerCase();
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Wudysoft Bot";
      global.db.stickerCmd = global.db.stickerCmd || {};
      if (rawQuery.startsWith("--get")) {
        const targetHash = rawQuery.replace(/^--get\s*/i, "").trim().toLowerCase();
        const item = global.db.stickerCmd[targetHash];
        if (!item) {
          return ctx.reply("❌ Stiker tidak ditemukan di database.");
        }
        const stickerFilePath = path.join(STICKER_DIR, `${targetHash}.webp`);
        if (fs.existsSync(stickerFilePath)) {
          const stickerBuf = fs.readFileSync(stickerFilePath);
          return await sock.sendMessage(ctx.chat, {
            sticker: stickerBuf
          }, {
            quoted: msg
          });
        } else {
          return ctx.reply(`❌ Berkas gambar stiker tidak tersimpan di server.\n` + `Perintah terpasang: \`${item.command}\`\n\n` + `_Silakan hapus dan pasang ulang dengan me-reply stiker lalu ketik \`${prefix}addcmd ${item.command}\`._`);
        }
      }
      if (alias === "listcmd" || rawQuery.startsWith("--list")) {
        const entries = Object.entries(global.db.stickerCmd);
        if (!entries.length) {
          return ctx.reply(`📦 *Daftar Stiker Command Kosong*\n\n` + `Belum ada stiker yang dipasangi perintah.\n` + `👉 Reply stiker lalu ketik: \`${prefix}addcmd <command>\`\n` + `_(Contoh: \`${prefix}addcmd .menu\` atau \`${prefix}addcmd info\` [No-Prefix])_`);
        }
        const perPage = 10;
        const totalPages = Math.ceil(entries.length / perPage) || 1;
        let page = extractPageNumber(rawQuery, ctx.args || []);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * perPage;
        const currentItems = entries.slice(startIndex, startIndex + perPage);
        const rows = currentItems.map(([hashKey, item], idx) => {
          const globalIndex = startIndex + idx + 1;
          const uNum = item.creatorNumber || item.creator?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
          const uName = item.creatorName || (typeof ctx.getName === "function" ? ctx.getName(item.creator) : "User");
          const modeTag = item.noPrefix ? "[NO-PREFIX]" : "[PREFIX]";
          return {
            header: `Stiker #${globalIndex} ${modeTag}`,
            title: `Kirim Stiker #${globalIndex}`.slice(0, 24),
            description: `⚡ Perintah: ${item.command} (${uName} - ${uNum})`.slice(0, 50),
            id: `${prefix}stickercmd --get ${hashKey}`
          };
        });
        const sections = [{
          title: `📦 DAFTAR STIKER (Hal ${page}/${totalPages})`,
          rows: rows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🖼️ Ambil Stiker (Hal ${page}/${totalPages})`,
            sections: sections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}listcmd --page ${page - 1}`
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}listcmd --page ${page + 1}`
          });
        }
        const bodyText = `╭───『 *STICKER COMMAND LIST* 』\n` + `│ 📦 *Total Stiker:* ${entries.length} Stiker\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + `│ 🏷️ *Prefix Default:* \`${prefix}\`\n` + `╰────────────────────────\n\n` + `_Pilih stiker dari menu tombol di bawah untuk meminta bot mengirimkan stiker fisiknya ke chat!_`;
        const footerText = `${botName} • Sticker Manager`;
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, footerText, buttons, {
            jid: ctx.id,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Daftar Stiker Cmd`,
                button_title: `Buka Hal ${page}`
              }
            },
            quoted: msg
          });
        }
        let fallback = `${bodyText}\n\n`;
        fallback += currentItems.map(([hashKey, item], i) => {
          const globalIndex = startIndex + i + 1;
          const uName = item.creatorName || "User";
          const modeTag = item.noPrefix ? "*(No-Prefix)*" : "*(Prefix)*";
          return `• *${globalIndex}.* ⚡ \`${item.command}\` ${modeTag} _(Ketik: ${prefix}stickercmd --get ${hashKey})_`;
        }).join("\n");
        return await ctx.reply(fallback, {
          quoted: msg
        });
      }
      if (alias === "delcmd" || alias === "deletecmd" || rawQuery.startsWith("--del")) {
        let foundHash = null;
        let targetText = rawQuery.replace(/^--del\s*/i, "").trim().toLowerCase();
        if (ctx.quoted) {
          const qSha = ctx.quoted.msg?.fileSha256 || ctx.quoted.media?.fileSha256;
          const shaHex = getSha256Hex(qSha);
          if (shaHex && global.db.stickerCmd[shaHex]) {
            foundHash = shaHex;
          }
          if (!foundHash && (ctx.quoted.mediaType === "sticker" || /webp/i.test(ctx.quoted.mimetype || ""))) {
            try {
              let buf = null;
              if (typeof ctx.quoted.download === "function") {
                buf = await ctx.quoted.download();
              } else if (typeof ctx.download === "function") {
                buf = await ctx.download(ctx.quoted.msg || ctx.quoted.message);
              }
              if (buf && Buffer.isBuffer(buf)) {
                const bufHash = crypto.createHash("sha256").update(buf).digest("hex").toLowerCase();
                if (global.db.stickerCmd[bufHash]) foundHash = bufHash;
              }
            } catch {}
          }
        }
        if (!foundHash && targetText) {
          const cleanTarget = targetText.replace(/^[!./#]/, "");
          const matchEntry = Object.entries(global.db.stickerCmd).find(([, v]) => {
            const cmdClean = v.command.toLowerCase().replace(/^[!./#]/, "");
            return v.command.toLowerCase() === targetText || v.command.toLowerCase() === `${prefix}${targetText}` || cmdClean === cleanTarget;
          });
          if (matchEntry) foundHash = matchEntry[0];
        }
        if (!foundHash) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ *Stiker Command Tidak Ditemukan!*\n\n` + `👉 *Cara Hapus:*\n` + `1. Reply stiker yang ingin dihapus ➔ ketik \`${prefix}delcmd\`\n` + `2. Atau ketik nama command ➔ \`${prefix}delcmd <command>\`\n` + `3. Cek daftar command di \`${prefix}listcmd\``);
        }
        const deletedCmd = global.db.stickerCmd[foundHash]?.command || "Command";
        delete global.db.stickerCmd[foundHash];
        if (typeof db?.write === "function") db.write(global.db);
        const localStickerFile = path.join(STICKER_DIR, `${foundHash}.webp`);
        if (fs.existsSync(localStickerFile)) {
          try {
            fs.unlinkSync(localStickerFile);
          } catch (_) {}
        }
        if (typeof ctx.react === "function") await ctx.react("🗑️");
        return ctx.reply(`🗑️ Berhasil menghapus trigger command *"${deletedCmd}"* dari stiker.`);
      }
      if (alias === "addcmd" || alias === "setcmd" || rawQuery.startsWith("--add")) {
        let isForcedNoPrefix = false;
        let commandToBind = rawQuery.replace(/^--add\s*/i, "").trim();
        if (/--noprefix|--np/i.test(commandToBind)) {
          isForcedNoPrefix = true;
          commandToBind = commandToBind.replace(/--noprefix|--np/gi, "").trim();
        }
        if (!commandToBind) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❓ *Command belum ditentukan*\n\n` + `👉 *Contoh Pemakaian:*\n` + `• *Dengan Prefix:* Reply stiker ➔ \`${prefix}addcmd .menu\`\n` + `• *Tanpa Prefix:* Reply stiker ➔ \`${prefix}addcmd ping\` atau \`${prefix}addcmd info --np\``);
        }
        const isSticker = ctx.quoted?.mediaType === "sticker" || /webp/i.test(ctx.quoted?.mimetype || "") || Boolean(ctx.quoted?.msg?.fileSha256);
        if (!ctx.quoted || !isSticker) {
          if (typeof ctx.react === "function") await ctx.react("⚠️");
          return ctx.reply(`⚠️ *Harap reply stikernya!*\n\n` + `Reply stiker yang ingin dijadikan trigger, lalu ketik: \`${prefix}addcmd ${commandToBind}\``);
        }
        if (typeof ctx.react === "function") await ctx.react("⏳");
        let stickerBuffer = null;
        if (typeof ctx.quoted.download === "function") {
          stickerBuffer = await ctx.quoted.download();
        } else if (typeof ctx.download === "function") {
          stickerBuffer = await ctx.download(ctx.quoted.msg || ctx.quoted.message);
        }
        let sha256Hex = getSha256Hex(ctx.quoted.msg?.fileSha256 || ctx.quoted.media?.fileSha256);
        if (!sha256Hex && stickerBuffer && Buffer.isBuffer(stickerBuffer)) {
          sha256Hex = crypto.createHash("sha256").update(stickerBuffer).digest("hex").toLowerCase();
        }
        if (!sha256Hex) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengenali identitas stiker.");
        }
        if (stickerBuffer && Buffer.isBuffer(stickerBuffer)) {
          try {
            fs.writeFileSync(path.join(STICKER_DIR, `${sha256Hex}.webp`), stickerBuffer);
          } catch (_) {}
        }
        const isUpdate = Boolean(global.db.stickerCmd[sha256Hex]);
        const creatorNumber = ctx.senderNumber || ctx.sender?.split("@")[0]?.replace(/\D/g, "") || "Unknown";
        const creatorName = ctx.pushname || ctx.pushName || (typeof ctx.getName === "function" ? ctx.getName(ctx.sender) : "User");
        const startsWithPrefix = /^[!./#]/.test(commandToBind);
        const finalNoPrefix = isForcedNoPrefix || !startsWithPrefix;
        global.db.stickerCmd[sha256Hex] = {
          command: commandToBind,
          noPrefix: finalNoPrefix,
          hash: sha256Hex,
          creator: ctx.sender,
          creatorName: creatorName,
          creatorNumber: creatorNumber,
          updatedAt: Date.now(),
          createdAt: global.db.stickerCmd[sha256Hex]?.createdAt || Date.now()
        };
        if (typeof db?.write === "function") db.write(global.db);
        if (typeof ctx.react === "function") await ctx.react("✅");
        const statusText = isUpdate ? "diperbarui" : "berhasil dipasang";
        const modeBadge = finalNoPrefix ? "🟢 No-Prefix" : "🔵 With-Prefix";
        const successBody = `✅ *Command ${statusText} pada stiker!*\n\n` + `• *Perintah Terpasang:* \`${commandToBind}\`\n` + `• *Mode Eksekusi:* ${modeBadge} (Direct No-Injection)\n` + `• *Pemasang:* ${creatorName} (${creatorNumber})\n\n` + `👉 *Cara Pakai:*\n` + `• Kirim stiker ini di chat/grup untuk menjalankan \`${commandToBind}\`.\n` + `• Buka \`${prefix}listcmd\` untuk mengambil stiker ini kapan saja.`;
        const successButtons = [{
          name: "quick_reply",
          display_text: "📦 Cek Daftar Stiker",
          id: `${prefix}listcmd`
        }, {
          name: "quick_reply",
          display_text: "🗑️ Hapus Command Ini",
          id: `${prefix}delcmd ${commandToBind}`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(successBody, `${botName} • Sticker Command Success`, successButtons, {
            jid: ctx.id,
            quoted: msg
          });
        }
        return ctx.reply(successBody, {
          mentions: [ctx.sender]
        });
      }
      const helperBody = `🎨 *PANDUAN STIKER TO COMMAND*\n\n` + `1️⃣ *Pasang Command ke Stiker:*\n` + `   Reply stiker ➔ \`${prefix}addcmd .menu\`\n\n` + `2️⃣ *Mode No-Prefix (Tanpa Titik):*\n` + `   Reply stiker ➔ \`${prefix}addcmd ping\` atau \`${prefix}addcmd info --np\`\n\n` + `3️⃣ *Hapus Command Stiker:*\n` + `   • Reply stiker ➔ \`${prefix}delcmd\`\n` + `   • Atau ketik ➔ \`${prefix}delcmd .menu\`\n\n` + `4️⃣ *Lihat & Ambil Stiker Terdaftar:*\n` + `   Ketik ➔ \`${prefix}listcmd\` (Memilih stiker akan mengirimkan stiker fisiknya)`;
      const helperButtons = [{
        name: "quick_reply",
        display_text: "📦 Daftar Stiker Command",
        id: `${prefix}listcmd`
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(helperBody, `${botName} • Sticker Command Guide`, helperButtons, {
          jid: ctx.id,
          quoted: msg
        });
      }
      return await ctx.reply(helperBody, {
        quoted: msg
      });
    } catch (error) {
      console.error("[StickerCmd Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`Error: ${error?.message || error}`);
    }
  }
};