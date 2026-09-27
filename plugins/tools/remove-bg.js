import {
  removeBgBuffer,
  writeExif
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "removebg",
  aliases: ["nobg", "rmbg", "bgremove", "transparent"],
  description: "Hapus background gambar otomatis menggunakan AI (v18 & v12 Fallback via exif.js)",
  category: "Tools",
  limit: true,
  example: "reply/kirim gambar dengan .removebg atau .removebg --sticker",
  execute: async (sock, ctx, msg) => {
    try {
      const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia || /image|sticker/i.test(mime);
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      if (!isMedia) {
        return ctx.reply(`🖼️ *AI REMOVE BACKGROUND*\n\n` + `Harap kirim atau balas (reply) gambar yang ingin dihapus latar belakangnya!\n\n` + `👉 *Format Penggunaan:*\n` + `• *Jadi Gambar Transparan:* \`${prefix}removebg\`\n` + `• *Langsung Jadi Stiker:* \`${prefix}removebg --sticker\``);
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh gambar dari pesan WhatsApp.");
      }
      const transparentBuffer = await removeBgBuffer(buffer);
      if (!transparentBuffer || transparentBuffer.length === buffer.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal menghapus background gambar. Pastikan objek gambar jelas.");
      }
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").toLowerCase();
      const sendAsSticker = rawQuery.includes("--sticker") || rawQuery.includes("-s");
      if (sendAsSticker) {
        const exif = {
          packname: global.bot?.name || "Wudysoft Bot",
          author: global.bot?.author?.name || "Wudysoft",
          categories: ["✨"]
        };
        const stickerBuffer = await writeExif(transparentBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const captionText = `✅ *REMOVE BACKGROUND SELESAI*\n\n` + `• *Engine:* AI Background Remover (v18/v12)\n` + `• *Format:* \`PNG (Transparan)\`\n\n` + `_${botName} • AI Image Tools_`;
      const buttons = [{
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🖼️ Jadikan Stiker",
          id: `${prefix}s --nobg`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(captionText, `${botName} • RemoveBG`, buttons, {
          image: transparentBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: transparentBuffer,
          caption: captionText,
          mimetype: "image/png"
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[RemoveBG Error]:", error?.message || error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ RemoveBG Error: ${errMsg}`);
    }
  }
};