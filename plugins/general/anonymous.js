import {
  simpleQuoted
} from "../../lib/quoted.js";
global.anonymousChat = global.anonymousChat || {
  queue: [],
  rooms: new Map()
};

function maskNumber(jid = "") {
  const num = jid.split("@")[0].replace(/\D/g, "");
  if (!num) return "Secret User";
  if (num.length <= 6) return `+${num.slice(0, 2)}****`;
  return `+${num.slice(0, 4)}-****-${num.slice(-3)}`;
}
async function sendAnonCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Anonymous Chat`,
        button_title: "Menu Interaksi"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    return await ctx.sendCta(bodyText, footerText, buttons, options);
  }
  try {
    if (typeof ctx?.sendCta === "function") {
      const prevId = ctx.id;
      ctx.id = targetJid;
      const res = await ctx.sendCta(bodyText, footerText, buttons, options);
      ctx.id = prevId;
      return res;
    }
  } catch (err) {}
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`
  }, {
    quoted: quoted
  });
}
export default {
  name: "anonymous",
  aliases: ["anon", "anonym", "chat", "randomchat", "menfess"],
  description: "Cari teman obrolan rahasia secara anonim (Cari / Stop / Next / Skip)",
  category: "Fun",
  limit: false,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us") || msg?.key?.remoteJid?.endsWith("@g.us"));
      if (isGroup) return;
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      const partnerJid = global.anonymousChat.rooms.get(senderJid);
      if (!partnerJid) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefix = ctx?.prefix || ".";
      const cmdList = [prefix, "/", "!", "#"];
      if (cmdList.some(p => userText.startsWith(p))) return;
      const senderName = ctx?.pushName || msg?.pushName || "Anonymous";
      const maskedPhone = maskNumber(senderJid);
      const headerText = `💬 *[${senderName} • ${maskedPhone}]*`;
      const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || msg?.message?.videoMessage || msg?.message?.audioMessage || msg?.message?.stickerMessage || msg?.message?.documentMessage);
      if (isMedia) {
        const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
        let mediaBuffer = null;
        if (typeof downloadFn === "function") {
          mediaBuffer = await downloadFn().catch(() => null);
        }
        if (mediaBuffer && Buffer.isBuffer(mediaBuffer)) {
          const m = msg.message;
          const captionText = userText ? `${headerText}\n\n${userText}` : headerText;
          if (m?.imageMessage) {
            await sock.sendMessage(partnerJid, {
              image: mediaBuffer,
              caption: captionText
            });
          } else if (m?.videoMessage) {
            await sock.sendMessage(partnerJid, {
              video: mediaBuffer,
              caption: captionText
            });
          } else if (m?.audioMessage) {
            await sock.sendMessage(partnerJid, {
              text: `${headerText} mengirim pesan suara:`
            });
            await sock.sendMessage(partnerJid, {
              audio: mediaBuffer,
              mimetype: "audio/mp4",
              ptt: Boolean(m.audioMessage.ptt)
            });
          } else if (m?.stickerMessage) {
            await sock.sendMessage(partnerJid, {
              text: `${headerText} mengirim stiker:`
            });
            await sock.sendMessage(partnerJid, {
              sticker: mediaBuffer
            });
          } else if (m?.documentMessage) {
            await sock.sendMessage(partnerJid, {
              document: mediaBuffer,
              mimetype: m.documentMessage.mimetype || "application/octet-stream",
              fileName: m.documentMessage.fileName || "file",
              caption: captionText
            });
          }
          if (typeof ctx?.react === "function") await ctx.react("📨");
          return true;
        }
      }
      if (userText) {
        await sock.sendMessage(partnerJid, {
          text: `${headerText}\n\n${userText}`
        });
        if (typeof ctx?.react === "function") await ctx.react("📨");
        return true;
      }
    } catch (err) {
      console.error("[ANONYMOUS CHAT RELAY ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (isGroup) {
        return ctx.reply("❌ *Fitur Anonymous Chat hanya dapat digunakan di Private Chat (PC).*");
      }
      await ctx.react("⏳");
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const subCommand = (ctx?.args?.[0] || ctx?.query || "").trim().toLowerCase();
      const userJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const buttonsDefault = [{
        name: "quick_reply",
        display_text: "🔍 Cari Partner",
        id: `${prefix}anon start`
      }, {
        name: "quick_reply",
        display_text: "⏭️ Next / Skip",
        id: `${prefix}anon next`
      }, {
        name: "quick_reply",
        display_text: "🛑 Stop Chat",
        id: `${prefix}anon stop`
      }];
      if (["stop", "keluar", "end", "leave"].includes(subCommand)) {
        const queueIdx = global.anonymousChat.queue.indexOf(userJid);
        if (queueIdx !== -1) {
          global.anonymousChat.queue.splice(queueIdx, 1);
          await ctx.react("🛑");
          return await sendAnonCta(sock, ctx, userJid, "🛑 *Pencarian Dibatalkan*\n\nKamu telah keluar dari antrean pencarian partner.", `${botName} • Anonymous Room`, buttonsDefault, quotedMsg);
        }
        const partnerJid = global.anonymousChat.rooms.get(userJid);
        if (partnerJid) {
          global.anonymousChat.rooms.delete(userJid);
          global.anonymousChat.rooms.delete(partnerJid);
          await ctx.react("🛑");
          await sendAnonCta(sock, ctx, userJid, "🛑 *Obrolan Selesai*\n\nKamu telah memutuskan koneksi dengan partner obrolan.", `${botName} • Anonymous Room`, buttonsDefault, quotedMsg);
          const partnerBtns = [{
            name: "quick_reply",
            display_text: "🔍 Cari Teman Baru",
            id: `${prefix}anon start`
          }, {
            name: "quick_reply",
            display_text: "🏠 Menu Bot",
            id: `${prefix}menu`
          }];
          return await sendAnonCta(sock, ctx, partnerJid, "⚠️ *Partner Meninggalkan Obrolan*\n\nTeman bicaramu telah keluar dari sesi obrolan ini.", `${botName} • Anonymous Room`, partnerBtns, null);
        }
        return ctx.reply(`⚠️ Kamu sedang tidak berada dalam obrolan aktif.\nKetik \`${prefix}anon start\` untuk mencari teman.`);
      }
      if (["next", "skip", "lewati"].includes(subCommand)) {
        const partnerJid = global.anonymousChat.rooms.get(userJid);
        if (partnerJid) {
          global.anonymousChat.rooms.delete(userJid);
          global.anonymousChat.rooms.delete(partnerJid);
          await sendAnonCta(sock, ctx, partnerJid, "⏭️ *Partner Melewati Obrolan*\n\nPartner bicaramu telah beralih untuk mencari orang lain.", `${botName} • Anonymous Room`, [{
            name: "quick_reply",
            display_text: "🔍 Cari Partner Baru",
            id: `${prefix}anon start`
          }], null);
        }
        const qIndex = global.anonymousChat.queue.indexOf(userJid);
        if (qIndex !== -1) global.anonymousChat.queue.splice(qIndex, 1);
      }
      if (["start", "cari", "next", "skip", "lewati", "find"].includes(subCommand)) {
        if (global.anonymousChat.rooms.has(userJid)) {
          return ctx.reply(`⚠️ Kamu masih terhubung dengan partner!\n\n` + `Gunakan tombol *Next / Skip* untuk berganti partner atau *Stop Chat* untuk keluar.`);
        }
        if (global.anonymousChat.queue.includes(userJid)) {
          return ctx.reply("⏳ *Kamu sudah berada di antrean.* Mohon tunggu sistem menemukan teman untukmu...");
        }
        if (global.anonymousChat.queue.length > 0) {
          const partnerJid = global.anonymousChat.queue.shift();
          global.anonymousChat.rooms.set(userJid, partnerJid);
          global.anonymousChat.rooms.set(partnerJid, userJid);
          const connectedButtons = [{
            name: "quick_reply",
            display_text: "⏭️ Next Partner",
            id: `${prefix}anon next`
          }, {
            name: "quick_reply",
            display_text: "🛑 Stop Chat",
            id: `${prefix}anon stop`
          }];
          const userTextNotif = `🎉 *PARTNER DITEMUKAN!*\n\n` + `👤 *Partner:* ${maskNumber(partnerJid)}\n\n` + `_Mulai ketik pesan apa saja (teks/gambar/audio/stiker), pesan akan otomatis diteruskan secara anonim._`;
          const partnerTextNotif = `🎉 *PARTNER DITEMUKAN!*\n\n` + `👤 *Partner:* ${maskNumber(userJid)}\n\n` + `_Mulai ketik pesan apa saja (teks/gambar/audio/stiker), pesan akan otomatis diteruskan secara anonim._`;
          await ctx.react("✨");
          await sendAnonCta(sock, ctx, userJid, userTextNotif, `${botName} • Connected`, connectedButtons, quotedMsg);
          return await sendAnonCta(sock, ctx, partnerJid, partnerTextNotif, `${botName} • Connected`, connectedButtons, null);
        }
        global.anonymousChat.queue.push(userJid);
        await ctx.react("🔍");
        const waitingButtons = [{
          name: "quick_reply",
          display_text: "🛑 Batal Cari",
          id: `${prefix}anon stop`
        }];
        return await sendAnonCta(sock, ctx, userJid, `🔍 *Mencari Partner Obrolan...*\n\n` + `Mohon tunggu sebentar, sistem sedang mencarikan pengguna lain yang sedang online.\n` + `Kamu akan otomatis terhubung saat partner ditemukan!`, `${botName} • Searching Queue`, waitingButtons, quotedMsg);
      }
      const isChatting = global.anonymousChat.rooms.has(userJid);
      const isQueued = global.anonymousChat.queue.includes(userJid);
      let statusMsg = `╭───『 *ANONYMOUS CHAT* 』\n`;
      statusMsg += `│ 👤 *Status Anda:* ${isChatting ? "🟢 Sedang Terhubung" : isQueued ? "🟡 Menunggu Antrean" : "⚪ Bebas / Diam"}\n`;
      statusMsg += `│ 👥 *Total Mengantre:* ${global.anonymousChat.queue.length} Pengguna\n`;
      statusMsg += `│ 💬 *Total Obrolan Aktif:* ${global.anonymousChat.rooms.size / 2} Room\n`;
      statusMsg += `╰────────────────────────\n\n`;
      statusMsg += `*Cara Penggunaan:*\n`;
      statusMsg += `• \`${prefix}anon start\` - Cari teman obrolan rahasia\n`;
      statusMsg += `• \`${prefix}anon next\` - Skip dan cari teman baru\n`;
      statusMsg += `• \`${prefix}anon stop\` - Mengakhiri obrolan saat ini\n\n`;
      statusMsg += `_Semua pesan teks, gambar, VN, dan stiker diteruskan secara langsung tanpa tanda forward!_`;
      await sendAnonCta(sock, ctx, userJid, statusMsg, `${botName} • Anonymous Service`, buttonsDefault, quotedMsg);
      await ctx.react("✅");
    } catch (e) {
      console.error("[ANONYMOUS ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};