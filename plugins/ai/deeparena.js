import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://www.wudysoft.my.id/api/ai/deeparena";
global.deeparenaSession = global.deeparenaSession || new Map();

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["state", "session", "sess", "session_id"].includes(key)) key = "state";
    if (["image", "img", "media"].includes(key)) key = "media";
    if (["reasoning", "think", "thought"].includes(key)) key = "reasoning";
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
async function requestDeepArena(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    timeout: 9e4
  });
  return data;
}

function formatArenaResult(result, reasoning = null, showReasoning = false) {
  let text = "";
  if (typeof result === "string") {
    return result;
  }
  const resA = result?.A || "";
  const resB = result?.B || "";
  if (resA && resB) {
    text += `🅰️ *RESPON MODEL A:*\n${resA.trim()}\n\n`;
    text += `────────────────────────\n\n`;
    text += `🅱️ *RESPON MODEL B:*\n${resB.trim()}`;
  } else if (resA) {
    text += `${resA.trim()}`;
  } else if (resB) {
    text += `${resB.trim()}`;
  } else {
    text = "Tidak ada teks respon.";
  }
  if (showReasoning && reasoning) {
    const reasonA = reasoning?.A ? `🧠 *Reasoning A:*\n_${reasoning.A.slice(0, 300)}..._\n\n` : "";
    const reasonB = reasoning?.B ? `🧠 *Reasoning B:*\n_${reasoning.B.slice(0, 300)}..._\n\n` : "";
    if (reasonA || reasonB) {
      text = `${reasonA}${reasonB}────────────────────────\n\n` + text;
    }
  }
  return text;
}
export default {
  name: "deeparena",
  aliases: ["deep-arena", "darena", "arenaai"],
  description: "AI Dual Battle & Multimodal Assistant via DeepArena (Support State & Session Reply)",
  category: "AI",
  limit: true,
  example: "deeparena Jelaskan cara kerja mobil listrik atau reply pesan bot untuk melanjutkan",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.deeparenaSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.deeparenaSession.get(quotedStanzaId);
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
        state: prevSession.state || null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestDeepArena(bodyPayload);
      if (!data || data.status !== "success" && data.status !== true || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari DeepArena.");
      }
      const answerText = formatArenaResult(data.result, data.reasoning, false);
      const returnedState = data.state || bodyPayload.state || null;
      const sessionCode = returnedState?.sessionCode || (typeof returnedState === "string" ? returnedState : "");
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `⚔️ *DEEPARENA AI BATTLE*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n`;
      if (sessionCode) bodyText += `🆔 *Session:* \`${sessionCode}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText}\n\n` + `_💡 Balas/reply pesan ini untuk melanjutkan obrolan._`;
      const footerText = `${botName} • DeepArena AI`;
      const copyText = typeof data.result === "string" ? data.result : data.result?.A || data.result?.B || answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: copyText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 DEEPARENA ASSISTANT 乂",
          subtitle: `Session: ${sessionCode ? "Active" : "New"}`,
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
        global.deeparenaSession.set(newMsgId, {
          state: returnedState
        });
        setTimeout(() => {
          global.deeparenaSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[DEEPARENA BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["deeparena", "deep-arena", "darena", "arenaai"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`⚔️ *DEEPARENA AI BATTLE ASSISTANT*\n\n` + `• *Chat & Arena Dual Respon:*\n` + `  👉 \`${prefix}deeparena Jelaskan teori relativitas secara singkat\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!\n\n` + `• *Analisis Gambar / Multimodal:*\n` + `  👉 Kirim/balas gambar dengan: \`${prefix}deeparena Jelaskan isi gambar ini\`\n\n` + `• *Opsi Parameter Flags:*\n` + `  • \`--think\` (Tampilkan proses penalaran / reasoning AI)\n` + `  • \`--media <url>\` (URL gambar langsung)\n` + `  • \`--state <json_state>\` (State sesi lanjutan)`);
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
        prompt: cleanPrompt || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Halo"),
        state: flags.state ? typeof flags.state === "string" ? JSON.parse(flags.state) : flags.state : null,
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {}
      };
      const data = await requestDeepArena(bodyPayload);
      if (!data || data.status !== "success" && data.status !== true || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari DeepArena.");
      }
      const showReasoning = Boolean(flags.reasoning || flags.think);
      const answerText = formatArenaResult(data.result, data.reasoning, showReasoning);
      const returnedState = data.state || bodyPayload.state || null;
      const sessionCode = returnedState?.sessionCode || (typeof returnedState === "string" ? returnedState : "");
      let bodyText = `⚔️ *DEEPARENA AI BATTLE*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n`;
      if (sessionCode) bodyText += `🆔 *Session Code:* \`${sessionCode}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • DeepArena AI`;
      const copyText = typeof data.result === "string" ? data.result : data.result?.A || data.result?.B || answerText;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: copyText
      }];
      if (sessionCode) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Session Code",
          copy_code: sessionCode
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 DEEPARENA ASSISTANT 乂",
          subtitle: `Session: ${sessionCode ? "Active" : "New"}`,
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
        global.deeparenaSession.set(sentMsgId, {
          state: returnedState
        });
        setTimeout(() => {
          global.deeparenaSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ DeepArena Error: ${errMsg}`);
    }
  }
};