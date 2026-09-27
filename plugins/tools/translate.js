import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://www.wudysoft.my.id/api/tools/translate/v11";

function parseTranslateFlags(rawStr) {
  const rest = {};
  let cleanText = rawStr;
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|([^-\s]+(?:\s+[^-\s]+)*?(?=\s+--|$))))?/g;
  const matches = [...rawStr.matchAll(flagRegex)];
  for (const match of matches) {
    const key = match[1].toLowerCase();
    let val = match[2] || match[3] || true;
    if (typeof val === "string") {
      val = val.trim();
      if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
    }
    rest[key] = val;
    cleanText = cleanText.replace(match[0], "");
  }
  return {
    rest: rest,
    cleanText: cleanText.trim()
  };
}

function cleanQuotedCommand(text) {
  if (!text) return "";
  const commandRegex = /^[./#!][a-zA-Z0-9_-]+(?:\s+[a-zA-Z]{2,4})?\s+/;
  return text.replace(commandRegex, "").trim();
}
export default {
  name: "translate",
  aliases: ["tr", "translasi"],
  description: "Terjemahan teks ke berbagai bahasa menggunakan Wudysoft API v11",
  category: "Tools",
  limit: true,
  example: 'translate en Halo dunia atau translate --to en --text "Halo dunia"',
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      let quotedText = "";
      if (ctx.quoted?.text) {
        quotedText = ctx.quoted.text.trim();
      } else if (quotedMsg?.message?.conversation) {
        quotedText = quotedMsg.message.conversation.trim();
      } else if (quotedMsg?.message?.extendedTextMessage?.text) {
        quotedText = quotedMsg.message.extendedTextMessage.text.trim();
      }
      if (quotedText) {
        quotedText = cleanQuotedCommand(quotedText);
      }
      const targetJid = ctx.chat || ctx.id;
      const {
        rest,
        cleanText
      } = parseTranslateFlags(rawText);
      let targetLang = rest.to || rest.lang || rest.target || "";
      let sourceLang = rest.from || rest.source || "auto";
      let textToTranslate = rest.text || cleanText || "";
      if (!targetLang && textToTranslate) {
        const args = textToTranslate.split(/\s+/);
        if (args.length > 0 && args.length >= 2 && args[0].length >= 2 && args[0].length <= 4 && /^[a-zA-Z]+$/.test(args[0])) {
          targetLang = args[0].toLowerCase();
          textToTranslate = args.slice(1).join(" ").trim();
        }
      }
      if (!textToTranslate && quotedText) {
        textToTranslate = quotedText;
      }
      if (!targetLang) {
        targetLang = "id";
      }
      if (!textToTranslate) {
        const prefix = ctx.prefix || ".";
        return ctx.reply(`❌ Masukkan teks yang ingin diterjemahkan atau reply pesan.\nContoh: \`${prefix}translate en Halo dunia\``);
      }
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          text: textToTranslate,
          to: targetLang,
          from: sourceLang
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const translatedText = Array.isArray(data?.result) ? data.result[0] : data?.result;
      if (!translatedText) {
        throw new Error(data?.raw?.message || "Gagal mendapatkan hasil terjemahan dari server.");
      }
      await sock.sendMessage(targetJid, {
        text: translatedText
      }, {
        quoted: quotedMsg
      });
    } catch (error) {
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Translate Error: ${errMsg}`);
    }
  }
};