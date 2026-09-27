import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/atale";
global.ataleSession = global.ataleSession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["session_id", "sess"].includes(key)) key = "sessionid";
    if (["bot_id", "botid", "bot"].includes(key)) key = "botid";
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
async function requestATale(payload) {
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
  name: "atale",
  aliases: ["atale-ai", "ataleai"],
  description: "AI Character Chat & Search via ATale Engine (Support Session Reply)",
  category: "AI",
  limit: true,
  example: "atale search Aizawa\natale Halo --botid 161594",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.ataleSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.ataleSession.get(quotedStanzaId);
      if (typeof ctx?.react === "function") await ctx.react("💭");
      const bodyPayload = {
        action: "chat",
        prompt: userText || "Lanjutkan",
        botId: prevSession.botId,
        sessionId: prevSession.sessionId || null,
        state: prevSession.state || null
      };
      const data = await requestATale(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon dari ATale.");
      }
      const answerText = data.result || "Tidak ada respon.";
      const returnedSessionId = data.chunks?.[0]?.sessionId || bodyPayload.sessionId || "";
      const returnedState = data.state || bodyPayload.state || "";
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `🤖 *ATALE CHARACTER CHAT*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🎭 *Bot ID:* \`${bodyPayload.botId}\`\n`;
      if (returnedSessionId) bodyText += `🆔 *Session:* \`${returnedSessionId}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Balas/reply pesan ini untuk melanjutkan obrolan dengan karakter._`;
      const footerText = `${botName} • ATale Assistant`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ATALE ASSISTANT 乂",
          subtitle: `Session: ${returnedSessionId ? "Active" : "New"}`,
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
        global.ataleSession.set(newMsgId, {
          botId: bodyPayload.botId,
          sessionId: returnedSessionId,
          state: returnedState
        });
        setTimeout(() => {
          global.ataleSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ATALE BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("atale") || firstWord.endsWith("atale-ai") || firstWord.endsWith("ataleai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        return ctx.reply(`🤖 *ATALE SMART CHARACTER*\n\n` + `• *Cari Karakter:*\n` + `  👉 \`${prefix}atale search Aizawa\`\n\n` + `• *Lihat Karakter Beranda (Home):*\n` + `  👉 \`${prefix}atale home\`\n\n` + `• *Chat dengan Karakter:*\n` + `  👉 \`${prefix}atale Halo! --botid 161594\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung!\n\n` + `• *Opsi Parameter Chat:*\n` + `  • \`--botid <id_karakter>\` (Wajib untuk mulai chat)\n` + `  • \`--sessionid <session_id>\` (Lanjut sesi)\n` + `  • \`--state <state_base64>\` (Lanjut state)`);
      }
      await ctx.react("💭");
      const [command, ...args] = rawText.split(/\s+/);
      const isSearch = command.toLowerCase() === "search";
      const isHome = command.toLowerCase() === "home";
      if (isSearch || isHome) {
        const payload = isSearch ? {
          action: "search",
          query: args.join(" ") || ""
        } : {
          action: "home"
        };
        const data = await requestATale(payload);
        if (!data || !data.status || !data.result || !Array.isArray(data.result)) {
          throw new Error("Gagal mengambil data karakter dari ATale.");
        }
        if (data.result.length === 0) {
          return ctx.reply("❌ Tidak ditemukan karakter untuk pencarian tersebut.");
        }
        let txt = `🤖 *ATALE CHARACTER ${isSearch ? "SEARCH" : "HOME"}*\n\n`;
        const limitRes = data.result.slice(0, 7);
        limitRes.forEach((bot, i) => {
          txt += `*${i + 1}. ${bot.displayName}*\n`;
          txt += `🆔 ID: \`${bot.id}\`\n`;
          txt += `🏷 Tags: ${bot.tags || "-"}\n`;
          txt += `💬 Intro: ${bot.description ? bot.description.slice(0, 100) + "..." : "-"}\n\n`;
        });
        txt += `_💡 Gunakan \`${prefix}atale <pesan> --botid <ID>\` untuk memulai chat._`;
        if (limitRes[0]?.avatar) {
          return sock.sendMessage(ctx.id, {
            image: {
              url: limitRes[0].avatar
            },
            caption: txt
          }, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(txt);
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const botId = flags.botid || flags.bot || flags.bot_id;
      if (!botId) {
        return ctx.reply(`❌ Harap sertakan ID Karakter!\nContoh: \`${prefix}atale Hai --botid 161594\``);
      }
      const bodyPayload = {
        action: "chat",
        prompt: cleanPrompt || "Halo",
        botId: parseInt(botId),
        sessionId: flags.sessionid || null,
        state: flags.state || null
      };
      const data = await requestATale(bodyPayload);
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal mendapatkan respon chat dari ATale.");
      }
      const answerText = data.result || "Tidak ada respon.";
      const returnedSessionId = data.chunks?.[0]?.sessionId || bodyPayload.sessionId || "";
      const returnedState = data.state || bodyPayload.state || "";
      let bodyText = `🤖 *ATALE CHARACTER CHAT*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🎭 *Bot ID:* \`${bodyPayload.botId}\`\n`;
      if (returnedSessionId) bodyText += `🆔 *Session:* \`${returnedSessionId}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • ATale Assistant`;
      let nextCommand = `${prefix}atale <pesan> --botid ${bodyPayload.botId}`;
      if (returnedSessionId) nextCommand += ` --sessionid ${returnedSessionId}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Format Lanjut",
        copy_code: nextCommand
      }, {
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ATALE ASSISTANT 乂",
          subtitle: `Session: ${returnedSessionId ? "Active" : "New"}`,
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
        global.ataleSession.set(sentMsgId, {
          botId: bodyPayload.botId,
          sessionId: returnedSessionId,
          state: returnedState
        });
        setTimeout(() => {
          global.ataleSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ ATale Error: ${errMsg}`);
    }
  }
};