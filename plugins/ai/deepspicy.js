import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "deepspicy",
  aliases: ["dspicy", "deepspicyai"],
  description: "AI Image Generator & Editor via DeepSpicy Engine (T2I & I2I)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `deepspicy a beautiful girl in kimono --ar 16:9`\n• Image-to-Image: Reply gambar dengan caption `deepspicy realistic style`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("deepspicy") || firstWord.endsWith("dspicy") || firstWord.endsWith("deepspicyai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        return ctx.reply(`🌶️ *DEEPSPICY AI GENERATOR (T2I & I2I)*\n\n` + `*Cara Penggunaan:*\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${prefix}deepspicy beautiful woman in neon city --ar 16:9\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  └ Reply/kirim gambar: \`${prefix}deepspicy enhance quality, realistic\`\n\n` + `*Opsi Parameter Flag:*\n` + `• \`--ar <16:9|9:16|1:1|4:3|3:4>\` : Aspect Ratio\n` + `• \`--model <model_type>\` : Tipe Model\n` + `• \`--res <resolusi>\` : Resolusi Gambar\n` + `• \`--count <jumlah>\` : Jumlah Output (1-4)\n` + `• \`--token <token_jwt>\` : Token Sesi Akun`);
      }
      await ctx.react("⏳");
      let prompt = text;
      let modelType = "";
      let aspectRatio = "";
      let resolution = "";
      let numOutputs = 1;
      let token = "";
      if (/--token\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--token\s+([^\s]+)/i);
        if (match) token = match[1];
        prompt = prompt.replace(/--token\s+[^\s]+/gi, "").trim();
      }
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) modelType = match[1];
        prompt = prompt.replace(/--model\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:ar|ratio|aspect_ratio)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:ar|ratio|aspect_ratio)\s+([^\s]+)/i);
        if (match) aspectRatio = match[1];
        prompt = prompt.replace(/--(?:ar|ratio|aspect_ratio)\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:res|resolution)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:res|resolution)\s+([^\s]+)/i);
        if (match) resolution = match[1];
        prompt = prompt.replace(/--(?:res|resolution)\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:count|outputs)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:count|outputs)\s+([^\s]+)/i);
        if (match) numOutputs = parseInt(match[1]) || 1;
        prompt = prompt.replace(/--(?:count|outputs)\s+[^\s]+/gi, "").trim();
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
        prompt: prompt || (imageUrl ? "enhance details, masterpiece, ultra high res" : "masterpiece, ultra detailed, 8k")
      };
      if (imageUrl) body.image = imageUrl;
      if (token) body.token = token;
      if (modelType) body.model_type = modelType;
      if (aspectRatio) body.aspect_ratio = aspectRatio;
      if (resolution) body.resolution = resolution;
      if (numOutputs > 1) body.num_outputs = numOutputs;
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/deepspicy", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      const isSuccess = data?.status === "succeeded" || data?.status === "success" || data?.status === true;
      const results = Array.isArray(data?.result) ? data.result : data?.result ? [data.result] : [];
      if (!data || !isSuccess || results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || data?.error || "API tidak mengembalikan hasil."}`);
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      const returnedToken = data.token || token || "";
      let bodyText = `🌶️ *DEEPSPICY AI COMPLETED*\n\n` + (body.prompt ? `📝 *Prompt:* ${body.prompt}\n` : "") + `🎭 *Mode:* \`${mode}\`\n`;
      if (modelType) bodyText += `🤖 *Model:* \`${modelType}\`\n`;
      if (aspectRatio) bodyText += `📐 *Ratio:* \`${aspectRatio}\`\n`;
      if (resolution) bodyText += `🔍 *Resolution:* \`${resolution}\`\n`;
      bodyText += `\n_💡 Klik tombol copy di bawah untuk menyimpan sesi token akun Anda._`;
      const footerText = `${botName} • DeepSpicy AI`;
      const buttons = [];
      if (returnedToken) {
        const nextCommand = `${prefix}deepspicy --token ${returnedToken}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Sesi Token",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 DEEPSPICY AI - ${mode} 乂`,
          subtitle: `Engine: DeepSpicy`,
          media: results[0],
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[0]
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      for (let i = 1; i < results.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[i]
          }
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ DeepSpicy Error: ${errMsg}`);
    }
  }
};