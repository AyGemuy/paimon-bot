import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/audio/vocal-remover";
const formatSize = bytes => {
  if (!bytes || bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
export default {
  name: "vocalremover",
  aliases: ["vocal", "instrumental", "karaoke", "acapella", "splitvocal", "stem"],
  description: "Pisahkan vokal dan instrumen musik (Karaoke/Acapella) menggunakan AI Vocal Remover",
  category: "AI & Audio",
  limit: true,
  example: "reply audio/lagu dengan .vocalremover atau .vocalremover <link_audio>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          return ctx.reply(`🎙️ *AI VOCAL REMOVER & KARAOKE*\n\n` + `Pisahkan trek vokal (Acapella) dan musik pengiring (Instrumental/Karaoke) dari lagu menggunakan AI.\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Balas (reply) lagu/audio dengan: \`${prefix}vocalremover\`\n` + `  👉 Atau gunakan link audio: \`${prefix}vocalremover https://u.pone.rs/sample.mp3\``);
        }
        await ctx.react("⏳");
        const audioBuffer = await ctx.download();
        if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh audio dari WhatsApp.");
        }
        const uploadRes = await upload(audioBuffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah audio: ${uploadRes?.message || "Uploader error"}`);
        }
        targetAudioUrl = uploadRes.url;
      } else {
        await ctx.react("⏳");
      }
      const {
        data: res
      } = await axios.post(API_URL, {
        audioUrl: targetAudioUrl
      }, {
        params: {
          audioUrl: targetAudioUrl
        },
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 12e4
      });
      const vocalUrl = res?.dst_vocal;
      const instrumentalUrl = res?.dst_other;
      if (!vocalUrl && !instrumentalUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "Gagal memisahkan vokal dan instrumen dari audio ini.";
        return ctx.reply(`❌ Pemrosesan Gagal: ${errMsg}`);
      }
      const fileName = res?.origin_file_name || "audio.mp3";
      const durationSec = res?.duration ? `${(res.duration / 1e3).toFixed(1)} detik` : "-";
      const fileSize = formatSize(res?.file_size);
      const infoText = `╭─〔 *VOCAL REMOVER COMPLETED* 〕─⬿\n` + `│\n` + `│ 📁 *Nama File:* ${fileName}\n` + `│ ⏱️ *Durasi:* ${durationSec}\n` + `│ 📦 *Ukuran File:* ${fileSize}\n` + `│ 🎙️ *Vokal (Acapella):* Tersedia\n` + `│ 🎸 *Instrumen (Karaoke):* Tersedia\n` + `│\n` + `╰─────────────────────────⬿\n\n` + `_Mengirim hasil pemisahan audio (Vokal & Instrumen)..._`;
      const buttons = [];
      if (vocalUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🎤 Download Vokal (MP3)",
          url: vocalUrl
        });
      }
      if (instrumentalUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🎸 Download Instrumen (MP3)",
          url: instrumentalUrl
        });
      }
      if (typeof ctx.sendCta === "function" && buttons.length > 0) {
        await ctx.sendCta(infoText, `${botName} • Vocal Remover AI`, buttons, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: infoText
        }, {
          quoted: quotedMsg
        });
      }
      if (vocalUrl) {
        try {
          const {
            data: vocalBuffer
          } = await axios.get(vocalUrl, {
            responseType: "arraybuffer",
            timeout: 6e4
          });
          await sock.sendMessage(ctx.id, {
            audio: Buffer.from(vocalBuffer),
            mimetype: "audio/mpeg",
            fileName: `${fileName}.mp3`
          }, {
            quoted: quotedMsg
          });
        } catch (e) {
          console.error("Gagal mengirim vokal:", e.message);
        }
      }
      if (instrumentalUrl) {
        try {
          const {
            data: instBuffer
          } = await axios.get(instrumentalUrl, {
            responseType: "arraybuffer",
            timeout: 6e4
          });
          await sock.sendMessage(ctx.id, {
            audio: Buffer.from(instBuffer),
            mimetype: "audio/mpeg",
            fileName: `${fileName}.mp3`
          }, {
            quoted: quotedMsg
          });
        } catch (e) {
          console.error("Gagal mengirim instrumen:", e.message);
        }
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ Vocal Remover Error: ${errMsg}`);
    }
  }
};