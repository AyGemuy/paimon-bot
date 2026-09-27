import yts from "yt-search";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "ytsearch",
  aliases: ["yts", "play", "yt"],
  description: "Mencari video YouTube dengan tampilan Interactive List CTA & Download",
  category: "Search",
  limit: true,
  example: "yts alan walker faded",
  execute: async (sock, ctx, msg) => {
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        return ctx.reply(`🎬 *YOUTUBE SEARCH*\n\n` + `Silakan masukkan judul atau kata kunci video yang ingin dicari!\n` + `👉 Contoh: \`${ctx.prefix || "."}yts Alan Walker Faded\``);
      }
      await ctx.react("⏳");
      const searchResult = await yts(query);
      const videos = (searchResult.videos || []).slice(0, 10);
      if (!videos.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video untuk kata kunci: *${query}*`);
      }
      const topVideo = videos[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const downloadRows = [{
        title: "🎵 DOWNLOAD AUDIO (MP3)",
        id: `${prefix}ytmp3 ${topVideo.url}`,
        description: `Unduh audio MP3 kualitas tinggi (${topVideo.timestamp || "-"})`
      }, {
        title: "🎥 DOWNLOAD VIDEO (MP4)",
        id: `${prefix}ytmp4 ${topVideo.url}`,
        description: "Unduh video MP4 kualitas 360p/720p HD"
      }, {
        title: "🎙️ VOICE NOTE (VN)",
        id: `${prefix}ytmp3 voice ${topVideo.url}`,
        description: "Kirim audio langsung dalam bentuk Voice Note"
      }];
      const otherVideoRows = videos.slice(1).map((v, i) => ({
        title: `${i + 2}. ${v.title.slice(0, 24)}`,
        id: `${prefix}yts ${v.url}`,
        description: `⏱️ ${v.timestamp || "-"} | 👤 ${v.author?.name || "Channel"} | 👁️ ${v.views?.toLocaleString("id-ID") || 0} views`.slice(0, 60)
      }));
      const listSections = [{
        title: "📥 DOWNLOAD HASIL UTAMA",
        rows: downloadRows
      }];
      if (otherVideoRows.length > 0) {
        listSections.push({
          title: `🎬 HASIL PENCARIAN LAINNYA (${otherVideoRows.length})`,
          rows: otherVideoRows
        });
      }
      const bodyText = `🎬 *${topVideo.title}*\n\n` + `╭───『 *VIDEO DETAIL* 』\n` + `│ 👤 *Channel:* ${topVideo.author?.name || "-"}\n` + `│ ⏱️ *Durasi:* ${topVideo.timestamp || "-"}\n` + `│ 👁️ *Penonton:* ${topVideo.views?.toLocaleString("id-ID") || 0} views\n` + `│ 📅 *Diupload:* ${topVideo.ago || "-"}\n` + `│ 🔗 *Tautan:* ${topVideo.url}\n` + `╰──────────────────\n\n` + `Silakan gunakan tombol di bawah untuk mendownload atau memilih hasil video lainnya.`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • YouTube Search`;
      const buttons = [{
        name: "single_select",
        title: "📥 DOWNLOAD & PILIHAN VIDEO",
        sections: listSections
      }, {
        name: "quick_reply",
        display_text: "🎵 Download MP3",
        id: `${prefix}ytmp3 ${topVideo.url}`
      }, {
        name: "cta_url",
        display_text: "🎬 Tonton di YouTube",
        url: topVideo.url
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Link Video",
        copy_code: topVideo.url
      }];
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 YOUTUBE SEARCH RESULT 乂",
        subtitle: topVideo.title,
        media: topVideo.thumbnail,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ YouTube Search Error: ${error.message}`);
    }
  }
};