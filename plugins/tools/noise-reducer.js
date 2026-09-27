import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/audio/noise-reducer";
export default {
  name: "noisereducer",
  aliases: ["denoiser", "reducenoise", "nr", "hilangkanbising"],
  description: "Hilangkan suara bising/kresek pada audio menggunakan Machine Learning Noise Reducer v4",
  category: "AI & Audio",
  limit: true,
  example: "reply voice note/audio dengan .noisereducer atau .noisereducer <link_audio>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          return ctx.reply(`🎧 *AI NOISE REDUCER*\n\n` + `Menghilangkan desis latar, dengung AC/kipas, dan suara bising pada rekaman audio menggunakan AI.\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Balas (reply) Voice Note atau Audio dengan: \`${prefix}noisereducer\`\n` + `  👉 Atau gunakan link audio: \`${prefix}noisereducer https://u.pone.rs/sample.m4a\``);
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
      const outputAudioUrl = res?.output_audio || res?.output_audio_denoised || res?.url || res?.download_url;
      if (!outputAudioUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "Gagal memproses peredaman bising pada audio ini.";
        return ctx.reply(`❌ Pemrosesan Gagal: ${errMsg}`);
      }
      const mlModel = res?.ml_model?.title || "NR v4.0";
      const modelDesc = res?.ml_model?.short_description || "Background Noise Suppression";
      const progress = res?.progress_percentage ? `${res.progress_percentage}%` : "100%";
      const audioId = res?.id || "-";
      const infoText = `╭─〔 *NOISE REDUCER COMPLETED* 〕─⬿\n` + `│\n` + `│ 🆔 *Job ID:* ${audioId}\n` + `│ 🤖 *Model:* ${mlModel}\n` + `│ 📊 *Proses:* ${progress} Selesai\n` + `│ 📝 *Keterangan:* ${modelDesc}\n` + `│ ☁️ *Storage:* DigitalOcean Spaces CDN\n` + `│\n` + `╰─────────────────────────⬿\n\n` + `_Mengirim hasil rekaman yang telah diperjelas..._`;
      await sock.sendMessage(ctx.id, {
        text: infoText
      }, {
        quoted: quotedMsg
      });
      try {
        const {
          data: cleanBuffer
        } = await axios.get(outputAudioUrl, {
          responseType: "arraybuffer",
          timeout: 6e4
        });
        await sock.sendMessage(ctx.id, {
          audio: Buffer.from(cleanBuffer),
          mimetype: "audio/mpeg",
          fileName: `${audioId}.mp3`
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
      } catch (mediaErr) {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(`⚠️ _Gagal mengirim file langsung. Silakan unduh/putar audio melalui tombol di bawah:_`, "Noise Reducer Player", [{
            name: "cta_url",
            display_text: "▶️ Dengarkan / Unduh Audio",
            url: outputAudioUrl
          }], {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(`🔗 *Link Audio Denoised:* ${outputAudioUrl}`, {
            quoted: quotedMsg
          });
        }
        await ctx.react("⚠️");
      }
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.message || error.response.data?.error || errMsg;
      }
      ctx.reply(`❌ Noise Reducer Error: ${errMsg}`);
    }
  }
};