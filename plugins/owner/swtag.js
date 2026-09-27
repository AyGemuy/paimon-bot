import {
  getMessagePayload
} from "../../core/serialize.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "swmention",
  aliases: ["swtag", "statustag", "statusmention"],
  description: "Upload status WhatsApp dengan mention/tag ke seluruh member grup atau kontak",
  category: "Tools",
  example: ".swmention Halo semua! (atau reply media / teks dengan .swmention)",
  execute: async (sock, ctx, msg) => {
    try {
      if (typeof sock.sendStatusMention !== "function") {
        return ctx.reply("❌ Method `sock.sendStatusMention` tidak tersedia.");
      }
      await ctx.react("⏳");
      const target = ctx.quoted || ctx;
      const rawMsgObj = target.message || target.msg || target;
      const {
        mtype,
        msg: innerMsg
      } = getMessagePayload(rawMsgObj);
      const cleanType = String(mtype || "").replace(/Message$/i, "").toLowerCase();
      const inputCaption = (ctx.query || ctx.args?.join(" ") || "").trim();
      const extractedText = inputCaption || target.text || innerMsg?.text || innerMsg?.conversation || innerMsg?.caption || (typeof innerMsg === "string" ? innerMsg : "");
      const mediaTypes = ["image", "video", "audio", "sticker", "document", "ptv"];
      const isMedia = mediaTypes.includes(cleanType) || target.isMedia || /image|video|audio|ogg|webp/i.test(target.mimetype || "");
      let content = null;
      if (isMedia && typeof target.download === "function") {
        const buffer = await target.download().catch(() => null);
        if (buffer && Buffer.isBuffer(buffer)) {
          const mediaKey = mediaTypes.includes(cleanType) ? cleanType === "ptv" ? "video" : cleanType : "image";
          content = {
            [mediaKey]: buffer
          };
          if (["image", "video", "document"].includes(mediaKey) && extractedText) {
            content.caption = extractedText;
          }
          if (mediaKey === "audio") {
            content.mimetype = target.mimetype || innerMsg?.mimetype || "audio/mp4";
            content.ptt = Boolean(innerMsg?.ptt ?? target.ptt ?? true);
          }
          if (mediaKey === "document") {
            content.mimetype = target.mimetype || innerMsg?.mimetype || "application/octet-stream";
            content.fileName = target.fileName || innerMsg?.fileName || "file";
          }
        }
      }
      if (!content && extractedText) {
        content = {
          text: extractedText,
          backgroundColor: "#000000",
          font: 1
        };
      }
      if (!content) {
        await ctx.react("❓");
        return ctx.reply("❌ Masukkan teks status atau reply media yang ingin dijadikan status tag.");
      }
      let jids = [];
      if (ctx.isGroup && ctx.participants?.length) {
        jids = ctx.participants.map(p => p.jid || p.phoneNumber || p.id).filter(Boolean);
      } else {
        jids = [ctx.sender, ctx.botJid].filter(Boolean);
      }
      jids = [...new Set(jids.map(j => j.split(":")[0].replace(/\D/g, "") + "@s.whatsapp.net"))];
      const result = await sock.sendStatusMention(content, jids);
      await ctx.react("✅");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const statusQuoted = result && typeof result === "object" && result.key ? result : quotedMsg;
      await sock.sendMessage(ctx.id, {
        text: `✅ *Status Mention Berhasil Diunggah!*\n👥 *Total Tag:* \`${jids.length} Kontak/Member\``
      }, {
        quoted: statusQuoted
      });
    } catch (e) {
      console.error("[SWMENTION ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengunggah status mention: ${e.message}`);
    }
  }
};