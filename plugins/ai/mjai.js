import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const VALID_MODELS = ["flux", "tamarin", "superAnime", "visiCanvas", "realistic", "oldRealistic", "anime", "3danime"];
const VALID_SIZES = ["1:2", "9:16", "3:4", "1:1", "4:3", "16:9", "2:1"];
export default {
  name: "mjai",
  aliases: ["midjourney", "mj"],
  description: "AI Image Generator & Editor menggunakan Midjourney AI (T2I & I2I)",
  category: "AI",
  example: "mjai <prompt> [--model <model>] [--size <size>] [--neg <negative_prompt>]",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("mjai") || firstWord.endsWith("mj") || firstWord.endsWith("midjourney")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *MIDJOURNEY AI GENERATOR (MJAI)*\n\n` + `• *Text-to-Image (T2I):*\n` + `  👉 \`${ctx.prefix || "."}mjai cute cybernetic cat --model anime --size 16:9\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  👉 Reply/kirim gambar dengan: \`${ctx.prefix || "."}mjai turn into anime character\`\n\n` + `• *Pilihan Model:* \n` + `  \`${VALID_MODELS.join(", ")}\`\n\n` + `• *Pilihan Rasio/Size:* \n` + `  \`${VALID_SIZES.join(", ")}\``);
      }
      await ctx.react("⏳");
      let prompt = text;
      let selectedModel = "realistic";
      let selectedSize = "3:4";
      let negativePrompt = "";
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) {
          const foundModel = VALID_MODELS.find(m => m.toLowerCase() === match[1].toLowerCase());
          if (foundModel) selectedModel = foundModel;
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      if (/--(size|ratio)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(size|ratio)\s+([^\s]+)/i);
        if (match && VALID_SIZES.includes(match[2])) {
          selectedSize = match[2];
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      if (/--(neg|negative)\s+(.+?)(?=--|$)/i.test(prompt)) {
        const match = prompt.match(/--(neg|negative)\s+(.+?)(?=--|$)/i);
        if (match) {
          negativePrompt = match[2].trim();
          prompt = prompt.replace(match[0], "").trim();
        }
      }
      let imageUrl = "";
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
        imageUrl = uploadRes.url;
      }
      const payload = {
        prompt: prompt || "masterpiece, highly detailed, 8k wallpaper",
        negativePrompt: negativePrompt || "",
        model: selectedModel,
        size: selectedSize,
        batchSize: "1",
        imageUrl: imageUrl || "",
        rangeValue: null
      };
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/image/mjai", payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      if (!data || data.state !== "success" && !data.result?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal generate gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const results = data.result || [];
      const mode = imageUrl ? "IMAGE-TO-IMAGE" : "TEXT-TO-IMAGE";
      let caption = `╭───『 *MIDJOURNEY AI RESULT* 』\n` + `│ 📝 *Prompt:* ${data.prompt || prompt}\n` + `│ 🎭 *Mode:* ${mode}\n` + `│ 🤖 *Model:* ${selectedModel}\n` + `│ 📐 *Size:* ${selectedSize}\n` + `│ 🆔 *Task ID:* ${data.id || "-"}\n` + `│ ⏱️ *Complete:* ${data.completeTime || "-"}\n` + `╰──────────────────`;
      for (const imgUrl of results) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: imgUrl
          },
          caption: caption.trim()
        }, {
          quoted: simpleQuoted(ctx)
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