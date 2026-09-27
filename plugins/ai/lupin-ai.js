import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/ai/lupin-ai";
export default {
  name: "lupinai",
  aliases: ["lupin", "aivideo", "sora2", "veo3"],
  description: "AI Video & Image Generator via Lupin AI (Veo 3, Sora 2, Kling, Nano Banana)",
  category: "AI",
  limit: true,
  example: "lupinai <prompt> [--model <model>] atau lupinai --status <task_id> --token <token> atau lupinai --models",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("lupinai") || firstWord.endsWith("lupin") || firstWord.endsWith("aivideo") || firstWord.endsWith("sora2") || firstWord.endsWith("veo3")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        return ctx.reply(`🎬 *LUPIN AI GENERATOR (VIDEO & IMAGE)*\n\n` + `• *Generate AI Baru:*\n` + `  👉 \`${prefix}lupinai a cute car in the sky moon --model fal-ai/nano-banana\`\n` + `  👉 \`${prefix}lupinai drone view of neon tokyo --model fal-ai/sora-2/text-to-video\`\n\n` + `• *Image-to-Video:*\n` + `  👉 Balas gambar dengan: \`${prefix}lupinai animate camera zoom in\`\n\n` + `• *Cek Status Task:*\n` + `  👉 \`${prefix}lupinai --status <task_id> --token <token_jwt>\`\n\n` + `• *Lihat Model Tersedia:*\n` + `  👉 \`${prefix}lupinai --models\``);
      }
      await ctx.react("⏳");
      if (text.includes("--models") || text === "models") {
        const {
          data
        } = await axios.post(API_BASE, {
          action: "models"
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data || !data.models || !data.models.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar model.");
        }
        let modelList = `📋 *DAFTAR MODEL LUPIN AI*\n\n`;
        data.models.forEach(m => {
          modelList += `🔹 *${m.title}*\n`;
          modelList += `  🏷️ \`--model ${m.aiName}\`\n`;
          modelList += `  ⏱️ Durasi/Type: ${m.seconds || "Auto"} | 🪙 Koin: ${m.coins}\n`;
          modelList += `  📝 ${m.description || "-"}\n\n`;
        });
        await sock.sendMessage(ctx.id, {
          text: modelList.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const statusMatch = text.match(/--status\s+([^\s]+)/i);
      if (statusMatch) {
        const taskId = statusMatch[1];
        const tokenMatch = text.match(/--token\s+([^\s]+)/i);
        const token = tokenMatch ? tokenMatch[1] : "";
        if (!token) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan token autentikasi!\nContoh: \`${prefix}lupinai --status ${taskId} --token <token_jwt>\``);
        }
        const {
          data: statusRes
        } = await axios.post(API_BASE, {
          action: "status",
          task_id: taskId,
          token: token
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 45e3
        });
        if (!statusRes || statusRes.status !== "completed") {
          const checkAgainCommand = `${prefix}lupinai --status ${taskId} --token ${token}`;
          const pendingText = `⏳ *LUPIN AI TASK PROGRESS*\n\n` + `🆔 *Task ID:* \`${taskId}\`\n` + `⚙️ *Status:* \`${statusRes?.status || "Processing"}\`\n\n` + `_Tugas masih diproses server. Klik tombol copy di bawah untuk mengecek ulang nanti._`;
          const buttons = [{
            name: "cta_copy",
            display_text: "🔄 Salin Cek Ulang",
            copy_code: checkAgainCommand
          }];
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(pendingText, `${botName} • Lupin AI`, buttons, {
              title: "乂 LUPIN AI - IN PROGRESS 乂",
              subtitle: `Status: ${statusRes?.status || "Processing"}`,
              quoted: quotedMsg
            });
          } else {
            await sock.sendMessage(ctx.id, {
              text: pendingText
            }, {
              quoted: quotedMsg
            });
          }
          await ctx.react("⏳");
          return;
        }
        const mediaUrl = statusRes.video || statusRes.photo;
        const isPhoto = statusRes.isPhoto || mediaUrl?.match(/\.(png|jpg|jpeg|webp)$/i);
        let caption = `✅ *Lupin AI Render Selesai*\n\n`;
        caption += `📝 *Prompt:* ${statusRes.prompt || "-"}\n`;
        caption += `⚙️ *Model:* \`${statusRes.type || "-"}\`\n`;
        caption += `🆔 *Task ID:* \`${statusRes.task_id || taskId}\``;
        if (isPhoto) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: mediaUrl
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            video: {
              url: mediaUrl
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      let model = "fal-ai/nano-banana";
      let customToken = "";
      const modelMatch = text.match(/--model\s+([^\s]+)/i);
      if (modelMatch) {
        model = modelMatch[1];
        text = text.replace(modelMatch[0], "").trim();
      }
      const tokenMatch = text.match(/--token\s+([^\s]+)/i);
      if (tokenMatch) {
        customToken = tokenMatch[1];
        text = text.replace(tokenMatch[0], "").trim();
      }
      let prompt = text || "a cute car in the sky moon";
      let imageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            imageUrl = uploadRes.url;
          }
        }
      }
      const body = {
        action: "generate",
        prompt: prompt,
        model: model
      };
      if (imageUrl) body.image = imageUrl;
      if (customToken) body.token = customToken;
      const {
        data: genRes
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      if (!genRes || genRes.code === "ERROR" || !genRes.task_id) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memulai render Lupin AI: ${genRes?.message || "Server error"}`);
      }
      const taskId = genRes.task_id;
      const returnedToken = genRes.token || customToken || "";
      const bodyText = `🚀 *LUPIN AI GENERATION STARTED*\n\n` + `📝 *Prompt:* ${prompt}\n` + `🤖 *Model:* \`${model}\`\n` + `🆔 *Task ID:* \`${taskId}\`\n` + `⚙️ *Status:* \`${genRes.status || "generating"}\`\n\n` + `_💡 Klik tombol di bawah untuk menyalin perintah cek status hasil render._`;
      const footerText = `${botName} • Lupin AI Generator`;
      const checkStatusCommand = `${prefix}lupinai --status ${taskId} --token ${returnedToken}`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Cek Status",
        copy_code: checkStatusCommand
      }];
      if (returnedToken) {
        buttons.push({
          name: "cta_copy",
          display_text: "🔑 Salin Token Saja",
          copy_code: returnedToken
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 LUPIN AI - TASK STARTED 乂",
          subtitle: `Model: ${model}`,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Lupin AI Error: ${errMsg}`);
    }
  }
};