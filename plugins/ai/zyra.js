import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "zyra",
  aliases: ["zyraai", "geminizyra"],
  description: "AI Chat Assistant & Vision menggunakan Zyra Engine (Gemini 2.5 Flash)",
  category: "AI",
  limit: true,
  example: "• Chat: `zyra jelaskan teori relativitas secara singkat`\n• Analisis Gambar: Reply gambar dengan caption `zyra gambar apa ini?`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("zyra") || firstWord.endsWith("zyraai") || firstWord.endsWith("geminizyra")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`✨ *ZYRA AI ASSISTANT (GEMINI 2.5 FLASH)*\n\n` + `*Cara Penggunaan:*\n` + `• *Tanya AI / Chat:*\n` + `  └ \`${ctx.prefix || "."}zyra buatkan puisi tentang senja\`\n\n` + `• *Vision / Analisis Gambar:*\n` + `  └ Balas gambar dengan: \`${ctx.prefix || "."}zyra jelaskan isi gambar ini secara detail\``);
      }
      await ctx.react("💭");
      let mediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            mediaUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const body = {
        prompt: text || (mediaUrl ? "Jelaskan gambar ini secara detail dan mendalam" : "Halo!"),
        messages: [],
        media: mediaUrl
      };
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/zyra", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Zyra AI.");
      }
      const answerText = data.result || data.chunks?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text || "Tidak ada respon yang diterima.";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await sock.sendMessage(ctx.id, {
        text: answerText.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Zyra AI Error: ${errMsg}`);
    }
  }
};