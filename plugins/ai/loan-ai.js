import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/loan-ai";

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "loanai",
  aliases: ["loan", "loan-ai"],
  description: "Chat dengan Loan AI Assistant",
  category: "AI",
  limit: true,
  example: "loanai jelaskan apa itu black hole",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("loanai") || firstWord.endsWith("loan") || firstWord.endsWith("loan-ai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      if (!rawText) {
        return ctx.reply(`🤖 *LOAN AI*\n\nSilakan masukkan pertanyaan!\n👉 Contoh: \`${ctx.prefix || "."}loanai apa itu machine learning?\``);
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const payload = {
        prompt: flags.prompt || cleanPrompt,
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari server.");
      }
      const resObj = data.result;
      const content = resObj.content || resObj.messages?.[resObj.messages.length - 1]?.content || "Tidak ada respon.";
      await sock.sendMessage(ctx.id, {
        text: content.trim()
      }, {
        quoted: typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg
      });
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Loan AI Error: ${errMsg}`);
    }
  }
};