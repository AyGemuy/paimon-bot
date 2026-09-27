import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v4",
  DEFAULT_LANG: "id",
  TIMEOUT: 3e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
};

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "tts",
  aliases: ["gtts", "google-tts", "speech", "suara"],
  description: "Google Text-to-Speech sederhana via POST dengan pilihan bahasa opsional.",
  category: "AI",
  limit: true,
  example: "tts halo semuanya\ntts konnichiwa --lang ja\ntts good morning --lang en",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      const lang = flags.lang || flags.tl || flags.l || CONFIG.DEFAULT_LANG;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *Google TTS*\n\n` + `*Penggunaan:*\n` + `• \`${prefix}tts <teks>\` _(Default: Bahasa Indonesia)_\n` + `• \`${prefix}tts <teks> --lang <kode_bahasa>\`\n\n` + `*Contoh:*\n` + `• \`${prefix}tts Halo selamat pagi\`\n` + `• \`${prefix}tts Good morning everyone --lang en\`\n` + `• \`${prefix}tts Ohayou gozaimasu --lang ja\``);
      }
      await ctx.react("⏳");
      const response = await axios.post(CONFIG.API_URL, {
        text: textToSpeak,
        lang: String(lang)
      }, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioBuffer = Buffer.from(response.data);
      await sendPTT(sock, targetJid, audioBuffer, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.statusText || error.message;
      ctx.reply(`❌ Gagal memproses TTS: ${errMsg}`);
    }
  }
};