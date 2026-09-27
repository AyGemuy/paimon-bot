import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "senzia",
  aliases: ["senziaai", "szai"],
  description: "AI Image Generator & Editor menggunakan Senzia (T2I & I2I)",
  category: "AI",
  example: ".senzia a cute cat --ratio 1:1\n.senzia --models\n.senzia models t2i",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("senzia") || firstWord.endsWith("szai") || firstWord.endsWith("senziaai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        const helpText = `🎨 *SENZIA AI IMAGE GENERATOR & EDITOR*\n\n` + `*Cara Penggunaan:*\n` + `• *Text to Image:*\n` + `  └ \`${prefix}senzia a futuristic cyberpunk city --ratio 16:9 --model wan2.6-image\`\n\n` + `• *Image to Image / Edit:*\n` + `  └ Reply gambar: \`${prefix}senzia change hair to blonde --ratio 1:1\`\n\n` + `• *Lanjut Edit (State):*\n` + `  └ \`${prefix}senzia add glowing neon lights --state <token>\`\n\n` + `• *Cek Daftar Model:*\n` + `  └ \`${prefix}senzia --models\` (semua model)\n` + `  └ \`${prefix}senzia models t2i\` (khusus Text to Image)\n` + `  └ \`${prefix}senzia models i2i\` (khusus Image to Image)\n\n` + `*Daftar Opsi Flag:*\n` + `• \`--model <nama_model>\` (Default: \`wan2.6-image\`)\n` + `• \`--ratio <16:9|9:16|1:1|4:3|3:4|3:2|2:3>\` (Default: \`16:9\`)\n` + `• \`--res <resolusi>\` (Contoh: 1024*1024, 1280*720)\n` + `• \`--state <token>\` (Melanjutkan sesi edit sebelumnya)\n` + `• \`--agent <nama_agent>\` (Default: \`uncensored-ai-image-editor\`)`;
        return ctx.reply(helpText);
      }
      const lowerText = text.toLowerCase();
      if (lowerText.startsWith("models") || lowerText.includes("--models")) {
        await ctx.react("⏳");
        let type = "all";
        if (lowerText.includes("t2i")) type = "t2i";
        else if (lowerText.includes("i2i")) type = "i2i";
        const {
          data
        } = await axios.post("https://wudysoft.my.id/api/ai/senzia", {
          action: "models",
          type: type
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data || !data.status) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar model dari server.");
        }
        let modelList = `📋 *DAFTAR MODEL SENZIA (${type.toUpperCase()})*\n`;
        if (data.t2i?.models?.length > 0) {
          modelList += `\n╭───『 *TEXT TO IMAGE (T2I)* 』\n`;
          data.t2i.models.forEach((m, i) => {
            modelList += `├ *${i + 1}. ${m.displayName}*\n`;
            modelList += `│  • Model: \`${m.modelName}\`\n`;
            modelList += `│  • Deskripsi: ${m.description || "-"}\n`;
            if (m.supportedAspectRatios?.length) {
              modelList += `│  • Ratio: ${m.supportedAspectRatios.join(", ")}\n`;
            }
            if (m.supportedResolutions?.length) {
              modelList += `│  • Res: ${m.supportedResolutions.join(", ")}\n`;
            }
            modelList += `│\n`;
          });
          modelList += `╰────────────────────────\n`;
        }
        if (data.i2i?.models?.length > 0) {
          modelList += `\n╭───『 *IMAGE TO IMAGE (I2I)* 』\n`;
          data.i2i.models.forEach((m, i) => {
            modelList += `├ *${i + 1}. ${m.displayName}*\n`;
            modelList += `│  • Model: \`${m.modelName}\`\n`;
            modelList += `│  • Deskripsi: ${m.description || "-"}\n`;
            modelList += `│  • Max Input: ${m.maxInputImages || 1} gambar\n`;
            if (m.supportedAspectRatios?.length) {
              modelList += `│  • Ratio: ${m.supportedAspectRatios.join(", ")}\n`;
            }
            modelList += `│\n`;
          });
          modelList += `╰────────────────────────\n`;
        }
        modelList += `\n_Gunakan flag \`--model <modelName>\` saat generate gambar._`;
        await ctx.react("✅");
        return ctx.reply(modelList.trim());
      }
      await ctx.react("⏳");
      let prompt = text;
      let state = "";
      let model = "wan2.6-image";
      let ratio = "16:9";
      let resolution = "";
      let agentRoute = "uncensored-ai-image-editor";
      if (/--state\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--state\s+([^\s]+)/i);
        if (match) state = match[1];
        prompt = prompt.replace(/--state\s+[^\s]+/gi, "").trim();
      }
      if (/--model\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--model\s+([^\s]+)/i);
        if (match) model = match[1];
        prompt = prompt.replace(/--model\s+[^\s]+/gi, "").trim();
      }
      if (/--(?:ratio|ar)\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--(?:ratio|ar)\s+([^\s]+)/i);
        if (match) ratio = match[1];
        prompt = prompt.replace(/--(?:ratio|ar)\s+[^\s]+/gi, "").trim();
      }
      if (/--res\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--res\s+([^\s]+)/i);
        if (match) resolution = match[1];
        prompt = prompt.replace(/--res\s+[^\s]+/gi, "").trim();
      }
      if (/--agent\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--agent\s+([^\s]+)/i);
        if (match) agentRoute = match[1];
        prompt = prompt.replace(/--agent\s+[^\s]+/gi, "").trim();
      }
      const body = {
        action: "generate",
        prompt: prompt || "masterpiece, ultra detail, high quality",
        model: model,
        ratio: ratio,
        agentRoute: agentRoute
      };
      if (state) body.state = state;
      if (resolution) body.resolution = resolution;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer) {
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
      } = await axios.post("https://wudysoft.my.id/api/ai/senzia", body, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 12e4
      });
      if (!data || !data.status || !data.resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses gambar: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      const returnedState = data.state || "";
      const usedModel = data.modelDisplayName || data.model || model;
      const usedRatio = data.aspectRatio || ratio;
      let bodyText = `🎨 *SENZIA AI COMPLETED*\n\n` + `📝 *Prompt:* ${prompt || "-"}\n` + `🤖 *Model:* \`${usedModel}\`\n` + `📐 *Ratio:* \`${usedRatio}\`\n`;
      if (data.taskId) bodyText += `🆔 *Task ID:* \`${data.taskId}\`\n`;
      bodyText += `\n_💡 Klik tombol copy di bawah untuk melanjutkan pengeditan gambar ini._`;
      const footerText = `${botName} • Senzia AI`;
      const buttons = [];
      if (returnedState) {
        const nextCommand = `${prefix}senzia <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
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
          title: `乂 SENZIA AI 乂`,
          subtitle: `Model: ${usedModel}`,
          media: data.resultUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: data.resultUrl
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