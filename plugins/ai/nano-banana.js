import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "nanobanana",
  aliases: ["bananaai", "nanobananaai", "nbai"],
  description: "AI Image Generator & Editor menggunakan Nano Banana Engine v65 (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "nanobanana <prompt> [--<key> <value>] atau reply gambar dengan caption nanobanana <prompt>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("nanobanana") || firstWord.endsWith("bananaai") || firstWord.endsWith("nanobananaai") || firstWord.endsWith("nbai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🍌 *NANO BANANA AI GENERATOR*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${ctx.prefix || "."}nanobanana a cute cat in the sky moon\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  👉 Balas gambar dengan: \`${ctx.prefix || "."}nanobanana transform into anime style\`\n\n` + `⚙️ *Custom Payload Override:* \n` + `  👉 \`${ctx.prefix || "."}nanobanana a futuristic city --aspect_ratio 16:9 --style cyberpunk\``);
      }
      await ctx.react("⏳");
      const restPayload = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s]+)/g;
      let match;
      while ((match = flagRegex.exec(text)) !== null) {
        const key = match[1];
        const value = match[2];
        restPayload[key] = value;
      }
      let prompt = text.replace(/--[a-zA-Z0-9_]+\s+[^\s]+/g, "").trim();
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Upload error"}`);
          }
        }
      }
      const body = {
        prompt: prompt || "masterpiece, ultra detailed, 8k resolution",
        ...imageUrl ? {
          image: imageUrl
        } : {},
        ...restPayload
      };
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/nano-banana/v65", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const outputImageUrl = data?.output || data?.result?.output || (Array.isArray(data?.result) ? data.result[0] : data?.result) || data?.url;
      if (!outputImageUrl || typeof outputImageUrl !== "string") {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal menghasilkan gambar: ${data?.message || "Respon API tidak sesuai."}`);
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `🍌 *NANO BANANA AI Selesai*\n\n`;
      caption += `📝 *Prompt:* ${prompt || "-"}\n`;
      caption += `🎭 *Mode:* ${mode}\n`;
      if (data.id) caption += `🆔 *Task ID:* \`${data.id}\`\n`;
      if (data.type) caption += `⚙️ *Type:* \`${data.type}\`\n`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: outputImageUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Nano Banana Error: ${errMsg}`);
    }
  }
};