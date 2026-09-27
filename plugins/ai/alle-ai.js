import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/alle-ai";
global.alleaiSession = global.alleaiSession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["session", "session_id", "conversation_session", "conv"].includes(key)) key = "conversation";
    if (["web", "websearch"].includes(key)) key = "web_search";
    if (["token_jwt"].includes(key)) key = "token";
    if (["models"].includes(key)) key = "model";
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
async function requestAlleAi(payload) {
  const {
    data
  } = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 12e4
  });
  return data;
}
export default {
  name: "alleai",
  aliases: ["alle", "alle-ai"],
  description: "Multimodel AI Ensemble with Web Search, Combine, Compare & Media Support (Auto Session)",
  category: "AI",
  limit: true,
  example: "alleai Jelaskan gambar ini --web_search --compare",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.alleaiSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.alleaiSession.get(quotedStanzaId);
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
        prompt: userText || (uploadedMediaUrl ? "Jelaskan media ini secara detail" : "Lanjutkan"),
        web_search: Boolean(prevSession.web_search ?? false),
        combine: Boolean(prevSession.combine ?? false),
        compare: Boolean(prevSession.compare ?? false),
        conversation: prevSession.conversation || null,
        token: prevSession.token || null,
        ...prevSession.model ? {
          model: prevSession.model
        } : {},
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : {}
      };
      const data = await requestAlleAi(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Alle AI.");
      }
      const resObj = data.result;
      const returnedSession = resObj.conversation_session || resObj.conversation || bodyPayload.conversation || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const modelsUsed = resObj.models_used || (bodyPayload.model ? [bodyPayload.model] : []);
      const primaryResponse = resObj.response || "Tidak ada respon.";
      const outputs = resObj.outputs || {};
      let outputDetails = "";
      const modelKeys = Object.keys(outputs);
      if (bodyPayload.compare && modelKeys.length > 0) {
        for (const modelKey of modelKeys) {
          const modelRes = outputs[modelKey]?.response || outputs[modelKey]?.raw_response || "";
          outputDetails += `╭───『 *MODEL: ${modelKey.toUpperCase()}* 』\n${modelRes.trim()}\n╰────────────────────────\n\n`;
        }
      } else {
        outputDetails = primaryResponse;
      }
      const featuresActive = [bodyPayload.web_search ? "🌐 Web Search" : "", bodyPayload.combine ? "🧬 Combine" : "", bodyPayload.compare ? "⚖️ Compare" : "", uploadedMediaUrl ? "🖼️ Media Uploaded" : ""].filter(Boolean).join(" | ") || "Standard Chat";
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `🌐 *ALLE AI CONVERSATION*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🤖 *Models:* ${modelsUsed.map(m => `\`${m}\``).join(", ") || "Auto Ensemble"}\n` + `⚙️ *Fitur:* \`${featuresActive}\`\n`;
      if (returnedSession) bodyText += `🆔 *Conversation:* \`${returnedSession}\`\n`;
      bodyText += `────────────────────────\n\n` + `${outputDetails.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi obrolan._`;
      const footerText = `${botName} • Alle AI Ensemble`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: primaryResponse
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ALLE AI ENSEMBLE 乂",
          subtitle: `Mode: ${featuresActive}`,
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
        global.alleaiSession.set(newMsgId, {
          conversation: returnedSession,
          token: returnedToken,
          model: bodyPayload.model,
          web_search: bodyPayload.web_search,
          combine: bodyPayload.combine,
          compare: bodyPayload.compare
        });
        setTimeout(() => {
          global.alleaiSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ALLE-AI BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("alleai") || firstWord.endsWith("alle") || firstWord.endsWith("alle-ai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`🌐 *ALLE AI MULTI-MODEL ASSISTANT*\n\n` + `• *Chat Standar:*\n` + `  👉 \`${prefix}alleai Jelaskan teori relativitas Einstein\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara otomatis!\n\n` + `• *Chat dengan Web Search (Real-time):*\n` + `  👉 \`${prefix}alleai Berita teknologi terbaru hari ini --web_search\`\n\n` + `• *Mode Compare (Bandingkan Multi-Model):*\n` + `  👉 \`${prefix}alleai Buatkan puisi tentang senja --compare\`\n\n` + `• *Mode Combine (Gabungkan Jawaban Terbaik):*\n` + `  👉 \`${prefix}alleai Cara membuat website dari nol --combine\`\n\n` + `• *Analisis Media / Gambar:*\n` + `  👉 Kirim/balas gambar dengan: \`${prefix}alleai Jelaskan detail gambar ini\`\n\n` + `• *Daftar Flag Parameter:*\n` + `  • \`--model <nama_model>\` (Pilih model spesifik)\n` + `  • \`--web_search\` (Aktifkan pencarian web)\n` + `  • \`--compare\` (Mode komparasi antar model)\n` + `  • \`--combine\` (Mode sintesis gabungan)\n` + `  • \`--conversation <id>\` (Lanjut sesi obrolan manual)\n` + `  • \`--token <token>\` (Token autentikasi)`);
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
        prompt: flags.prompt || cleanPrompt || (uploadedMediaUrl ? "Jelaskan media/gambar ini secara detail" : "Halo"),
        web_search: Boolean(flags.web_search ?? false),
        combine: Boolean(flags.combine ?? false),
        compare: Boolean(flags.compare ?? false),
        conversation: flags.conversation || null,
        token: flags.token || null,
        ...flags.model ? {
          model: flags.model
        } : {},
        ...flags.messages ? {
          messages: typeof flags.messages === "string" ? JSON.parse(flags.messages) : flags.messages
        } : {},
        ...uploadedMediaUrl ? {
          media: uploadedMediaUrl
        } : flags.media ? {
          media: flags.media
        } : {},
        ...flags
      };
      const data = await requestAlleAi(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari Alle AI.");
      }
      const resObj = data.result;
      const returnedSession = resObj.conversation_session || resObj.conversation || bodyPayload.conversation || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const modelsUsed = resObj.models_used || (bodyPayload.model ? [bodyPayload.model] : []);
      const primaryResponse = resObj.response || "Tidak ada respon.";
      const outputs = resObj.outputs || {};
      let outputDetails = "";
      const modelKeys = Object.keys(outputs);
      if (bodyPayload.compare && modelKeys.length > 0) {
        for (const modelKey of modelKeys) {
          const modelRes = outputs[modelKey]?.response || outputs[modelKey]?.raw_response || "";
          outputDetails += `╭───『 *MODEL: ${modelKey.toUpperCase()}* 』\n${modelRes.trim()}\n╰────────────────────────\n\n`;
        }
      } else {
        outputDetails = primaryResponse;
      }
      const featuresActive = [bodyPayload.web_search ? "🌐 Web Search" : "", bodyPayload.combine ? "🧬 Combine" : "", bodyPayload.compare ? "⚖️ Compare" : "", uploadedMediaUrl ? "🖼️ Media Uploaded" : ""].filter(Boolean).join(" | ") || "Standard Chat";
      let bodyText = `🌐 *ALLE AI MULTI-MODEL RESPONSE*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🤖 *Models:* ${modelsUsed.map(m => `\`${m}\``).join(", ") || "Auto Ensemble"}\n` + `⚙️ *Fitur:* \`${featuresActive}\`\n`;
      if (returnedSession) bodyText += `🆔 *Conversation:* \`${returnedSession}\`\n`;
      bodyText += `────────────────────────\n\n` + `${outputDetails.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • Alle AI Ensemble`;
      let nextCommand = `${prefix}alleai <tulis_prompt_lanjutan>`;
      if (returnedSession) nextCommand += ` --conversation ${returnedSession}`;
      if (returnedToken) nextCommand += ` --token ${returnedToken}`;
      if (bodyPayload.web_search) nextCommand += ` --web_search`;
      if (bodyPayload.combine) nextCommand += ` --combine`;
      if (bodyPayload.compare) nextCommand += ` --compare`;
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
        copy_code: primaryResponse
      });
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ALLE AI ENSEMBLE 乂",
          subtitle: `Mode: ${featuresActive}`,
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
        global.alleaiSession.set(sentMsgId, {
          conversation: returnedSession,
          token: returnedToken,
          model: bodyPayload.model,
          web_search: bodyPayload.web_search,
          combine: bodyPayload.combine,
          compare: bodyPayload.compare
        });
        setTimeout(() => {
          global.alleaiSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Alle AI Error: ${errMsg}`);
    }
  }
};