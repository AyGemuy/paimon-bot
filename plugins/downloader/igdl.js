import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "igdl",
  aliases: ["ig", "instagram", "instagramdownloader"],
  description: "Download media Instagram dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    if (!url) return ctx.reply(`❌ Masukkan link Instagram!\nContoh: \`${ctx.prefix || "."}ig https://www.instagram.com/reel/Dc8Hd2RSl07/\``);
    try {
      await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/instagram/v35", {
        url: url
      });
      const data = res.data;
      if (!data.status || !data.result?.length) {
        await ctx.react("❌");
        return ctx.reply("❌ Media tidak ditemukan atau akun di-private.");
      }
      const firstItem = data.result[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const buttons = [];
      if (data.result.length > 1) {
        const slideRows = data.result.map((item, i) => ({
          title: `📷 Media Ke-${i + 1}`,
          id: `${prefix}ig ${url}`,
          description: `Tipe: ${item.video_url ? "Video" : "Foto"} (Slide ${i + 1}/${data.result.length})`
        }));
        buttons.push({
          title: "📷 DAFTAR SLIDE MEDIA",
          sections: [{
            title: `Slide Media (${data.result.length})`,
            rows: slideRows
          }]
        });
      }
      const igPostUrl = firstItem.shortcode ? `https://www.instagram.com/p/${firstItem.shortcode}/` : url;
      buttons.push({
        text: "📸 Buka di Instagram",
        url: igPostUrl
      }, {
        text: "📋 Salin Link",
        copy_code: url
      });
      const bodyText = `╭───『 *INSTAGRAM DETAIL* 』\n` + `│ 📅 *Publish:* ${firstItem.publish_date || "-"}\n` + `│ ❤️ *Likes:* ${firstItem.like_count || "0"}\n` + `│ 💬 *Comments:* ${firstItem.comment_count || "0"}\n` + `│ 📁 *Total:* ${data.result.length} Item\n` + `│ 🔗 *Shortcode:* ${firstItem.shortcode || "-"}\n` + `╰──────────────────\n\n` + `📝 *Caption:*\n${firstItem.caption || "-"}`;
      const thumb = firstItem.thumbnail_url || firstItem.image_url || firstItem.video_thumbnail_url;
      await ctx.sendCta(bodyText, `${global.bot?.name || "WudysoftBot"} • Instagram Downloader`, buttons, {
        title: "乂 INSTAGRAM DOWNLOADER 乂",
        media: thumb || null,
        quoted: quotedMsg
      });
      for (let i = 0; i < data.result.length; i++) {
        const item = data.result[i];
        const caption = data.result.length > 1 ? `Media (${i + 1}/${data.result.length})` : "";
        if (item.video_url) {
          await sock.sendMessage(ctx.id, {
            video: {
              url: item.video_url
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        } else if (item.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: item.image_url
            },
            caption: caption
          }, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};