import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "flixaritek",
  aliases: ["flixaritek", "aritek", "flixai"],
  description: "AI Generator & Editor Aritek Multi-Version (T2I, I2I, T2V, I2V)",
  category: "AI",
  example: "flixaritek <prompt> [--v53/--v52/--v50/--v49/--v48] [--video/--image]",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("flixaritek") || firstWord.endsWith("aritek") || firstWord.endsWith("flixai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!text && !isMedia) {
        return ctx.reply(`🎬 *FLIXARITEK AI MULTI-VERSION*\n\n` + `• *Pilihan Versi:* \`--v48\`, \`--v49\`, \`--v50\`, \`--v52\`, \`--v53\` _(Default: v53)_\n` + `• *Pilihan Output:* \`--video\` / \`-v\` atau \`--image\` / \`-i\`\n\n` + `📌 *Contoh Penggunaan:*\n` + `  👉 *T2I:* \`${prefix}flixaritek cyberpunk girl neon city --v53\`\n` + `  👉 *T2V:* \`${prefix}flixaritek beautiful waterfall --v50 --video\`\n` + `  👉 *I2I:* Reply gambar: \`${prefix}flixaritek anime style --v49\`\n` + `  👉 *I2V:* Reply gambar: \`${prefix}flixaritek camera zoom in --v52 --video\``);
      }
      await ctx.react("⏳");
      let version = "v53";
      const versionMatch = text.match(/--v(\d+)\b/i);
      if (versionMatch) {
        version = `v${versionMatch[1]}`;
        text = text.replace(/--v\d+\b/gi, "").trim();
      }
      let outputMode = "image";
      if (/--(video|v)\b/i.test(text)) {
        outputMode = "video";
        text = text.replace(/--(video|v)\b/gi, "").trim();
      } else if (/--(image|i)\b/i.test(text)) {
        outputMode = "image";
        text = text.replace(/--(image|i)\b/gi, "").trim();
      }
      const prompt = text || "masterpiece, high quality, 4k ultra detailed";
      let mediaUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah media: ${uploadRes?.message || "Server upload error"}`);
        }
        mediaUrl = uploadRes.url;
      }
      let resolvedMode = outputMode;
      let displayType = "";
      if (version === "v49") {
        if (mediaUrl) {
          resolvedMode = outputMode === "video" ? "i2v" : "t2i";
          displayType = outputMode === "video" ? "IMAGE-TO-VIDEO (I2V)" : "IMAGE-TO-IMAGE (I2I)";
        } else {
          resolvedMode = outputMode === "video" ? "t2v" : "t2i";
          displayType = outputMode === "video" ? "TEXT-TO-VIDEO (T2V)" : "TEXT-TO-IMAGE (T2I)";
        }
      } else {
        if (mediaUrl) {
          displayType = outputMode === "video" ? "IMAGE-TO-VIDEO (I2V)" : "IMAGE-TO-IMAGE (I2I)";
        } else {
          displayType = outputMode === "video" ? "TEXT-TO-VIDEO (T2V)" : "TEXT-TO-IMAGE (T2I)";
        }
      }
      const body = {
        action: "generate",
        mode: resolvedMode,
        prompt: prompt
      };
      if (mediaUrl) {
        body.media = mediaUrl;
        body.image = mediaUrl;
      }
      const apiUrl = `https://wudysoft.my.id/api/ai/video/${version}?action=generate`;
      const {
        data
      } = await axios.post(apiUrl, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 15e4
      });
      const resultUrl = data?.result?.url || (typeof data?.result === "string" ? data.result : null) || data?.url;
      const isSuccess = data?.status === "success" || data?.status === true;
      if (!isSuccess || !resultUrl) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses pada versi \`${version}\`: ${data?.message || "API tidak mengembalikan file hasil."}`);
      }
      const jobId = data?.result?.jobId || data?.jobId || data?.result?.video_id || "-";
      const bodyText = `🎬 *FLIXARITEK AI COMPLETED*\n\n` + `⚙️ *Versi API:* \`${version.toUpperCase()}\`\n` + `📝 *Prompt:* ${prompt}\n` + `🎭 *Mode:* \`${displayType}\`\n` + (jobId !== "-" ? `🆔 *Job ID:* \`${jobId}\`` : "");
      const isVideoResult = outputMode === "video" || /\.(mp4|mov|webm)/i.test(resultUrl);
      if (isVideoResult) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: resultUrl
          },
          caption: bodyText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, `${botName} • Aritek ${version.toUpperCase()}`, [], {
            title: `乂 FLIXARITEK AI - ${displayType} 乂`,
            subtitle: `Generated with Aritek ${version}`,
            media: resultUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: resultUrl
            },
            caption: bodyText
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Terjadi kesalahan: ${errMsg}`);
    }
  }
};