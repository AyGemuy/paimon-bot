import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/ai-seek";
global.aiseekSession = global.aiseekSession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["session_id", "sess"].includes(key)) key = "session";
    if (["token_jwt", "jwt"].includes(key)) key = "token";
    if (["image", "img"].includes(key)) key = "media";
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
async function requestAiSeek(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 9e4
  });
  return data;
}
export default {
  name: "aiseek",
  aliases: ["ai-seek", "seekai"],
  description: "AI Chat & Multimodal Assistant via AI-Seek Engine (Support Session Reply)",
  category: "AI",
  limit: true,
  example: "aiseek Siapa penemu lampu pijar? atau reply pesan bot untuk melanjutkan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.aiseekSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.aiseekSession.get(quotedStanzaId);
      if (typeof ctx?.react === "function") await ctx.react("💭");
      let uploadedMediaUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: userText || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Lanjutkan"),
        session: prevSession.session || null,
        token: prevSession.token || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestAiSeek(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari AI-Seek.");
      }
      const answerText = typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.";
      const returnedSession = data.session || bodyPayload.session || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `🤖 *AI-SEEK CONVERSATION*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n`;
      if (returnedSession) bodyText += `🆔 *Session:* \`${returnedSession}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Balas/reply pesan ini untuk melanjutkan obrolan._`;
      const footerText = `${botName} • AI-Seek Assistant`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 AI-SEEK ASSISTANT 乂",
          subtitle: `Session: ${returnedSession ? "Active" : "New"}`,
          media: uploadedMediaUrl || null,
          quoted: msg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
          },
          caption: bodyText
        }, {
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
        global.aiseekSession.set(newMsgId, {
          session: returnedSession,
          token: returnedToken
        });
        setTimeout(() => {
          global.aiseekSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[AI-SEEK BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("aiseek") || firstWord.endsWith("ai-seek") || firstWord.endsWith("seekai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`🤖 *AI-SEEK SMART ASSISTANT*\n\n` + `• *Chat Standar:*\n` + `  👉 \`${prefix}aiseek Jelaskan konsep dasar quantum computing\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung!\n\n` + `• *Analisis Gambar / Media:*\n` + `  👉 Kirim/balas gambar dengan: \`${prefix}aiseek Jelaskan gambar ini\`\n\n` + `• *Opsi Parameter Flag:*\n` + `  • \`--session <session_id>\` (Lanjut sesi obrolan manual)\n` + `  • \`--token <token_jwt>\` (Token autentikasi)\n` + `  • \`--media <url>\` (URL media langsung)`);
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedMediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedMediaUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Halo"),
        session: flags.session || null,
        token: flags.token || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {},
        ...flags.messages ? {
          messages: typeof flags.messages === "string" ? JSON.parse(flags.messages) : flags.messages
        } : {},
        ...flags
      };
      const data = await requestAiSeek(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari AI-Seek.");
      }
      const answerText = typeof data.result === "string" ? data.result : data.result?.content || "Tidak ada respon.";
      const returnedSession = data.session || bodyPayload.session || "";
      const returnedToken = data.token || bodyPayload.token || "";
      let bodyText = `🤖 *AI-SEEK RESPONSE*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n`;
      if (returnedSession) bodyText += `🆔 *Session:* \`${returnedSession}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • AI-Seek Assistant`;
      let nextCommand = `${prefix}aiseek <tulis_prompt_lanjutan>`;
      if (returnedSession) nextCommand += ` --session ${returnedSession}`;
      if (returnedToken) nextCommand += ` --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      });
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 AI-SEEK ASSISTANT 乂",
          subtitle: `Session: ${returnedSession ? "Active" : "New"}`,
          media: uploadedMediaUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedMediaUrl) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedMediaUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        global.aiseekSession.set(sentMsgId, {
          session: returnedSession,
          token: returnedToken
        });
        setTimeout(() => {
          global.aiseekSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ AI-Seek Error: ${errMsg}`);
    }
  }
};