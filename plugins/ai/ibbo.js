import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://www.wudysoft.my.id/api/ai/ibbo";
const AVAILABLE_MODELS = ["nano-banana-lite", "nano-banana", "nano-banana-2", "nano-banana-pro", "gptimage2", "gptimage25-flare", "gptimage25-sunburst"];
const AVAILABLE_ASPECT_RATIOS = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21", "5:4", "4:5"];
const AVAILABLE_RESOLUTIONS = ["1K", "2K", "4K"];

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["model", "m"].includes(key)) key = "model";
    if (["ar", "ratio", "aspect", "aspect_ratio"].includes(key)) key = "aspect_ratio";
    if (["res", "resolution", "quality"].includes(key)) key = "resolution";
    if (["format", "output_format", "fmt"].includes(key)) key = "output_format";
    if (["bg", "background"].includes(key)) key = "background";
    if (["variant", "var", "v"].includes(key)) key = "variant";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      val = rawVal;
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
  name: "ibbo",
  aliases: ["ibboai", "ib"],
  description: "AI Image Generator & Editor menggunakan Ibbo AI (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "ibbo futuristic cyberpunk car --model gptimage2 --ar 16:9 --res 2K",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ibbo", "ibboai", "ib"].some(alias => firstWord.endsWith(alias))) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(text);
      if (!cleanPrompt && !isMedia) {
        return ctx.reply(`🎨 *IBBO AI IMAGE GENERATOR & EDITOR*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${prefix}ibbo beautiful futuristic sports car\`\n` + `  👉 \`${prefix}ibbo anime girl in tokyo --model gptimage2 --ar 16:9 --res 2K\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  👉 Reply/kirim gambar dengan caption: \`${prefix}ibbo turn into cyberpunk style\`\n\n` + `• *Daftar Model Tersedia (--model):*\n` + `  ${AVAILABLE_MODELS.map(m => `\`${m}\``).join(", ")}\n\n` + `• *Daftar Rasio Tersedia (--ar):*\n` + `  ${AVAILABLE_ASPECT_RATIOS.map(r => `\`${r}\``).join(", ")}\n\n` + `• *Daftar Resolusi (--res):*\n` + `  ${AVAILABLE_RESOLUTIONS.map(res => `\`${res}\``).join(", ")}\n\n` + `• *Opsi Lainnya:*\n` + `  • \`--format\` (png / jpeg / webp)\n` + `  • \`--variant\` (flare / sunburst)\n` + `  • \`--bg\` (auto)`);
      }
      await ctx.react("⏳");
      let selectedModel = "nano-banana-2";
      if (flags.model) {
        const foundModel = AVAILABLE_MODELS.find(m => m.toLowerCase() === String(flags.model).toLowerCase());
        if (foundModel) selectedModel = foundModel;
      }
      let selectedAR = "auto";
      if (flags.aspect_ratio) {
        const foundAR = AVAILABLE_ASPECT_RATIOS.find(r => r.toLowerCase() === String(flags.aspect_ratio).toLowerCase());
        if (foundAR) selectedAR = foundAR;
      }
      let selectedRes = "1K";
      if (flags.resolution) {
        const foundRes = AVAILABLE_RESOLUTIONS.find(res => res.toUpperCase() === String(flags.resolution).toUpperCase());
        if (foundRes) selectedRes = foundRes;
      }
      const body = {
        prompt: cleanPrompt || "masterpiece, ultra high quality, 4k",
        image: null,
        model: selectedModel,
        aspect_ratio: selectedAR,
        resolution: selectedRes,
        output_format: flags.output_format || "png",
        background: flags.background || "auto",
        variant: flags.variant || "flare"
      };
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        body.image = uploadRes.url;
      }
      const {
        data
      } = await axios.post(API_URL, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 9e4
      });
      const resultData = data?.result;
      const resultImage = resultData?.image_url || resultData?.r2_url || resultData?.image || resultData;
      if (!data?.status || !resultImage || typeof resultImage !== "string") {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil gambar."}`);
      }
      const mode = body.image ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE";
      const taskId = resultData?.task_id || "-";
      const usedModel = resultData?.model || body.model;
      const bodyText = `🎨 *IBBO AI GENERATION COMPLETED*\n\n` + `• *Prompt:* ${body.prompt}\n` + `• *Mode:* \`${mode}\`\n` + `• *Model:* \`${usedModel}\`\n` + `• *Aspect Ratio:* \`${body.aspect_ratio}\`\n` + `• *Resolution:* \`${body.resolution}\`\n` + `• *Format:* \`${body.output_format.toUpperCase()}\`\n` + `• *Task ID:* \`${taskId}\`\n\n` + `_💡 Ingin memodifikasi gambar ini lagi? Reply gambar ini dengan perintah \`${prefix}ibbo <prompt edit lanjutan>\`._`;
      const footerText = `${botName} • Ibbo AI Studio`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Prompt",
        copy_code: body.prompt
      }, {
        name: "cta_copy",
        display_text: "🔑 Salin Task ID",
        copy_code: taskId
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 IBBO AI - ${mode} 乂`,
          subtitle: `Generated by Ibbo AI (${usedModel})`,
          media: resultImage,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan: ${errMsg}`);
    }
  }
};