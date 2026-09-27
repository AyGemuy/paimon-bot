import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "fbdl",
  aliases: ["fb", "facebook", "facebookdownloader"],
  description: "Download video Facebook dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    if (!url) return ctx.reply(`❌ Masukkan link Facebook!\nContoh: \`${ctx.prefix || "."}fb https://www.facebook.com/reel/1011488218194125/\``);
    try {
      await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/facebook/v1", {
        url: url
      });
      const data = res.data;
      if (!data?.links?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh video Facebook.");
      }
      const selectedVideo = data.links.find(v => v.quality.includes("HD") || v.quality.includes("720p")) || data.links[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const qualityRows = data.links.map((v, i) => ({
        title: `${i + 1}. Kualitas ${v.quality.toUpperCase()}`,
        id: `${prefix}fb ${url}`,
        description: `Resolusi: ${v.quality}`
      }));
      const buttons = [{
        title: "🎞️ PILIH RESOLUSI",
        sections: [{
          title: "Kualitas Video",
          rows: qualityRows
        }]
      }, {
        text: "📥 Direct Download",
        url: selectedVideo.url
      }, {
        text: "📋 Salin Link Unduhan",
        copy_code: selectedVideo.url
      }];
      const bodyText = `╭───『 *FACEBOOK DETAIL* 』\n` + `│ 🏷️ *Title:* ${data.title || "Facebook Video"}\n` + `│ ⏱️ *Duration:* ${data.duration || "-"}\n` + `│ 🎞️ *Selected:* ${selectedVideo.quality}\n` + `╰──────────────────\n\n` + `_Video kualitas terbaik sedang dikirim ke chat._`;
      await ctx.sendCta(bodyText, `${global.bot?.name || "WudysoftBot"} • Facebook Downloader`, buttons, {
        title: "乂 FACEBOOK DOWNLOADER 乂",
        subtitle: data.title || "Facebook Video",
        media: data.img || null,
        quoted: quotedMsg
      });
      await sock.sendMessage(ctx.id, {
        video: {
          url: selectedVideo.url
        },
        caption: `✅ *${data.title || "Facebook Video"}* (${selectedVideo.quality})`
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