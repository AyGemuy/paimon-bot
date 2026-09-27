import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "imagetoimageai",
  aliases: ["imagetoimageai", "i2iai"],
  description: "Generate / Transformasi Gambar AI via ImageToImageAI",
  category: "AI",
  limit: true,
  example: "imagetoimageai <prompt> [--ratio 16:9] [--state <token>] atau reply gambar",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("imagetoimageai") || firstWord.endsWith("i2iai")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`🎨 *IMAGE TO IMAGE AI GENERATOR*\n\n` + `📌 *Text-to-Image:*\n` + `👉 \`${prefix}imagetoimageai <prompt> --ratio 16:9\`\n\n` + `🖼️ *Image-to-Image:*\n` + `👉 Balas/kirim gambar dengan caption: \`${prefix}imagetoimageai <prompt>\`\n\n` + `⚙️ *Parameter Tambahan (Opsional):*\n` + `• \`--ratio <1:1|16:9|9:16|4:3>\`\n` + `• \`--model <nama_model>\`\n` + `• \`--resolution <1k|2k|4k>\`\n` + `• \`--state <custom_state>\``);
      }
      await ctx.react("⏳");
      let ratio = "";
      let model = "";
      let resolution = "";
      let state = "";
      let prompt = rawText;
      const ratioMatch = prompt.match(/--(?:ratio|aspect_ratio|ar)\s+([^\s]+)/i);
      if (ratioMatch) {
        ratio = String(ratioMatch[1]);
        prompt = prompt.replace(ratioMatch[0], "").trim();
      }
      const modelMatch = prompt.match(/--model\s+([^\s]+)/i);
      if (modelMatch) {
        model = String(modelMatch[1]);
        prompt = prompt.replace(modelMatch[0], "").trim();
      }
      const resMatch = prompt.match(/--resolution\s+([^\s]+)/i);
      if (resMatch) {
        resolution = String(resMatch[1]);
        prompt = prompt.replace(resMatch[0], "").trim();
      }
      const stateMatch = prompt.match(/--state\s+([^\s]+)/i);
      if (stateMatch) {
        state = String(stateMatch[1]);
        prompt = prompt.replace(stateMatch[0], "").trim();
      }
      let imageUrlInput = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrlInput = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      const payload = {
        prompt: prompt || "enhance and beautify this image into 4k ultra detailed"
      };
      if (ratio) {
        payload.ratio = ratio;
        payload.aspect_ratio = ratio;
      }
      if (model) payload.model = model;
      if (resolution) payload.resolution = resolution;
      if (state) payload.state = state;
      if (imageUrlInput) {
        payload.image = imageUrlInput;
        payload.image_input = imageUrlInput;
      }
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/imagetoimageai", payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal me-render gambar dari server AI.");
      }
      const resObj = data.result;
      const imageUrl = resObj.imageUrl || resObj.images?.[0] || resObj.taskResult?.resultJson?.resultUrls?.[0] || (typeof resObj === "string" ? resObj : null);
      if (!imageUrl) {
        throw new Error("Gambar tidak ditemukan pada respon API.");
      }
      const sceneType = String(resObj.scene || (imageUrlInput ? "image-to-image" : "text-to-image"));
      const costTime = resObj.taskResult?.costTime ? `${resObj.taskResult.costTime}s` : "-";
      const returnedState = String(resObj.state || data.state || "");
      const usedModel = String(resObj.model || model || "Default");
      const usedPrompt = String(resObj.prompt || prompt);
      let bodyText = `🎨 *IMAGE TO IMAGE AI COMPLETED*\n\n` + `📝 *Prompt:* ${usedPrompt}\n` + `🎭 *Mode:* \`${sceneType.toUpperCase()}\`\n` + `🤖 *Model:* \`${usedModel}\`\n`;
      if (ratio) bodyText += `📐 *Ratio:* \`${ratio}\`\n`;
      bodyText += `⏱️ *Render Time:* ${costTime}\n\n` + `_💡 Klik tombol copy di bawah untuk melanjutkan pengeditan gambar ini._`;
      const footerText = `${botName} • ImageToImageAI`;
      const buttons = [];
      if (returnedState && returnedState !== "-") {
        const nextCommand = `${prefix}imagetoimageai <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Edit",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 AI IMAGE - ${sceneType.toUpperCase()} 乂`,
          subtitle: `Model: ${usedModel} • Time: ${costTime}`,
          media: imageUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: imageUrl
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
      ctx.reply(`❌ AI Image Error: ${errMsg}`);
    }
  }
};