import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "pokecut",
  aliases: ["pokecut"],
  description: "AI Image Generator & Editor menggunakan Pokecut AI (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "pokecut <prompt> atau reply gambar dengan caption pokecut <prompt>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("pokecut")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`⚡ *POKECUT AI GENERATOR*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${ctx.prefix || "."}pokecut cute pikachu cyberpunk style\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  👉 Reply/kirim gambar dengan: \`${ctx.prefix || "."}pokecut add sunglasses and hat\``);
      }
      await ctx.react("⏳");
      const prompt = text || "enhance details, masterpiece, high resolution";
      const body = {
        prompt: prompt
      };
      let isI2I = false;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            body.image = uploadRes.url;
            isI2I = true;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const response = await axios.post("https://wudysoft.my.id/api/ai/pokecut", body, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(response.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan gambar dari server Pokecut.");
      }
      const caption = `⚡ *Pokecut AI Selesai*\n\n` + `📝 *Prompt:* ${prompt}\n` + `🎭 *Mode:* ${isI2I ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE"}`;
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
          const parsed = JSON.parse(Buffer.from(error.response.data).toString("utf-8"));
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Pokecut AI Error: ${errorMessage}`);
    }
  }
};