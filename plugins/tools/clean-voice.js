import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/tools/audio/clean-voice";
export default {
  name: "cleanvoice",
  aliases: ["cleanaudio", "denoise", "jernihkansound", "removebreath"],
  description: "Hilangkan noise, suara napas, dan jeda kosong pada rekaman audio menggunakan Cleanvoice AI",
  category: "AI & Audio",
  limit: true,
  example: "reply voice note/audio dengan .cleanvoice atau .cleanvoice <link_audio>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let targetAudioUrl = (ctx.args?.[0] || "").trim();
      const isDirectUrl = /^https?:\/\/.+/i.test(targetAudioUrl);
      if (!isDirectUrl) {
        const isAudio = ctx.quoted?.isMedia && (ctx.quoted?.mediaType === "audio" || /audio/i.test(ctx.quoted?.mimetype || "")) || ctx.isMedia && (ctx.mediaType === "audio" || /audio/i.test(ctx.mimetype || ""));
        if (!isAudio) {
          return ctx.reply(`🎙️ *CLEANVOICE AI ENHANCER*\n\n` + `Hilangkan suara desis, napas berlebih, dan jeda mati (dead-air) pada rekaman suara secara otomatis.\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Balas (reply) Voice Note atau Audio dengan: \`${prefix}cleanvoice\`\n` + `  👉 Atau ketik link audio: \`${prefix}cleanvoice https://u.pone.rs/sample.m4a\``);
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
      const previewEditedUrl = res?.results?.merged_audio_url?.preview_edited || res?.results?.preview_edited || res?.preview_edited || res?.download_url || res?.url;
      if (!previewEditedUrl) {
        await ctx.react("❌");
        const errMsg = res?.message || res?.error || "AI gagal memproses file audio ini.";
        return ctx.reply(`❌ Pemrosesan Gagal: ${errMsg}`);
      }
      const stats = res?.results?.statistics || {};
      const breathCount = stats.BREATH ?? 0;
      const deadAirCount = stats.DEADAIR ?? 0;
      const filename = res.filename || "clean_voice.m4a";
      const status = res.status || "DONE";
      const infoText = `╭─〔 *CLEANVOICE AI COMPLETED* 〕─⬿\n` + `│\n` + `│ 📊 *Status:* ${status}\n` + `│ 📁 *Nama File:* ${filename}\n` + `│ 🌬️ *Napas Dihapus (BREATH):* ${breathCount} titik\n` + `│ 🔇 *Jeda Kosong Dipotong (DEADAIR):* ${deadAirCount} segmen\n` + `│ ⚡ *Engine:* Cleanvoice AI R2\n` + `│\n` + `╰─────────────────────────⬿\n\n` + `_Mengirim hasil audio jernih..._`;
      await sock.sendMessage(ctx.id, {
        text: infoText
      }, {
        quoted: quotedMsg
      });
      try {
        const {
          data: cleanBuffer
        } = await axios.get(previewEditedUrl, {
          responseType: "arraybuffer",
          timeout: 6e4
        });
        await sock.sendMessage(ctx.id, {
          audio: Buffer.from(cleanBuffer),
          mimetype: "audio/mpeg",
          fileName: `${filename}.mp3`
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
      } catch (mediaErr) {
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(`⚠️ _Gagal mengirim file langsung. Silakan unduh/dengarkan melalui tombol di bawah:_`, "Cleanvoice AI Player", [{
            name: "cta_url",
            display_text: "▶️ Dengarkan / Unduh Audio",
            url: previewEditedUrl
          }], {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(`🔗 *Link Audio Bersih:* ${previewEditedUrl}`, {
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
      ctx.reply(`❌ Cleanvoice Error: ${errMsg}`);
    }
  }
};