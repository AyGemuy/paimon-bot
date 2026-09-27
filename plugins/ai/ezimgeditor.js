import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "ezimgeditor",
  aliases: ["ezimage", "ezedit", "ezai"],
  description: "AI Image Generator & Editor via EZ Image Editor (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `ezimgeditor a cute cat in the garden`\n• Image-to-Image: Reply gambar dengan caption `ezimgeditor add sunglasses`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("ezimgeditor") || firstWord.endsWith("ezimage") || firstWord.endsWith("ezedit") || firstWord.endsWith("ezai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *EZ IMAGE EDITOR (T2I & I2I)*\n\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${ctx.prefix || "."}ezimgeditor a futuristic neon cyberpunk city\`\n\n` + `• *Image-to-Image / Edit (I2I):*\n` + `  └ Reply/kirim gambar: \`${ctx.prefix || "."}ezimgeditor change hair color to red\``);
      }
      await ctx.react("⏳");
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh gambar dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        imageUrl = uploadRes.url;
      }
      const body = {
        prompt: text || (imageUrl ? "enhance details, masterpiece, high quality" : "a cute cat")
      };
      if (imageUrl) {
        body.image = imageUrl;
      }
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/ezimgeditor", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const outputUrl = data?.url || data?.result?.url || data?.result;
      if (!data || data.success !== true && data.status !== true || !outputUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil."}`);
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `✅ *EZ Image Editor Selesai*\n\n`;
      caption += `📝 *Prompt:* ${body.prompt}\n`;
      caption += `🎭 *Mode:* ${mode}`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: outputUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ EZ Image Editor Error: ${errMsg}`);
    }
  }
};