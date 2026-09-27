import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "twitterdl",
  aliases: ["twitter", "twtdl", "twdl", "x", "xdl"],
  description: "Download video atau foto dari Twitter / X dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const rawArgs = ctx.args || [];
    const url = rawArgs.find(arg => /https?:\/\/(www\.)?(twitter\.com|x\.com)/i.test(arg)) || "";
    if (!url) {
      return ctx.reply(`🐦 *TWITTER / X DOWNLOADER*\n\n` + `Silakan masukkan link tweet atau video X yang valid!\n` + `👉 Contoh: \`${ctx.prefix || "."}twitter https://x.com/sssirxn/status/2096752371321721287\``);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/twitter/v6", {
        url: url
      });
      const json = res.data;
      if (!json || json.code !== 200 || !json.tweet) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media atau tweet tidak ditemukan.");
      }
      const tweet = json.tweet;
      const author = tweet.author || {};
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const videos = tweet.media?.videos || [];
      const photos = tweet.media?.photos || [];
      const listSections = [];
      let topVideoUrl = null;
      let topThumbnail = author.avatar_url || null;
      if (videos.length > 0) {
        const videoObj = videos[0];
        topThumbnail = videoObj.thumbnail_url || topThumbnail;
        const sortedUrls = (videoObj.video_urls || []).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        topVideoUrl = sortedUrls[0]?.url;
        const videoRows = sortedUrls.map((v, i) => {
          const resMatch = v.url.match(/\/vid\/[^\/]+\/(\d+x\d+)\//);
          const resolution = resMatch ? resMatch[1] : `Kualitas ${i + 1}`;
          const bitrateText = v.bitrate ? `${Math.round(v.bitrate / 1e3)} kbps` : "Standard";
          return {
            title: `🎥 Video ${resolution}`,
            id: `${prefix}twitter ${url}`,
            description: `Bitrate: ${bitrateText} | Format: MP4`
          };
        });
        if (videoRows.length > 0) {
          listSections.push({
            title: "🎞️ PILIHAN KUALITAS VIDEO",
            rows: videoRows
          });
        }
      }
      const bodyText = `╭───『 *TWITTER / X DETAIL* 』\n` + `│ 👤 *Author:* ${author.name || "-"} (@${author.screen_name || "-"})\n` + `│ ❤️ *Likes:* ${tweet.likes?.toLocaleString("id-ID") || 0}\n` + `│ 🔁 *Retweets:* ${tweet.retweets?.toLocaleString("id-ID") || 0}\n` + `│ 💬 *Replies:* ${tweet.replies?.toLocaleString("id-ID") || 0}\n` + `│ 📅 *Created:* ${tweet.created_at || "-"}\n` + `╰──────────────────\n\n` + `📝 *Tweet:*\n${tweet.text || "-"}`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Twitter Downloader`;
      const buttons = [];
      if (listSections.length > 0) {
        buttons.push({
          name: "single_select",
          title: "🎞️ PILIH KUALITAS VIDEO",
          sections: listSections
        });
      }
      buttons.push({
        name: "cta_url",
        display_text: "🐦 Buka di Twitter / X",
        url: tweet.url || url
      });
      if (topVideoUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "📥 Direct Download Link",
          url: topVideoUrl
        });
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Unduhan",
          copy_code: topVideoUrl
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 TWITTER / X DOWNLOADER 乂",
          subtitle: `@${author.screen_name || "Twitter"} Post`,
          media: topThumbnail,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText);
      }
      if (topVideoUrl) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: topVideoUrl
          },
          caption: `✅ *Tweet by @${author.screen_name}*`
        }, {
          quoted: quotedMsg
        });
      }
      if (photos.length > 0) {
        for (const photo of photos) {
          const photoUrl = photo.url || photo;
          await sock.sendMessage(ctx.id, {
            image: {
              url: photoUrl
            },
            caption: `✅ *Tweet by @${author.screen_name}*`
          }, {
            quoted: quotedMsg
          });
        }
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Twitter Download Error: ${e.message}`);
    }
  }
};