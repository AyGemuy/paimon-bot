import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "ytstalk",
  aliases: ["youtubestalk", "stalkyt"],
  description: "Menampilkan informasi channel YouTube",
  category: "Stalker",
  example: "username",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan username YouTube.\nContoh: .ytstalk wonaaay");
      const username = ctx.args[0].replace("@", "");
      const {
        data
      } = await axios.get(`https://api.deltaku.web.id/api/stalk/youtube?username=${username}`);
      if (!data.status) return ctx.reply("❌ Channel tidak ditemukan");
      const d = data.data;
      const latest = d.latest_videos?.slice(0, 3).map(v => `• ${v.title}\n  ⏱️ ${v.duration} | 👁️ ${v.viewCount} | 🗓️ ${v.publishedTime}`).join("\n\n");
      const teks = `┏━━━〔 YOUTUBE STALKER 〕━━━┓
┃ Channel: ${d.channel.username}
┃ Name: ${d.channel.title || "Unknown"}
┃ Subscribers: ${d.channel.subscriberCount || "0"}
┃ Videos: ${d.channel.videoCount || "0"}
┃ Description: ${d.channel.description?.slice(0, 200) || "-"}...
┃
┃ 📹 Latest Videos:
${latest || "• No videos"}
┃
┃ 🔗 ${d.channel.channelUrl}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: d.channel.avatarUrl
        },
        caption: teks
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  }
};