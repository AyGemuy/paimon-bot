import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
global.swgcCache = global.swgcCache || new Map();
async function extractPayload(ctx) {
  const target = ctx.quoted || ctx;
  const rawMsgObj = target.message || target.msg || target;
  const {
    mtype,
    msg: innerMsg
  } = getMessagePayload(rawMsgObj);
  const cleanType = String(mtype || "").replace(/Message$/i, "").toLowerCase();
  const inputCaption = (ctx.query || ctx.args?.join(" ") || "").replace(/--to=\S+/gi, "").trim();
  const extractedText = inputCaption || target.text || innerMsg?.text || innerMsg?.conversation || innerMsg?.caption || (typeof innerMsg === "string" ? innerMsg : "");
  const mediaTypes = ["image", "video", "audio", "sticker", "document", "ptv"];
  const isMedia = mediaTypes.includes(cleanType) || target.isMedia || /image|video|audio|ogg|webp/i.test(target.mimetype || "");
  let payload = null;
  if (isMedia && typeof target.download === "function") {
    const buffer = await target.download().catch(() => null);
    if (buffer && Buffer.isBuffer(buffer)) {
      const mediaKey = mediaTypes.includes(cleanType) ? cleanType === "ptv" ? "video" : cleanType : "image";
      payload = {
        [mediaKey]: buffer
      };
      if (["image", "video", "document"].includes(mediaKey) && extractedText) {
        payload.caption = extractedText;
      }
      if (mediaKey === "audio") {
        payload.mimetype = target.mimetype || innerMsg?.mimetype || "audio/mp4";
        payload.ptt = Boolean(innerMsg?.ptt ?? target.ptt ?? true);
      }
      if (mediaKey === "document") {
        payload.mimetype = target.mimetype || innerMsg?.mimetype || "application/octet-stream";
        payload.fileName = target.fileName || innerMsg?.fileName || "file";
      }
    }
  }
  if (!payload && extractedText) {
    payload = {
      text: extractedText,
      backgroundColor: "#000000",
      font: 1
    };
  }
  return payload;
}
export default {
  name: "swgc",
  aliases: ["statusgc", "swgroup", "upstatusgc", "storygc"],
  description: "Upload status grup WhatsApp dengan pemilihan interaktif daftar grup",
  category: "Group",
  example: ".swgc Halo semua (atau reply media / teks dengan .swgc)",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const targetMatch = rawQuery.match(/--to=([0-9\-_]+@g\.us)/i);
      const targetJid = targetMatch ? targetMatch[1] : null;
      if (targetJid) {
        await ctx.react("⏳");
        let payload = null;
        const cached = global.swgcCache.get(ctx.sender);
        if (cached && Date.now() - cached.time < 3e5) {
          payload = cached.payload;
        } else {
          payload = await extractPayload(ctx);
        }
        if (!payload) {
          await ctx.react("❌");
          return ctx.reply("❌ Konten status telah kedaluwarsa. Silakan ketik atau reply ulang pesan dengan `.swgc`.");
        }
        let sentStatusResult = null;
        if (typeof sock.swgc === "function") {
          sentStatusResult = await sock.swgc(targetJid, payload);
        } else if (typeof sock.sendMessage === "function") {
          sentStatusResult = await sock.sendMessage(targetJid, payload, {
            backgroundColor: "#000000",
            font: 1,
            statusJidList: [targetJid]
          });
        } else {
          throw new Error("Fungsi `sock.swgc` tidak ditemukan pada instance socket bot.");
        }
        global.swgcCache.delete(ctx.sender);
        await ctx.react("✅");
        const statusQuoted = sentStatusResult && typeof sentStatusResult === "object" && sentStatusResult.key ? sentStatusResult : quotedMsg;
        return await sock.sendMessage(ctx.id, {
          text: `✅ *Berhasil Mengunggah Status Grup!*\n🏷️ *Target Grup:* \`${targetJid}\``
        }, {
          quoted: statusQuoted
        });
      }
      await ctx.react("⏳");
      const payload = await extractPayload(ctx);
      if (!payload) {
        await ctx.react("❓");
        return ctx.reply(`📢 *CARA PENGGUNAAN SWGC*\n\n` + `• *Teks:* \`${prefix}swgc Pesan status kamu\`\n` + `• *Reply Chat Teks:* Balas pesan chat dengan \`${prefix}swgc\`\n` + `• *Reply Media:* Balas Foto / Video / Audio / Stiker / Dokumen dengan \`${prefix}swgc\`\n\n` + `Lalu tentukan target grup melalui tombol *Pilih Target Grup*.`);
      }
      global.swgcCache.set(ctx.sender, {
        payload: payload,
        time: Date.now()
      });
      let allGroups = {};
      try {
        if (typeof sock.groupFetchAllParticipating === "function") {
          allGroups = await sock.groupFetchAllParticipating();
        }
      } catch (err) {
        console.error("[SWGC] Gagal memuat daftar grup:", err);
      }
      const seenGroupJids = new Set();
      const groupRows = [];
      const isCurrentGroup = ctx.isGroup || ctx.id?.endsWith("@g.us");
      if (isCurrentGroup) {
        seenGroupJids.add(ctx.id);
        const currentName = allGroups[ctx.id]?.subject || "Grup Saat Ini";
        groupRows.push({
          title: `📍 ${currentName.slice(0, 40)}`,
          description: `Kirim status khusus ke grup ini`,
          id: `${prefix}swgc --to=${ctx.id}`
        });
      }
      for (const [jid, meta] of Object.entries(allGroups)) {
        if (!jid.endsWith("@g.us") || seenGroupJids.has(jid)) continue;
        seenGroupJids.add(jid);
        groupRows.push({
          title: `👥 ${(meta?.subject || "WhatsApp Group").slice(0, 40)}`,
          description: `Anggota: ${meta?.participants?.length || meta?.size || 0} Member`,
          id: `${prefix}swgc --to=${jid}`
        });
      }
      if (groupRows.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Bot belum terdaftar di grup manapun.");
      }
      const limitedRows = groupRows.slice(0, 20);
      const bodyText = `📢 *STATUS WHATSAPP GRUP (SWGC)*\n\n` + `Konten status telah siap diunggah.\n` + `Silakan pilih grup tujuan pada menu interaktif di bawah:`;
      const footerText = `${botName} • Group Story Dispatcher`;
      const buttons = [{
        name: "single_select",
        title: `🎯 PILIH TARGET GRUP (${limitedRows.length})`,
        sections: [{
          title: `${botName} • Daftar Grup`,
          rows: limitedRows
        }]
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Target Grup`,
            button_title: "🎯 Pilih Grup Tujuan"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[SWGC Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memproses SWGC: ${error?.message || error}`);
    }
  }
};