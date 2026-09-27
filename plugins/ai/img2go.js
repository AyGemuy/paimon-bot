import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "img2go",
  aliases: ["img2goai", "i2go"],
  description: "AI Image Generator & Editor via Img2Go Engine (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `img2go cute cat in the garden`\n• Image-to-Image: Reply gambar dengan caption `img2go turn into oil painting`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("img2go") || firstWord.endsWith("img2goai") || firstWord.endsWith("i2go")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *IMG2GO AI IMAGE GENERATOR (T2I & I2I)*\n\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${ctx.prefix || "."}img2go a futuristic anime landscape with sakura\`\n\n` + `• *Image-to-Image / Edit (I2I):*\n` + `  └ Reply/kirim gambar: \`${ctx.prefix || "."}img2go change to watercolor style\``);
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
        prompt: text || (imageUrl ? "enhance details, masterpiece, high resolution" : "a cute cat")
      };
      if (imageUrl) {
        body.image = imageUrl;
      }
      const response = await axios.post("https://wudysoft.my.id/api/ai/img2go", body, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const imageBuffer = Buffer.from(response.data);
      if (imageBuffer.length < 500) {
        try {
          const parsed = JSON.parse(imageBuffer.toString("utf-8"));
          if (parsed && (!parsed.status || parsed.error || parsed.message)) {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal: ${parsed.message || parsed.error || "Proses dibatalkan oleh server."}`);
          }
        } catch {}
      }
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses gambar dari server.");
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `✅ *Img2Go AI Selesai*\n\n`;
      caption += `📝 *Prompt:* ${body.prompt}\n`;
      caption += `🎭 *Mode:* ${mode}`;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Img2Go Error: ${errorMessage}`);
    }
  }
};