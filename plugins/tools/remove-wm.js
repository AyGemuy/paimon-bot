import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/remove-wm/v2";
export default {
  name: "removewm",
  aliases: ["nowm", "rmwm", "hapuswm", "watermarkremove"],
  description: "Menghapus watermark pada gambar menggunakan AI (POST API)",
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
        return ctx.reply(`🧹 *REMOVE WATERMARK AI*\n\n` + `👉 *Cara Penggunaan:*\n` + `• Balas/kirim gambar dengan caption: *${ctx.prefix || "."}removewm*\n` + `• Atau sertakan link gambar: *${ctx.prefix || "."}removewm <url_gambar>*`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        imageUrl: imageUrlInput
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resultImageUrl = typeof data?.result === "string" ? data.result : data?.result?.url || data?.result?.imageUrl || data?.imageUrl;
      if (!resultImageUrl) {
        throw new Error(data?.message || "Gambar hasil watermark removal tidak ditemukan.");
      }
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultImageUrl
        },
        caption: `✨ *Watermark Removed Successfully!*\n\n` + `🤖 *Engine:* AI Watermark Remover v2\n` + `🧹 *Status:* Selesai dibersihkan`
      }, {
        quoted: typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Remove WM Error: ${errMsg}`);
    }
  }
};