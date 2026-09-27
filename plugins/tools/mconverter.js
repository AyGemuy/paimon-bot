import axios from "axios";
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
  name: "mconverter",
  aliases: ["convert", "converter", "toconvert"],
  description: "Konversi format media (Gambar, Video, Audio, Dokumen) via MConverter",
  category: "Tools",
  limit: true,
  example: "reply media lalu ketik mconverter <target_extension> (contoh: mconverter webp)",
  execute: async (sock, ctx, msg) => {
    try {
      let targetExt = (ctx.args?.[0] || "").trim().toLowerCase().replace(".", "");
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!targetExt || !isMedia) {
        return ctx.reply(`🔄 *UNIVERSAL MEDIA CONVERTER*\n\n` + `Harap reply media dan tentukan format tujuan konversi!\n\n` + `👉 *Format Penggunaan:*\n` + `Balas media dengan: \`${ctx.prefix || "."}mconverter <ekstensi_tujuan>\`\n\n` + `📌 *Contoh Populer:*\n` + `• Reply gambar ➔ \`${ctx.prefix || "."}mconverter webp\` (jadi stiker)\n` + `• Reply video ➔ \`${ctx.prefix || "."}mconverter mp3\` (ekstrak audio)\n` + `• Reply stiker ➔ \`${ctx.prefix || "."}mconverter png\` (jadi gambar)\n` + `• Reply video ➔ \`${ctx.prefix || "."}mconverter gif\` (jadi animasi)`);
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
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
      const sourceExt = (uploadRes.ext || "png").toLowerCase();
      const body = {
        media: mediaUrl,
        source: sourceExt,
        target: targetExt
      };
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/tools/mconverter", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      if (!data || data.status !== "finished" || !data.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengonversi file: ${data?.message || "Format tidak didukung atau server error."}`);
      }
      const downloadUrl = data.url;
      const ext = (data.extension || targetExt).toLowerCase();
      const fileName = data.file_name || `converted_${Date.now()}.${ext}`;
      const fileSize = data.size ? safeFormatBytes(data.size) : "-";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const caption = `✅ *Konversi Berhasil*\n\n` + `📂 *File:* \`${fileName}\`\n` + `🔄 *Format:* \`${sourceExt.toUpperCase()}\` ➔ \`${ext.toUpperCase()}\`\n` + `📦 *Ukuran:* \`${fileSize}\``;
      const isSticker = ["webp"].includes(ext);
      const isImage = ["jpg", "jpeg", "png", "bmp", "ico"].includes(ext);
      const isVideo = ["mp4", "mkv", "mov", "avi", "webm", "gif"].includes(ext);
      const isAudio = ["mp3", "wav", "ogg", "m4a", "aac", "opus", "flac"].includes(ext);
      if (isSticker) {
        await sock.sendMessage(ctx.id, {
          sticker: {
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
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
      } else if (isVideo) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: downloadUrl
          },
          caption: caption.trim(),
          gifPlayback: ext === "gif"
        }, {
          quoted: quotedMsg
        });
      } else if (isAudio) {
        await sock.sendMessage(ctx.id, {
          audio: {
            url: downloadUrl
          },
          mimetype: ext === "mp3" ? "audio/mpeg" : ext === "ogg" ? "audio/ogg" : "audio/mp4",
          ptt: false
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          document: {
            url: downloadUrl
          },
          fileName: fileName,
          mimetype: data.content_type || "application/octet-stream",
          caption: caption.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Converter Error: ${errMsg}`);
    }
  }
};