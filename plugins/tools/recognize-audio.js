import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDuration(ms = 0) {
  const totalSeconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}
export default {
  name: "recognize",
  aliases: ["whatmusic", "shazam", "liriklagu", "kenalilagu", "findmusic"],
  description: "Mendeteksi judul lagu & artis dari pesan audio/vn/video dan menggunakan YouTube HD Thumbnail",
  category: "Tools",
  example: "Reply audio/voice note dengan perintah .recognize atau ketik .recognize <url_audio>",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const targetQuoted = ctx.quoted || ctx;
      const isAudioOrVideo = targetQuoted?.isMedia && /audio|video|document/i.test(targetQuoted?.mimetype || targetQuoted?.mediaType || "");
      let audioUrl = ctx.args?.[0]?.trim() || "";
      if (!isAudioOrVideo && !/^https?:\/\//i.test(audioUrl)) {
        return ctx.reply(`🎵 *RECOGNIZE AUDIO / MUSIC IDENTIFIER*\n\n` + `• *Cara Pakai:*\n` + `  👉 Kirim/Reply audio, VN, atau video pendek dengan caption \`${prefix}recognize\`\n` + `  👉 Atau ketik: \`${prefix}recognize <url_audio.mp3>\``);
      }
      await ctx.react("⏳");
      if (isAudioOrVideo) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media audio dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah file audio: ${uploadRes?.message || "Server upload error"}`);
        }
        audioUrl = uploadRes.url;
      }
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/tools/recognize-audio/v2", {
        audio: audioUrl
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || data.status !== true || !data.result?.music) {
        await ctx.react("❌");
        return ctx.reply("❌ Musik tidak berhasil dikenali. Pastikan suara musik terdengar jelas dan tidak terlalu bising.");
      }
      const music = data.result.music;
      const title = music.title || "Unknown Title";
      const artist = music.artist || "Unknown Artist";
      const album = music.album || "-";
      const releaseDate = music.release_date || "-";
      const label = music.label || "-";
      const genres = Array.isArray(music.genres) ? music.genres.join(", ") : "-";
      const duration = formatDuration(music.duration_ms);
      const score = music.score || 100;
      const ext = music.external_metadata || {};
      const spotifyTrackId = ext.spotify?.track?.id || "";
      const spotifyUrl = spotifyTrackId ? `https://open.spotify.com/track/${spotifyTrackId}` : "";
      const ytVid = ext.youtube?.vid || "";
      const youtubeUrl = ytVid ? `https://youtu.be/${ytVid}` : "";
      let bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      if (ytVid) {
        bannerMedia = `https://i.ytimg.com/vi/${ytVid}/hqdefault.jpg`;
      }
      const bodyText = `🎵 *AUDIO RECOGNIZED SUCCESSFULLY!* 🎧\n\n` + `╭───『 *INFORMASI LAGU* 』\n` + `│ 📌 *Judul:* ${title}\n` + `│ 👤 *Artis:* ${artist}\n` + `│ 💿 *Album:* ${album}\n` + `│ 📅 *Rilis:* ${releaseDate}\n` + `│ 🏷️ *Label:* ${label}\n` + `│ ⏱️ *Durasi:* ${duration} menit\n` + `│ 🎭 *Genre:* ${genres}\n` + `│ 🎯 *Akurasi:* ${score}%\n` + `╰───────────────────────\n\n` + `_Gunakan dropdown atau tombol di bawah untuk langsung mengunduh lagu ini via Spotify / YouTube!_`;
      const footerText = `${botName} • Music Identifier ✦ Shazam AI`;
      const downloadRows = [];
      if (spotifyUrl) {
        downloadRows.push({
          title: "🟢 Download Spotify (MP3)",
          description: `Download lagu via Spotify URL`,
          id: `${prefix}spotify ${spotifyUrl}`
        });
      }
      if (youtubeUrl) {
        downloadRows.push({
          title: "🔴 Download YouTube Audio (MP3)",
          description: `Unduh audio berkualitas tinggi dari YouTube`,
          id: `${prefix}ytmp3 ${youtubeUrl}`
        }, {
          title: "🎬 Download YouTube Video (MP4)",
          description: `Unduh video musik resmi dari YouTube`,
          id: `${prefix}ytmp4 ${youtubeUrl}`
        });
      }
      downloadRows.push({
        title: "🔍 Cari Audio Otomatis (Play)",
        description: `Pencarian otomatis: ${title} - ${artist}`,
        id: `${prefix}play ${title} ${artist}`
      });
      const buttons = [];
      buttons.push({
        name: "single_select",
        title: "📥 PILIH FORMAT DOWNLOAD",
        sections: [{
          title: `${title} - ${artist}`,
          rows: downloadRows
        }]
      });
      if (spotifyUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🎧 Buka di Spotify",
          url: spotifyUrl
        });
      }
      if (youtubeUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "📺 Tonton di YouTube",
          url: youtubeUrl
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "📋 Salin Info Lagu",
        copy_code: `${title} - ${artist}`
      });
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1, 2, 999],
            list_title: `${title} • Unduh Lagu`,
            button_title: "Unduh Musik"
          },
          limited_time_offer: {
            text: `✦ ${title} - ${artist} ✦`,
            url: spotifyUrl || youtubeUrl || "https://wudysoft.my.id",
            copy_code: `${title} - ${artist}`,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await ctx.reply(bodyText);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[RECOGNIZE AUDIO ERROR]", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Gagal mengenali audio: ${errMsg}`);
    }
  }
};