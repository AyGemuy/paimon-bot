import {
  convert,
  writeExif
} from "../../lib/exif.js";
import {
  upload,
  formatBytes
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const safeFormatBytes = bytes => {
  if (typeof formatBytes === "function") return formatBytes(bytes);
  if (!bytes || isNaN(bytes)) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};
export default {
  name: "ezgif",
  aliases: ["ezconvert", "ez", "gifconvert"],
  description: "Konversi media (WebP, MP4, GIF, PNG, JPG) menggunakan engine Ezgif Converter",
  category: "Tools",
  limit: true,
  example: "reply media lalu ketik .ezgif <format_tujuan> (contoh: .ezgif mp4)",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      let targetExt = (ctx.args?.[0] || "").trim().toLowerCase().replace(".", "");
      const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia || /image|video|sticker/i.test(mime);
      if (!targetExt || !isMedia) {
        return ctx.reply(`🔄 *EZGIF MEDIA CONVERTER*\n\n` + `Balas (reply) media dan tentukan format tujuan konversi!\n\n` + `👉 *Format Penggunaan:*\n` + `Balas media dengan: \`${prefix}ezgif <format_tujuan>\`\n\n` + `📌 *Pilihan Konversi Populer:*\n` + `• Reply Stiker bergerak ➔ \`${prefix}ezgif mp4\` (jadi video)\n` + `• Reply Stiker bergerak ➔ \`${prefix}ezgif gif\` (jadi animasi GIF)\n` + `• Reply Video / MP4 ➔ \`${prefix}ezgif webp\` (jadi stiker)\n` + `• Reply Video / MP4 ➔ \`${prefix}ezgif gif\` (jadi animasi GIF)\n` + `• Reply Stiker biasa ➔ \`${prefix}ezgif png\` atau \`jpg\` (jadi foto)\n` + `• Reply Gambar ➔ \`${prefix}ezgif webp\` (jadi stiker)`);
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah media: ${uploadRes?.message || "Upload error"}`);
      }
      const mediaUrl = uploadRes.url;
      let sourceExt = (uploadRes.ext || "").toLowerCase();
      if (!sourceExt) {
        if (/webp/i.test(mime) || mediaType === "sticker") sourceExt = "webp";
        else if (/video|mp4/i.test(mime) || mediaType === "video") sourceExt = "mp4";
        else if (/gif/i.test(mime)) sourceExt = "gif";
        else sourceExt = "png";
      }
      if (targetExt === "jpeg") targetExt = "jpg";
      if (targetExt === "sticker") targetExt = "webp";
      if (targetExt === "video") targetExt = "mp4";
      if (targetExt === "image") targetExt = "png";
      const convertRes = await convert({
        url: mediaUrl,
        from: sourceExt,
        to: targetExt
      });
      if (!convertRes?.status || !convertRes?.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengonversi media: ${convertRes?.error || "Format tidak didukung oleh Ezgif."}`);
      }
      const downloadUrl = convertRes.result;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const caption = `✅ *Konversi Ezgif Berhasil*\n\n` + `🔄 *Tipe Konversi:* \`${sourceExt.toUpperCase()}\` ➔ \`${targetExt.toUpperCase()}\`\n` + `🌐 *Engine:* Ezgif API Tools`;
      const isSticker = targetExt === "webp";
      const isImage = ["jpg", "png", "bmp"].includes(targetExt);
      const isVideo = ["mp4", "webm", "mov"].includes(targetExt);
      const isGif = targetExt === "gif";
      if (isSticker) {
        const stickerBuffer = await writeExif({
          url: downloadUrl
        }, {
          packname: global.bot?.name || "Wudysoft Bot",
          author: global.bot?.author?.name || "Wudysoft"
        }).catch(() => null);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer ? stickerBuffer : {
            url: downloadUrl
          }
        }, {
          quoted: quotedMsg
        });
      } else if (isImage) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: downloadUrl
          },
          caption: caption
        }, {
          quoted: quotedMsg
        });
      } else if (isVideo) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: downloadUrl
          },
          caption: caption
        }, {
          quoted: quotedMsg
        });
      } else if (isGif) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: downloadUrl
          },
          caption: caption,
          gifPlayback: true
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          document: {
            url: downloadUrl
          },
          fileName: `converted_${Date.now()}.${targetExt}`,
          mimetype: "application/octet-stream",
          caption: caption
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Ezgif Converter Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error?.message || error}`);
    }
  }
};