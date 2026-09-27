import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/chatday";
global.chatdaySession = global.chatdaySession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["token", "token_state"].includes(key)) key = "state";
    if (["conv", "cid"].includes(key)) key = "conversation_id";
    if (["visitor", "vid"].includes(key)) key = "visitor_id";
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
async function requestChatDay(payload) {
  const res = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 6e4
  });
  return res.data;
}
export default {
  name: "chatday",
  aliases: ["cday", "chatdayai"],
  description: "AI Multi-Model & Session Chat via ChatDay",
  category: "AI",
  limit: true,
  example: "chatday apa kabar bang --model openai/gpt-4o",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.chatdaySession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      if (!userText) return;
      const prevSession = global.chatdaySession.get(quotedStanzaId);
      if (typeof ctx?.react === "function") await ctx.react("💭");
      const bodyPayload = {
        prompt: userText,
        model: prevSession.model || "chatday/ai-chat",
        conversation_id: prevSession.conversation_id || null,
        visitor_id: prevSession.visitor_id || null,
        state: prevSession.state || null
      };
      const data = await requestChatDay(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari ChatDay API.");
      }
      const answerText = typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.";
      const returnedState = data.state || bodyPayload.state || "";
      const convChunk = Array.isArray(data.chunks) ? data.chunks.find(c => c.type === "data-conversation")?.data : null;
      const conversationId = convChunk?.conversationId || bodyPayload.conversation_id || null;
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `💬 *CHATDAY AI*\n\n` + `📝 *Prompt:* ${userText}\n` + `🤖 *Model:* \`${bodyPayload.model}\`\n` + `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Balas/reply pesan ini langsung untuk melanjutkan sesi obrolan._`;
      const footerText = `${botName} • ChatDay Engine`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 CHATDAY AI CONVERSATION 乂",
          subtitle: `Model: ${bodyPayload.model}`,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        global.chatdaySession.set(newMsgId, {
          conversation_id: conversationId,
          visitor_id: bodyPayload.visitor_id,
          model: bodyPayload.model,
          state: returnedState
        });
        setTimeout(() => {
          global.chatdaySession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[CHATDAY BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("chatday") || firstWord.endsWith("cday") || firstWord.endsWith("chatdayai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        return ctx.reply(`💬 *CHATDAY AI USAGE*\n\n` + `• *Chat Standar:*\n` + `  👉 \`${prefix}chatday apa kabar bang\`\n\n` + `• *Pilih Model Khusus:*\n` + `  👉 \`${prefix}chatday Siapa kamu? --model openai/gpt-4o\`\n` + `  👉 \`${prefix}chatday Buatkan kode --model anthropic/claude-sonnet-4.6\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!\n\n` + `• *Parameter Opsional:*\n` + `  • \`--model <id_model>\`\n` + `  • \`--state <token_state>\`\n` + `  • \`--conv <conversation_id>\`\n` + `  • \`--visitor <visitor_id>\``);
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || "Halo",
        model: flags.model || "chatday/ai-chat",
        conversation_id: flags.conversation_id || null,
        visitor_id: flags.visitor_id || null,
        state: flags.state || null
      };
      const data = await requestChatDay(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari ChatDay AI.");
      }
      const answerText = typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.";
      const returnedState = data.state || bodyPayload.state || "";
      const convChunk = Array.isArray(data.chunks) ? data.chunks.find(c => c.type === "data-conversation")?.data : null;
      const conversationId = convChunk?.conversationId || bodyPayload.conversation_id || null;
      let bodyText = `💬 *CHATDAY AI RESPONSE*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🤖 *Model:* \`${bodyPayload.model}\`\n` + `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi chat._`;
      const footerText = `${botName} • ChatDay Engine`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      if (returnedState) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 CHATDAY AI 乂",
          subtitle: `Model: ${bodyPayload.model}`,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const questionMsgId = sentMsg?.key?.id;
      if (questionMsgId) {
        global.chatdaySession.set(questionMsgId, {
          conversation_id: conversationId,
          visitor_id: bodyPayload.visitor_id,
          model: bodyPayload.model,
          state: returnedState
        });
        setTimeout(() => {
          global.chatdaySession.delete(questionMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ ChatDay AI Error: ${errMsg}`);
    }
  }
};