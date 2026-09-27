import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "appzoneai",
  aliases: ["appzone", "azai", "gpt5"],
  description: "AI Chat Assistant & Vision (Teks & Gambar) via AppZone AI Engine",
  category: "AI",
  example: "• Teks: `appzoneai jelaskan teori relativitas`\n• Vision: Reply foto dengan `appzoneai jelaskan gambar ini`\n• Model: `appzoneai siapa kamu? --model gpt-5.4-mini`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("appzoneai") || firstWord.endsWith("appzone") || firstWord.endsWith("azai") || firstWord.endsWith("gpt5")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🤖 *APPZONE AI ASSISTANT*\n\n` + `• *Tanya AI / Percakapan:*\n` + `  └ \`${ctx.prefix || "."}appzoneai buatkan kode Python web scraping\`\n\n` + `• *Analisis Gambar (Vision AI):*\n` + `  └ Reply/kirim gambar: \`${ctx.prefix || "."}appzoneai apa isi gambar ini?\`\n\n` + `• *Pilih Model Spesifik:*\n` + `  └ \`${ctx.prefix || "."}appzoneai halo! --model gpt-5.4-mini\``);
      }
      await ctx.react("⏳");
      let prompt = text;
      let selectedModel = "";
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) {
          selectedModel = match[1].trim();
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      let mediaUrl = "";
      if (isMedia) {
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
        mediaUrl = uploadRes.url;
      }
      const finalPrompt = prompt || (mediaUrl ? "Deskripsikan dan jelaskan gambar ini secara detail." : "Halo!");
      const body = {
        prompt: finalPrompt,
        messages: [{
          role: "user",
          content: finalPrompt
        }]
      };
      if (selectedModel) body.model = selectedModel;
      if (mediaUrl) body.media = mediaUrl;
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/appzoneai", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      if (!data || data.status !== true || !data.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses permintaan: ${data?.message || data?.error || "AI tidak memberikan respon."}`);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const responseText = data.result.trim();
      await sock.sendMessage(ctx.id, {
        text: responseText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ AppZone AI Error: ${errMsg}`);
    }
  }
};