import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/joyfun";
global.joyfunSession = global.joyfunSession || new Map();

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["res", "size", "aspect", "aspect_ratio", "ratio"].includes(key)) key = "resolution";
    if (["img", "media"].includes(key)) key = "image";
    if (["token_jwt", "jwt", "state"].includes(key)) key = "token";
    if (["models", "list"].includes(key) && rawVal === undefined) key = "listModels";
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
async function requestJoyFun(payload) {
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
  name: "joyfun",
  aliases: ["joyfunai", "joyart", "joyai"],
  description: "High-Quality AI Image Generator & Editor (JoyFun & Seedream Engines)",
  category: "AI",
  limit: true,
  example: "joyfun a cute car --model 'JoyFun Spicy' --ratio 16:9",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || !global.joyfunSession.has(quotedStanzaId)) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const isMedia = ctx?.isMedia || ctx?.quoted?.isMedia;
      if (!userText && !isMedia) return;
      const prevSession = global.joyfunSession.get(quotedStanzaId);
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      let uploadedImageUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: userText || "make it higher quality, masterpiece, detailed",
        model: prevSession.model || "JoyFun Spicy",
        token: prevSession.token || null,
        ...prevSession.resolution ? {
          resolution: prevSession.resolution
        } : {},
        image: uploadedImageUrl || prevSession.lastImageUrl || null
      };
      const data = await requestJoyFun(bodyPayload);
      const resultImage = data?.result || data?.output_resource || data?.image;
      if (!data || data.status !== true && data.status !== "success" || !resultImage) {
        throw new Error(data?.message || "Gagal memproses gambar lanjutan.");
      }
      const returnedToken = data.token || bodyPayload.token || "";
      const selectedModelName = data.selected_model?.name || bodyPayload.model;
      const botName = global.bot?.name || "WudysoftBot";
      const bodyText = `🎨 *JOYFUN AI (EDIT SESSION)*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🤖 *Model:* \`${selectedModelName}\`\n` + `🎭 *Mode:* \`IMAGE-TO-IMAGE\`\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan pengeditan._`;
      const footerText = `${botName} • JoyFun Engine`;
      const buttons = [{
        name: "cta_copy",
        display_text: "🔑 Salin Token Sesi",
        copy_code: returnedToken
      }];
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 JOYFUN AI IMAGE 乂",
          subtitle: `Model: ${selectedModelName}`,
          media: resultImage,
          quoted: msg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: msg
        });
      }
      const newMsgId = sentMsg?.key?.id;
      if (newMsgId) {
        global.joyfunSession.set(newMsgId, {
          token: returnedToken,
          model: selectedModelName,
          resolution: bodyPayload.resolution,
          lastImageUrl: resultImage
        });
        setTimeout(() => {
          global.joyfunSession.delete(newMsgId);
        }, 20 * 60 * 1e3);
      }
      if (typeof ctx?.react === "function") await ctx.react("✅");
      return true;
    } catch (e) {
      console.error("[JOYFUN BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("joyfun") || firstWord.endsWith("joyfunai") || firstWord.endsWith("joyart") || firstWord.endsWith("joyai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      if (flags.listModels || rawText.includes("--models") || rawText.includes("--list") || rawText.trim() === "models") {
        await ctx.react("⏳");
        const {
          data
        } = await axios.get(API_URL, {
          headers: {
            "User-Agent": "Mozilla/5.0"
          },
          timeout: 3e4
        });
        const modelsList = data?.models || [];
        if (!modelsList.length) throw new Error("Gagal mengambil daftar model JoyFun.");
        let textList = `🎨 *JOYFUN AI - AVAILABLE MODELS*\n\n`;
        modelsList.forEach((m, idx) => {
          textList += `*${idx + 1}. ${m.name}*\n` + `• Key: \`${m.key}\`\n` + `• Deskripsi: _${m.desc || "-"}\_\n` + `• Biaya: \`${m.cost || "0"} pts\` | Waktu: \`${m.time || "-"}\`\n\n`;
        });
        textList += `_Gunakan parameter \`--model "<nama_model>"\` untuk memilih model di atas._`;
        await ctx.react("📋");
        return ctx.reply(textList);
      }
      if (!rawText && !isMedia) {
        return ctx.reply(`🎨 *JOYFUN AI IMAGE GENERATOR & EDITOR*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${prefix}joyfun a futuristic sports car in neon city\`\n\n` + `• *Pilih Model & Rasio Resolusi:*\n` + `  👉 \`${prefix}joyfun cute anime girl --model "JoyFun Spicy Pro🔥" --ratio 16:9\`\n` + `  👉 \`${prefix}joyfun fantasy landscape --model "Seedream 5.0 Lite 🖌🧙‍♀️" --ratio 3:2\`\n\n` + `• *Image-to-Image / Edit Gambar (I2I):*\n` + `  👉 Kirim/balas gambar dengan: \`${prefix}joyfun turn into watercolor painting\`\n\n` + `• *Daftar Model yang Tersedia:*\n` + `  👉 \`${prefix}joyfun --models\`\n\n` + `• *Multi-Turn Editing Session:*\n` + `  👉 Cukup *reply pesan hasil gambar* dari bot untuk melanjutkan modifikasi gambar!`);
      }
      await ctx.react("⏳");
      let uploadedImageUrl = null;
      if (isMedia && typeof ctx.download === "function") {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          }
        }
      }
      const bodyPayload = {
        prompt: cleanPrompt || flags.prompt || (uploadedImageUrl ? "enhance quality, masterpiece" : "a beautiful digital artwork"),
        model: flags.model || "JoyFun Spicy",
        token: flags.token || null,
        ...flags.resolution ? {
          resolution: flags.resolution
        } : {},
        ...uploadedImageUrl ? {
          image: uploadedImageUrl
        } : flags.image ? {
          image: flags.image
        } : {}
      };
      const data = await requestJoyFun(bodyPayload);
      const resultImage = data?.result || data?.output_resource || data?.image;
      if (!data || data.status !== true && data.status !== "success" || !resultImage) {
        throw new Error(data?.message || "API tidak mengembalikan hasil gambar yang valid.");
      }
      const mode = bodyPayload.image ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE";
      const returnedToken = data.token || bodyPayload.token || "";
      const selectedModelName = data.selected_model?.name || bodyPayload.model;
      const bodyText = `🎨 *JOYFUN AI COMPLETED*\n\n` + `📝 *Prompt:* ${bodyPayload.prompt}\n` + `🤖 *Model:* \`${selectedModelName}\`\n` + `🎭 *Mode:* \`${mode}\`\n\n` + `_💡 Reply pesan ini langsung untuk melanjutkan pengeditan gambar ini._`;
      const footerText = `${botName} • JoyFun Engine`;
      let nextCommand = `${prefix}joyfun <tulis_prompt_edit_lanjutan>`;
      if (returnedToken) nextCommand += ` --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Lanjutan Edit",
        copy_code: nextCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      let sentMsg;
      if (typeof ctx.sendCta === "function") {
        sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 JOYFUN AI - ${mode} 乂`,
          subtitle: `Model: ${selectedModelName}`,
          media: resultImage,
          quoted: quotedMsg
        });
      } else {
        sentMsg = await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      const sentMsgId = sentMsg?.key?.id;
      if (sentMsgId) {
        global.joyfunSession.set(sentMsgId, {
          token: returnedToken,
          model: selectedModelName,
          resolution: bodyPayload.resolution,
          lastImageUrl: resultImage
        });
        setTimeout(() => {
          global.joyfunSession.delete(sentMsgId);
        }, 20 * 60 * 1e3);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ JoyFun AI Error: ${errMsg}`);
    }
  }
};