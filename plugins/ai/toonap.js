import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/ai/toonap";
export default {
  name: "toonap",
  aliases: ["toonme", "cartoon", "kartun", "toonapp"],
  description: "Ubah foto menjadi kartun/anime menggunakan ToonApp AI",
  category: "AI",
  limit: true,
  example: "• Reply gambar: `toonap --style cosplay-cartoon`\n• Cek style: `toonap --styles`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("toonap") || firstWord.endsWith("toonme") || firstWord.endsWith("cartoon") || firstWord.endsWith("kartun") || firstWord.endsWith("toonapp")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *TOONAPP AI CARTOON GENERATOR*\n\n` + `*Cara Penggunaan:*\n` + `• *Ubah Foto ke Kartun:*\n` + `  └ Reply/kirim gambar dengan caption: \`${ctx.prefix || "."}toonap\`\n` + `• *Gunakan Style Tertentu:*\n` + `  └ Reply gambar dengan caption: \`${ctx.prefix || "."}toonap --style cosplay-cartoon\`\n` + `  └ Atau: \`${ctx.prefix || "."}toonap bfantasy\`\n\n` + `• *Lihat Daftar Style:*\n` + `  └ Ketik: \`${ctx.prefix || "."}toonap --styles\``);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const lowerText = text.toLowerCase();
      if (lowerText.startsWith("styles") || lowerText.includes("--styles") || lowerText.includes("--style-list")) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_BASE, {
          action: "styles"
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data || !data.status || !Array.isArray(data.result) || data.result.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar styles dari server.");
        }
        let styleList = `🎭 *DAFTAR STYLES TOONAPP AI*\n\n`;
        data.result.forEach((st, i) => {
          styleList += `${i + 1}. *${st.name || "Unknown"}*\n`;
          styleList += `   🏷️ ID: \`${st.id}\`\n`;
        });
        styleList += `\n👉 *Cara Pakai:* Balas foto dengan \`${ctx.prefix || "."}toonap --style <id_style>\``;
        await ctx.react("✅");
        return sock.sendMessage(ctx.id, {
          text: styleList.trim()
        }, {
          quoted: quotedMsg
        });
      }
      if (!isMedia) {
        return ctx.reply("❌ Harap kirim atau reply gambar yang ingin diubah menjadi kartun!");
      }
      await ctx.react("⏳");
      let style = "";
      if (text.includes("--style")) {
        const parts = text.split("--style");
        style = parts[1]?.trim().split(/\s+/)[0] || "";
      } else if (text) {
        style = text.split(/\s+/)[0].trim();
      }
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
      const body = {
        action: "generate",
        image: uploadRes.url
      };
      if (style) {
        body.style = style;
      }
      const {
        data
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const resObj = data?.result;
      const resultUrl = resObj?.url || (typeof resObj === "string" ? resObj : null);
      if (!data || !data.status || !resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengubah foto menjadi kartun: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const usedStyle = resObj?.style || style;
      const correlationId = resObj?.correlation_id;
      const faceId = resObj?.face_id;
      let caption = `🎨 *ToonApp Cartoon AI Selesai*\n\n`;
      caption += `🎭 *Style:* \`${usedStyle}\`\n`;
      if (faceId) caption += `👤 *Face ID:* \`${faceId}\`\n`;
      if (correlationId) caption += `🆔 *Correlation ID:* \`${correlationId}\`\n`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: resultUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ ToonApp Error: ${errMsg}`);
    }
  }
};