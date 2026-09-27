import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/scanqr/v2";
export default {
  name: "scanqr",
  aliases: ["qrscan", "readqr", "barcodescan", "scanbarcode"],
  description: "Membaca dan memindai isi kode QR atau Barcode dari gambar",
  category: "Tools",
  limit: true,
  example: "reply gambar QR atau kirim link gambar QR",
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
        return ctx.reply(`🔍 *QR CODE / BARCODE SCANNER*\n\n` + `👉 *Cara Penggunaan:*\n` + `• Balas/kirim gambar QR dengan caption: *${ctx.prefix || "."}scanqr*\n` + `• Atau sertakan link gambar QR: *${ctx.prefix || "."}scanqr <url_gambar>*`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        url: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const scanResult = data?.result;
      if (!scanResult || !scanResult.raw && !scanResult.parsed) {
        await ctx.react("❌");
        return ctx.reply("❌ QR Code tidak terdeteksi atau gambar tidak jelas.");
      }
      const parsedText = scanResult.parsed || scanResult.raw || "-";
      const format = scanResult.format || "QR_CODE";
      const type = scanResult.result || "TEXT";
      const resultText = `🔍 *HASIL SCAN QR CODE*\n\n` + `╭───『 *INFORMASI* 』\n` + `│ 🏷️ *Format:* ${format}\n` + `│ 📊 *Tipe Data:* ${type}\n` + `╰──────────────────\n\n` + `📝 *Isi / Data QR:*\n` + `\`\`\`\n${parsedText}\n\`\`\``;
      await sock.sendMessage(ctx.id, {
        text: resultText
      }, {
        quoted: typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Scan QR Error: ${errMsg}`);
    }
  }
};