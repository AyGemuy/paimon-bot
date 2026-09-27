import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "aienhancer",
  aliases: ["enhancer", "enhanceai", "aienhance"],
  description: "AI Image Generator & Transformer via AIEnhancer (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `aienhancer a cute cat in the moon --ar 16:9`\n• Image-to-Image: Reply gambar dengan caption `aienhancer make it cyberpunk style`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("aienhancer") || firstWord.endsWith("enhancer") || firstWord.endsWith("enhanceai") || firstWord.endsWith("aienhance")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *AI ENHANCER (T2I & I2I)*\n\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${ctx.prefix || "."}aienhancer a futuristic girl --ar 16:9 --model NANO_BANANA\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  └ Reply/kirim gambar: \`${ctx.prefix || "."}aienhancer anime illustration style\`\n\n` + `*Opsi Parameter Flag:*\n` + `• \`--model <nama_model>\` (Default: \`NANO_BANANA\`)\n` + `• \`--ar <1:1|16:9|9:16|4:3|3:4>\` (Aspect Ratio)`);
      }
      await ctx.react("⏳");
      let prompt = text;
      let model = "NANO_BANANA";
      let aspectRatio = undefined;
      if (prompt.includes("--model")) {
        const parts = prompt.split("--model");
        prompt = parts[0].trim();
        model = parts[1]?.trim().split(/\s+/)[0] || "NANO_BANANA";
      }
      if (prompt.includes("--ar") || prompt.includes("--ratio") || prompt.includes("--aspectRatio")) {
        const flag = prompt.includes("--ar") ? "--ar" : prompt.includes("--ratio") ? "--ratio" : "--aspectRatio";
        const parts = prompt.split(flag);
        prompt = parts[0].trim();
        aspectRatio = parts[1]?.trim().split(/\s+/)[0] || undefined;
      }
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
        prompt: prompt || (imageUrl ? "enhance details, masterpiece, high quality" : "masterpiece, high quality"),
        image: imageUrl,
        model: model,
        ...aspectRatio ? {
          aspectRatio: aspectRatio
        } : {}
      };
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/aienhancer", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const resObj = data?.result;
      const outputUrl = resObj?.output || (typeof resObj === "string" ? resObj : null) || data?.output;
      if (!data || data.status !== "success" && data.status !== true || !outputUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || resObj?.error || "API tidak mengembalikan output."}`);
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `✨ *AI Enhancer Selesai*\n\n`;
      if (prompt) caption += `📝 *Prompt:* ${prompt}\n`;
      caption += `🎭 *Mode:* ${mode}\n`;
      caption += `🤖 *Model:* \`${model}\`\n`;
      if (aspectRatio) caption += `📐 *Aspect Ratio:* ${aspectRatio}\n`;
      if (resObj?.id) caption += `🆔 *Task ID:* \`${resObj.id}\`\n`;
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
      ctx.reply(`❌ AI Enhancer Error: ${errMsg}`);
    }
  }
};