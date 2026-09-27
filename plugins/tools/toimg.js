import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  isAnimatedWebp,
  webpToPNG,
  webpToMP4
} from "../../lib/media.js";
export default {
  name: "toimg",
  aliases: ["sticker2media", "stikertoimg", "tovid", "tovideo", "tomp4"],
  description: "Ubah stiker menjadi gambar PNG (statis) atau video MP4 (animasi).",
  category: "Tools",
  example: "Reply stiker dengan .toimg atau .tovid",
  execute: async (sock, ctx, msg) => {
    try {
      const isSticker = ctx.mediaType === "sticker" || ctx.quoted?.mediaType === "sticker" || (ctx.mimetype || ctx.quoted?.mimetype || "").includes("webp");
      if (!isSticker) {
        return ctx.reply("❌ Harap reply stiker yang ingin diubah menjadi gambar (PNG) atau video (MP4)!");
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media stiker dari pesan.");
      }
      const isAnimated = Boolean(ctx.quoted?.isAnimated || ctx.isAnimated || ctx.quoted?.msg?.isAnimated || ctx.cmd === "tovid" || ctx.cmd === "tovideo" || ctx.cmd === "tomp4" || isAnimatedWebp(buffer));
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      if (isAnimated) {
        const videoResult = await webpToMP4(buffer);
        const videoPayload = Buffer.isBuffer(videoResult) ? {
          video: videoResult
        } : {
          video: {
            url: videoResult
          }
        };
        await sock.sendMessage(targetJid, {
          ...videoPayload,
          caption: "✅ *Stiker animasi berhasil diubah ke Video!*",
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        const imageBuffer = await webpToPNG(buffer);
        await sock.sendMessage(targetJid, {
          image: imageBuffer,
          caption: "✅ *Stiker berhasil diubah ke Gambar!*",
          mimetype: "image/png"
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[toimg Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengonversi stiker: ${error?.message || error}`);
    }
  }
};