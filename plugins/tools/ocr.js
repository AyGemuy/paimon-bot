import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/ocr/v7";
export default {
  name: "ocr",
  aliases: ["imagetotext", "scantext", "textfromimage", "readtext"],
  description: "Mengekstrak dan membaca teks dari gambar menggunakan AI OCR",
  category: "Tools",
  limit: true,
  example: "reply gambar atau kirim link gambar",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const text = (ctx.query || ctx.text || "").trim();
      let imageUrlInput = "";
      if (text.startsWith("http://") || text.startsWith("https://")) {
        imageUrlInput = text;
      } else if (isMedia) {
        await ctx.react("⏳");
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        imageUrlInput = uploadRes.url;
      } else {
        return ctx.reply(`📖 *OPTICAL CHARACTER RECOGNITION (OCR)*\n\n` + `👉 *Cara Penggunaan:*\n` + `• Balas/kirim gambar dengan caption: *${ctx.prefix || "."}ocr*\n` + `• Atau sertakan link gambar: *${ctx.prefix || "."}ocr <url_gambar>*`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        image: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const extractedText = data?.value || data?.paragraphs?.map(p => p.content).filter(Boolean).join("\n") || "";
      if (!extractedText.trim()) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak ada teks yang terdeteksi pada gambar tersebut.");
      }
      const duration = data?.duration || "-";
      const totalParagraphs = data?.paragraphs?.length || 0;
      const resultMessage = `📄 *HASIL OCR (IMAGE TO TEXT)*\n\n` + `╭───『 *INFORMASI* 』\n` + `│ ⏱️ *Durasi Scan:* ${duration}\n` + `│ 📑 *Total Baris/Paragraf:* ${totalParagraphs}\n` + `╰──────────────────\n\n` + `📝 *Teks Terdeteksi:*\n` + `\`\`\`\n${extractedText.trim()}\n\`\`\``;
      await sock.sendMessage(ctx.id, {
        text: resultMessage
      }, {
        quoted: typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ OCR Error: ${errMsg}`);
    }
  }
};