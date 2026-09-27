import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/cosmicup";
const MODES = ["chat", "image", "audio"];
const MODELS = ["openai/gpt-5.4-nano", "openai/gpt-5.4-mini", "openai/gpt-5.4", "gpt-image-1-mini", "cosmicup_music_agent", "openai/gpt-4o", "deepseek/deepseek-chat", "google/gemini-2.5-pro-preview"];

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (key.toLowerCase() === "chat" || key.toLowerCase() === "chat_id") key = "chatID";
    if (key.toLowerCase() === "token_jwt") key = "token";
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
  name: "cosmicup",
  aliases: ["cosmic", "cupai"],
  description: "AI Multimodal Cosmicup (Chat, Image Generator, & Audio Agent)",
  category: "AI",
  example: "cosmicup Mobil antik di kota --mode image --image_resolution 1:1",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        const helpText = `🌌 *COSMICUP AI ASSISTANT*\n\n` + `• *Chat Mode:*\n` + `  👉 \`${prefix}cosmicup Halo, jelaskan tentang Black Hole\`\n\n` + `• *Image Generator:*\n` + `  👉 \`${prefix}cosmicup a cute vintage car --mode image --model gpt-image-1-mini\`\n\n` + `• *Audio / Music Agent:*\n` + `  👉 \`${prefix}cosmicup buatkan beat lofi santai --mode audio\`\n\n` + `• *Dukungan Override Flag Body:*\n` + `  Gunakan flag apa saja untuk override payload body:\n` + `  \`--mode <chat|image|audio>\`\n` + `  \`--model <nama_model>\`\n` + `  \`--image_resolution <1:1|16:9|9:16>\`\n` + `  \`--chatID <id>\`\n` + `  \`--token <token>\`\n` + `  \`--<custom_key> <value>\``;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const mode = (flags.mode || "chat").toLowerCase();
      let defaultModel = "openai/gpt-5.4-mini";
      if (mode === "image") defaultModel = "gpt-image-1-mini";
      else if (mode === "audio") defaultModel = "cosmicup_music_agent";
      const bodyPayload = {
        prompt: flags.prompt || cleanPrompt || "Halo",
        mode: mode,
        model: flags.model || defaultModel,
        ...flags
      };
      const {
        data
      } = await axios.post(API_URL, bodyPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      if (!data || !data.status || !data.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses permintaan: ${data?.message || "Format respon API tidak valid."}`);
      }
      const resObj = data.result;
      const returnedChatId = data.chatID || resObj.chat_id || bodyPayload.chatID || "";
      const returnedToken = data.token || bodyPayload.token || "";
      const returnedMsg = resObj.message || resObj.formatted_message || "-";
      const imageUrls = resObj.image_urls || [];
      const attachments = resObj.attachments || [];
      let finalImageUrl = imageUrls[0] || null;
      if (!finalImageUrl && typeof resObj.formatted_message === "string") {
        const matchUrl = resObj.formatted_message.match(/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp)/i);
        if (matchUrl) finalImageUrl = matchUrl[0];
      }
      let finalAudioUrl = null;
      if (bodyPayload.mode === "audio") {
        const audioAttach = attachments.find(att => att.type === "audio" || att.url && att.url.match(/\.(?:mp3|wav|ogg|m4a)/i));
        if (audioAttach?.url) finalAudioUrl = audioAttach.url;
        else if (data.audio || resObj.audio) finalAudioUrl = data.audio || resObj.audio;
      }
      if (finalAudioUrl) {
        await sock.sendMessage(ctx.id, {
          audio: {
            url: finalAudioUrl
          },
          mimetype: "audio/mp4",
          ptt: false
        }, {
          quoted: quotedMsg
        });
        await ctx.react("🎶");
        return;
      }
      const bodyText = `🌌 *COSMICUP AI RESPONSE*\n\n` + `🎭 *Mode:* \`${bodyPayload.mode.toUpperCase()}\`\n` + `🤖 *Model:* \`${resObj.model || bodyPayload.model}\`\n` + `🆔 *Chat ID:* \`${returnedChatId || "-"}\`\n` + `────────────────────────\n\n` + `${returnedMsg}\n\n` + `_💡 Klik tombol copy di bawah untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • Cosmicup AI`;
      const nextSessionCommand = `${prefix}cosmicup <tulis_prompt_disini> --mode ${bodyPayload.mode} --chatID ${returnedChatId} --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextSessionCommand
      }, {
        name: "cta_copy",
        display_text: "🔑 Salin Token Saja",
        copy_code: returnedToken
      }];
      if (finalImageUrl) {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, {
            title: `乂 COSMICUP AI - ${bodyPayload.mode.toUpperCase()} 乂`,
            subtitle: `Model: ${resObj.model || bodyPayload.model}`,
            media: finalImageUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: finalImageUrl
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      } else {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, {
            title: `乂 COSMICUP AI 乂`,
            subtitle: `Mode: ${bodyPayload.mode.toUpperCase()}`,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan: ${errMsg}`);
    }
  }
};