import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const VALID_VIDEO_QUALITIES = ["1080", "720", "480", "360", "240", "144"];
const VALID_AUDIO_FORMATS = ["mp3", "audio", "m4a"];
const API_URL = "https://wudysoft.my.id/api/download/savetube/v1";
async function fetchThumbnailBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Thumbnail Error]:", err.message);
  }
  return null;
}
export default {
  name: "savetube",
  aliases: ["stube", "savetubedl", "st"],
  description: "Download video atau audio YouTube via SaveTube dengan pilihan resolusi lengkap",
  category: "Downloader",
  limit: true,
  example: "savetube <link yt> atau savetube <link yt> mp3 atau savetube <link yt> 720",
  execute: async (sock, ctx, msg) => {
    try {
      const rawArgs = ctx.args || [];
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const textToSearch = rawArgs.join(" ") + " " + (ctx.quoted?.text || "");
      const matchedUrl = textToSearch.match(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/i);
      const url = matchedUrl ? matchedUrl[0] : "";
      if (!url) {
        return ctx.reply(`🎬 *SAVETUBE YOUTUBE DOWNLOADER*\n\n` + `👉 *Format Penggunaan:*\n` + `• \`${prefix}savetube <link yt>\`\n` + `• \`${prefix}savetube <link yt> mp3\`\n` + `• \`${prefix}savetube <link yt> 720\` (atau 1080/480/360)`);
      }
      const otherArgs = rawArgs.filter(arg => !/https?:\/\//i.test(arg)).map(a => a.toLowerCase().replace(/p$/i, ""));
      let reqType = "video";
      let reqQuality = "360";
      let hasExplicitQualityOrType = false;
      for (const arg of otherArgs) {
        if (VALID_AUDIO_FORMATS.includes(arg)) {
          reqType = "audio";
          reqQuality = "128";
          hasExplicitQualityOrType = true;
        } else if (VALID_VIDEO_QUALITIES.includes(arg)) {
          reqType = "video";
          reqQuality = arg;
          hasExplicitQualityOrType = true;
        }
      }
      await ctx.react("⏳");
      const {
        data: resData
      } = await axios.post(API_URL, {
        url: url,
        quality: reqQuality,
        type: reqType
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      if (!resData || !resData.status || !resData.data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memproses video dari SaveTube API. Pastikan tautan valid dan tidak dibatasi usia.");
      }
      const info = resData.data.videoInfo || {};
      const downloadUrl = resData.data.downloadUrl || info.video_formats?.find(v => v.url)?.url;
      const title = info.title || "YouTube Media";
      const durationLabel = info.durationLabel || `${Math.floor((info.duration || 0) / 60)} min`;
      const thumbnail = info.thumbnail || `https://i.ytimg.com/vi/${info.id}/sddefault.jpg`;
      if (hasExplicitQualityOrType) {
        if (!downloadUrl) {
          await ctx.react("❌");
          return ctx.reply(`❌ Link unduhan untuk kualitas *${reqQuality}p (${reqType})* tidak tersedia di server.`);
        }
        if (reqType === "audio") {
          await sock.sendMessage(ctx.id, {
            audio: {
              url: downloadUrl
            },
            mimetype: "audio/mp4",
            fileName: `${info.titleSlug || "audio"}.mp3`
          }, {
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            video: {
              url: downloadUrl
            },
            caption: `✅ *${title}*\n🎬 *Kualitas:* ${reqQuality}p • ⏱️ *Durasi:* ${durationLabel}`
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      const videoFormats = info.video_formats || [];
      const videoRows = videoFormats.map(v => ({
        title: `🎥 Video ${v.label || `${v.quality}p`}`,
        id: `${prefix}savetube ${url} ${v.quality}`,
        description: `Download video MP4 resolusi ${v.width || 0}x${v.height || v.quality}`
      }));
      const audioRows = [{
        title: "🎵 Audio MP3 High Quality",
        id: `${prefix}savetube ${url} mp3`,
        description: "Download format audio MP3 320kbps"
      }];
      const listSections = [{
        title: "🎥 PILIHAN KUALITAS VIDEO",
        rows: videoRows.length > 0 ? videoRows : [{
          title: "🎥 Video 360p (Default)",
          id: `${prefix}savetube ${url} 360`,
          description: "Download video MP4 kualitas standar"
        }]
      }, {
        title: "🎵 PILIHAN AUDIO",
        rows: audioRows
      }];
      const buttons = [{
        name: "single_select",
        title: "📥 PILIH FORMAT / KUALITAS",
        sections: listSections
      }, {
        name: "cta_url",
        display_text: "🎬 Tonton di YouTube",
        url: url
      }];
      if (downloadUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "🌐 Direct Download (Browser)",
          url: downloadUrl
        });
      }
      const bodyText = `🎬 *${title}*\n\n` + `╭───『 *INFORMASI VIDEO* 』\n` + `│ ⏱️ *Durasi:* ${durationLabel}\n` + `│ 🆔 *Video ID:* \`${info.id || "-"}\`\n` + `│ 🎞️ *Kualitas Default:* 360p\n` + `╰──────────────────\n\n` + `_Silakan pilih resolusi video atau audio dari menu di bawah._\n` + `_Video default 360p sedang dikirimkan..._`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • SaveTube Downloader`;
      const thumbBuffer = await fetchThumbnailBuffer(thumbnail);
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 SAVETUBE DOWNLOADER 乂",
        subtitle: `Durasi: ${durationLabel}`,
        ...thumbBuffer ? {
          media: thumbBuffer,
          mediaType: "image"
        } : {},
        quoted: quotedMsg
      });
      if (downloadUrl) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: downloadUrl
          },
          caption: `✅ *${title}* (360p)\n⏱️ *Durasi:* ${durationLabel}`
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[SaveTube Downloader Error]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ *SaveTube Error:* ${e.response?.data?.message || e.message}`);
    }
  }
};