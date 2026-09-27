import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDuration(ms) {
  if (!ms) return "-";
  const min = Math.floor(ms / 6e4);
  const sec = Math.floor(ms % 6e4 / 1e3);
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}
export default {
  name: "spotifydl",
  aliases: ["spotify", "spotdl", "spdl"],
  description: "Download lagu Spotify dengan CTA Card & Audio murni",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    if (!url) return ctx.reply(`❌ Masukkan link Spotify!\nContoh: \`${ctx.prefix || "."}spotify https://open.spotify.com/track/3GdN5n6p34yFMd12WKq8jL\``);
    try {
      await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/spotify/v7", {
        url: url
      });
      const data = res.data;
      if (!data.status || !data.download?.audio) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh audio Spotify.");
      }
      const audioUrl = data.download.audio;
      const spotifyUrl = data.metadata?.external_urls?.spotify || url;
      const duration = formatDuration(data.duration_ms || data.metadata?.duration_ms);
      const artists = (data.metadata?.artists || []).map(a => a.name).join(", ") || data.artist || "-";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const buttons = [{
        text: "🟢 Buka di Spotify",
        url: spotifyUrl
      }, {
        text: "📥 Direct Download MP3",
        url: audioUrl
      }, {
        text: "📋 Salin Link Lagu",
        copy_code: spotifyUrl
      }];
      const bodyText = `🎵 *${data.title}*\n\n` + `╭───『 *SPOTIFY DETAIL* 』\n` + `│ 🎤 *Artist:* ${artists}\n` + `│ ⏱️ *Durasi:* ${duration}\n` + `│ 🔞 *Explicit:* ${data.metadata?.explicit ? "Yes (18+)" : "No"}\n` + `╰──────────────────\n\n` + `_Audio MP3 sedang dikirimkan ke chat._`;
      await ctx.sendCta(bodyText, `${global.bot?.name || "WudysoftBot"} • Spotify Downloader`, buttons, {
        title: "乂 SPOTIFY MUSIC 乂",
        media: data.thumbnail || data.metadata?.album?.images?.[0]?.url || null,
        quoted: quotedMsg
      });
      await sock.sendMessage(ctx.id, {
        audio: {
          url: audioUrl
        },
        mimetype: "audio/mpeg",
        fileName: `${data.title} - ${artists}.mp3`
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};