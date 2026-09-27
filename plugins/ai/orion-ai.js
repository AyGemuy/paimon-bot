import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/orion-ai";
global.orionSession = global.orionSession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["chatmodel", "model_chat"].includes(key)) key = "chatModel";
    if (["imagemodel", "model_img", "imgmodel"].includes(key)) key = "imageModel";
    if (["chat_id", "cid"].includes(key)) key = "chatId";
    if (["aspect", "ar"].includes(key)) key = "aspectRatio";
    if (["img", "image", "draw", "generate"].includes(key)) key = "gen";
    if (["list", "model"].includes(key) && rawVal === undefined) key = "models";
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
async function requestOrion(payload) {
  const res = await axios.post(API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 9e4
  });
  return res.data;
}
export default {
  name: "orionai",
  aliases: ["orion", "orion-ai", "orionchat"],
  description: "Advanced Multi-Model AI Assistant & Image Generator via Orion AI",
  category: "AI",
  limit: true,
  example: "orionai apa kabar bang atau orionai buatkan gambar kucing --gen",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.orionSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.orionSession.get(quotedStanzaId);
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
        mode: "chat",
        content: userText || (uploadedMediaUrl ? "Jelaskan media/gambar ini secara detail" : "Lanjutkan"),
        chatId: prevSession.chatId || null,
        chatModel: prevSession.chatModel || null,
        imageModel: prevSession.imageModel || null,
        ...uploadedMediaUrl ? {
          attachments: [uploadedMediaUrl]
        } : {}
      };
      const res = await requestOrion(bodyPayload);
      if (!res || !res.ok || !res.data) {
        throw new Error(res?.message || res?.error || "Gagal mendapatkan respon dari Orion AI.");
      }
      const resultData = res.data;
      const answerText = resultData.text || "Tidak ada respon teks.";
      const newChatId = resultData.chatId || prevSession.chatId || null;
      const attImages = (resultData.att || []).filter(a => a.mimeType && a.mimeType.startsWith("image/"));
      const botName = global.bot?.name || "WudysoftBot";
      let bodyText = `🌌 *ORION AI CONVERSATION*\n\n` + `📝 *Prompt:* ${bodyPayload.content}\n` + `🤖 *Model:* \`${bodyPayload.chatModel || "Default"}\`\n`;
      if (newChatId) bodyText += `🆔 *Chat ID:* \`${newChatId}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi chat._`;
      const footerText = `${botName} • Orion AI Engine`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (attImages.length > 0) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: attImages[0].url
          },
          caption: bodyText
        }, {
          quoted: msg
        });
      } else if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ORION AI CHAT 乂",
          subtitle: `ChatId: ${newChatId ? "Active" : "New"}`,
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
        global.orionSession.set(newMsgId, {
          chatId: newChatId,
          chatModel: bodyPayload.chatModel,
          imageModel: bodyPayload.imageModel,
          seq: resultData.seq || 0
        });
        setTimeout(() => {
          global.orionSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✨");
      return true;
    } catch (e) {
      console.error("[ORION BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("orionai") || firstWord.endsWith("orion") || firstWord.endsWith("orion-ai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (rawText.includes("--models") || rawText.includes("--list") || rawText.trim() === "models") {
        await ctx.react("⏳");
        const resModels = await axios.get(`${API_URL}?mode=models`, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 3e4
        });
        const modelsData = resModels.data?.data;
        if (!modelsData) throw new Error("Gagal mengambil daftar model Orion AI.");
        let textList = `🌌 *ORION AI - AVAILABLE MODELS*\n\n` + `🤖 *Chat / Language Models:*\n`;
        (modelsData.chat || []).forEach(m => {
          textList += `• \`${m.id}\` — *${m.name}* (${m.pro ? "PRO" : "FREE"})\n`;
        });
        textList += `\n🎨 *Image Generation Models:*\n`;
        (modelsData.img || []).forEach(m => {
          textList += `• \`${m.id}\` — *${m.name}* (${m.pro ? "PRO" : "FREE"})\n`;
        });
        textList += `\n_Gunakan flag \`--model <id_model>\` saat chat atau \`--imagemodel <id_img>\` saat generate gambar._`;
        await ctx.react("📋");
        return ctx.reply(textList);
      }
      if (!rawText && !isMedia) {
        return ctx.reply(`🌌 *ORION AI ADVANCED ASSISTANT*\n\n` + `• *Chat Standar:*\n` + `  👉 \`${prefix}orionai Halo, apa kabar?\`\n\n` + `• *Ganti Model Chat:*\n` + `  👉 \`${prefix}orionai Jelaskan fisika kuantum --model claude-sonnet-5\`\n` + `  👉 \`${prefix}orionai Buatkan kode Python --model deepseek-reasoner\`\n\n` + `• *Generate Gambar / Text-to-Image:*\n` + `  👉 \`${prefix}orionai a cute cat in the garden --gen\`\n` + `  👉 \`${prefix}orionai cyberpunk city --gen --imagemodel flux-2-dev --aspect 16:9\`\n\n` + `• *Image-to-Image / Edit Gambar:*\n` + `  👉 Kirim/balas gambar dengan: \`${prefix}orionai make this anime style --gen\`\n\n` + `• *Lihat Semua Model:*\n` + `  👉 \`${prefix}orionai --models\`\n\n` + `• *Multi-Turn Session:*\n` + `  👉 Cukup *reply pesan bot* untuk melanjutkan obrolan secara langsung!`);
      }
      await ctx.react("💭");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
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
      const isGenMode = Boolean(flags.gen || flags.mode === "gen");
      if (isGenMode) {
        const genPayload = {
          mode: "gen",
          prompt: cleanPrompt || flags.prompt || "a beautiful digital art",
          imageModel: flags.imageModel || flags.model || "flux-2-dev",
          ...flags.aspectRatio ? {
            aspectRatio: flags.aspectRatio
          } : {},
          ...uploadedMediaUrl ? {
            media: uploadedMediaUrl
          } : {}
        };
        const res = await requestOrion(genPayload);
        if (!res || !res.ok || !res.data) {
          throw new Error(res?.message || res?.error || "Gagal meng-generate gambar dari Orion AI.");
        }
        const dataGen = res.data;
        const images = dataGen.images || [];
        const captionText = `🎨 *ORION AI IMAGE GENERATOR*\n\n` + `📝 *Prompt:* ${genPayload.prompt}\n` + `🤖 *Model:* \`${genPayload.imageModel}\`\n` + (dataGen.text ? `💬 *Keterangan:* ${dataGen.text}\n` : "") + (images[0]?.description ? `\n📋 _${images[0].description}_\n` : "");
        if (images.length > 0 && images[0].url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: images[0].url
            },
            caption: captionText
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(captionText);
        }
        await ctx.react("🎨");
        return;
      }
      const bodyPayload = {
        mode: "chat",
        content: cleanPrompt || flags.content || (uploadedMediaUrl ? "Jelaskan gambar ini secara detail" : "Halo"),
        chatId: flags.chatId || null,
        chatModel: flags.chatModel || flags.model || null,
        imageModel: flags.imageModel || null,
        ...flags.thinking !== undefined ? {
          thinking: Boolean(flags.thinking)
        } : {},
        ...uploadedMediaUrl ? {
          attachments: [uploadedMediaUrl]
        } : {}
      };
      const res = await requestOrion(bodyPayload);
      if (!res || !res.ok || !res.data) {
        throw new Error(res?.message || res?.error || "Gagal mendapatkan respon dari Orion AI.");
      }
      const resultData = res.data;
      const answerText = resultData.text || "Tidak ada respon teks.";
      const returnedChatId = resultData.chatId || bodyPayload.chatId || null;
      const attImages = (resultData.att || []).filter(a => a.mimeType && a.mimeType.startsWith("image/"));
      let bodyText = `🌌 *ORION AI RESPONSE*\n\n` + `📝 *Prompt:* ${bodyPayload.content}\n` + `🤖 *Model:* \`${bodyPayload.chatModel || "Default"}\`\n`;
      if (returnedChatId) bodyText += `🆔 *Chat ID:* \`${returnedChatId}\`\n`;
      bodyText += `────────────────────────\n\n` + `${answerText.trim()}\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • Orion AI Engine`;
      let nextCommand = `${prefix}orionai <tulis_prompt_lanjutan>`;
      if (returnedChatId) nextCommand += ` --chatId ${returnedChatId}`;
      if (bodyPayload.chatModel) nextCommand += ` --model ${bodyPayload.chatModel}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Sesi",
        copy_code: nextCommand
      }, {
        name: "cta_copy",
        display_text: "📄 Salin Jawaban",
        copy_code: answerText
      }];
      let sentMsg;
      if (attImages.length > 0) {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: attImages[0].url
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 ORION AI ASSISTANT 乂",
          subtitle: `ChatId: ${returnedChatId ? "Active" : "New"}`,
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
        global.orionSession.set(sentMsgId, {
          chatId: returnedChatId,
          chatModel: bodyPayload.chatModel,
          imageModel: bodyPayload.imageModel,
          seq: resultData.seq || 0
        });
        setTimeout(() => {
          global.orionSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Orion AI Error: ${errMsg}`);
    }
  }
};