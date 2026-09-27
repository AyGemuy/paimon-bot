import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/ai/dreemy";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export default {
  name: "dreemy",
  aliases: ["dreemyai", "dremy"],
  description: "AI Image Generator & Editor via Dreemy Engine (Auto-Polling & Multi-turn State)",
  category: "AI",
  limit: true,
  example: "• Text-to-Image: `dreemy a beautiful girl in night city`\n• Image-to-Image: Reply gambar dengan caption `dreemy add sunglasses`\n• Cek Status: `dreemy --status <id> --state <state>`",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("dreemy") || firstWord.endsWith("dreemyai") || firstWord.endsWith("dremy")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        return ctx.reply(`🎨 *DREEMY AI GENERATOR (T2I & I2I)*\n\n` + `*Cara Penggunaan:*\n` + `• *Text-to-Image (T2I):*\n` + `  └ \`${prefix}dreemy a cute cat in the garden\`\n\n` + `• *Image-to-Image (I2I):*\n` + `  └ Reply/kirim gambar: \`${prefix}dreemy add hat, realistic style\`\n\n` + `• *Lanjut Sesi / Multi-Turn State:*\n` + `  └ \`${prefix}dreemy change dress to red --state <state_token>\`\n\n` + `• *Cek Manual Status:*\n` + `  └ \`${prefix}dreemy --status <task_id> --state <state_token>\``);
      }
      await ctx.react("⏳");
      const statusMatch = text.match(/--status\s+([^\s]+)/i);
      if (statusMatch) {
        const taskId = statusMatch[1];
        const stateMatch = text.match(/--state\s+([^\s]+)/i);
        const state = stateMatch ? stateMatch[1] : "";
        if (!state) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan token state!\nContoh: \`${prefix}dreemy --status ${taskId} --state <state_token>\``);
        }
        const {
          data: statusRes
        } = await axios.post(API_BASE, {
          action: "status",
          id: taskId,
          state: state
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        const resultObj = Array.isArray(statusRes?.result) ? statusRes.result[0] : statusRes?.result;
        const resultUrl = resultObj?.resultUrl || resultObj?.url;
        if (!statusRes || !statusRes.status || !resultUrl) {
          const checkAgainCommand = `${prefix}dreemy --status ${taskId} --state ${state}`;
          const pendingText = `⏳ *STATUS TASK: SEDANG DIPROSES...*\n\n` + `🆔 *Task ID:* \`${taskId}\`\n\n` + `_Tugas masih diproses di antrian. Klik tombol copy di bawah untuk mengecek ulang nanti._`;
          const buttons = [{
            name: "cta_copy",
            display_text: "🔄 Salin Cek Status",
            copy_code: checkAgainCommand
          }];
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(pendingText, `${botName} • Dreemy AI`, buttons, {
              title: "乂 DREEMY AI - PROCESSING 乂",
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
        await sock.sendMessage(ctx.id, {
          image: {
            url: resultUrl
          },
          caption: `✅ *Dreemy AI Selesai*\n\n🆔 *Task ID:* \`${taskId}\``
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      let prompt = text;
      let state = "";
      if (/--state\s+([^\s]+)/i.test(prompt)) {
        const match = prompt.match(/--state\s+([^\s]+)/i);
        if (match) state = match[1];
        prompt = prompt.replace(/--state\s+[^\s]+/gi, "").trim();
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
        action: "generate",
        prompt: prompt || (imageUrl ? "enhance quality, realistic" : "masterpiece, ultra detailed, 8k")
      };
      if (imageUrl) body.image = imageUrl;
      if (state) body.state = state;
      const {
        data: genRes
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const genData = genRes?.result?.result || genRes?.result;
      const taskId = genData?.id || genRes?.id;
      const returnedState = genRes?.state || state || "";
      const modelName = genData?.modelName || "Dreemy AI";
      if (!genRes || !genRes.status || !taskId) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memulai render: ${genRes?.message || "Server tidak mengembalikan task ID."}`);
      }
      let finalResultUrl = null;
      const maxRetries = 25;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await sleep(3e3);
        try {
          const {
            data: pollRes
          } = await axios.post(API_BASE, {
            action: "status",
            id: taskId,
            state: returnedState
          }, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 2e4
          });
          const pollObj = Array.isArray(pollRes?.result) ? pollRes.result[0] : pollRes?.result;
          if (pollObj?.resultUrl) {
            finalResultUrl = pollObj.resultUrl;
            break;
          }
        } catch {}
      }
      if (!finalResultUrl) {
        const checkCommand = `${prefix}dreemy --status ${taskId} --state ${returnedState}`;
        const timeoutText = `⏳ *RENDER MASIH BERJALAN...*\n\n` + `🆔 *Task ID:* \`${taskId}\`\n\n` + `_Proses memakan waktu lebih lama dari biasanya. Klik tombol copy di bawah untuk mengambil hasil render nanti._`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📋 Salin Cek Hasil",
          copy_code: checkCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        }];
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(timeoutText, `${botName} • Dreemy AI`, buttons, {
            title: "乂 DREEMY AI - IN PROGRESS 乂",
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            text: timeoutText
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      const mode = imageUrl ? "IMAGE-TO-IMAGE (I2I)" : "TEXT-TO-IMAGE (T2I)";
      let bodyText = `🎨 *DREEMY AI COMPLETED*\n\n` + `📝 *Prompt:* ${body.prompt}\n` + `🎭 *Mode:* \`${mode}\`\n` + `🤖 *Model:* \`${modelName}\`\n` + `🆔 *Task ID:* \`${taskId}\`\n\n` + `_💡 Klik tombol copy di bawah untuk melanjutkan editing gambar ini._`;
      const footerText = `${botName} • Dreemy AI`;
      const buttons = [];
      if (returnedState) {
        const nextCommand = `${prefix}dreemy <tulis_prompt_edit_lanjutan> --state ${returnedState}`;
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
          title: `乂 DREEMY AI - ${mode} 乂`,
          subtitle: `Model: ${modelName}`,
          media: finalResultUrl,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: finalResultUrl
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
      ctx.reply(`❌ Dreemy AI Error: ${errMsg}`);
    }
  }
};