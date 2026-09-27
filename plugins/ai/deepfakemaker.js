import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/ai/deepfakemaker/gen";

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    if (["image", "img", "imageurl"].includes(key.toLowerCase())) key = "imageUrl";
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
  name: "deepfakemaker",
  aliases: ["dfm", "deepfake"],
  description: "AI Deepfake & Image Generator via DeepfakeMaker (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "deepfakemaker add hat --imageUrl <url> atau reply gambar dengan caption deepfakemaker add hat",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("deepfakemaker") || firstWord.endsWith("dfm") || firstWord.endsWith("deepfake")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      if (!rawText && !isMedia) {
        return ctx.reply(`🎭 *DEEPFAKEMAKER AI GENERATOR*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${prefix}deepfakemaker cybernetic samurai portrait\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  👉 Reply/kirim gambar dengan: \`${prefix}deepfakemaker add hat and sunglasses\`\n\n` + `• *Opsi Flag & Body Override:*\n` + `  • \`--imageUrl <url>\` (Set URL gambar manual)\n` + `  • \`--mode <mode>\` (Contoh: \`--mode img2img\`)\n` + `  • \`--body <json_string>\` (Override body JSON secara penuh, ex: \`--body '{"mode":"txt2img"}'\`)`);
      }
      await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const prompt = cleanPrompt || "enhance details, masterpiece, high resolution";
      let uploadedImageUrl = flags.imageUrl || null;
      let isI2I = Boolean(uploadedImageUrl);
      if (isMedia && !uploadedImageUrl) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
            isI2I = true;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[DEEPFAKEMAKER] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        prompt: prompt,
        ...uploadedImageUrl ? {
          imageUrl: uploadedImageUrl
        } : {},
        ...flags,
        ...bodyOverride
      };
      const response = await axios.get(API_URL, {
        params: payload,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const resData = response.data;
      const resultUrl = resData?.generate_url || resData?.data?.generate_url;
      if (!resData?.success || !resultUrl) {
        throw new Error(resData?.message || "Gagal mendapatkan URL hasil generasi dari server.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(imgRes.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal diunduh.");
      }
      const caption = `🎭 *DeepfakeMaker AI Selesai*\n\n` + `📝 *Prompt:* ${prompt}\n` + `🔄 *Mode:* ${isI2I ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE"}\n` + `🎯 *Attempt:* ${resData?.attempt || 1}`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ DeepfakeMaker Error: ${errorMessage}`);
    }
  }
};