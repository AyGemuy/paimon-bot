import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "ttstalk",
  aliases: ["tiktokstalk", "stalktt"],
  description: "Menampilkan informasi profil TikTok",
  category: "Stalker",
  example: "username",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan username TikTok.\nContoh: .ttstalk fitya_taa");
      const username = ctx.args[0].replace("@", "");
      const {
        data
      } = await axios.get(`https://api.deltaku.web.id/api/stalk/tiktok?username=${username}`);
      if (!data.status) return ctx.reply("❌ Akun tidak ditemukan");
      const d = data.data.user;
      const stats = data.data.statistics;
      const teks = `┏━━━〔 TIKTOK STALKER 〕━━━┓
┃ Username: @${d.unique_id}
┃ Nickname: ${d.nickname}
┃ ID: ${d.id}
┃ Verified: ${d.verified ? "✅" : "❌"}
┃ Private: ${d.private_account ? "🔒" : "🌍"}
┃
┃ 📊 Statistics:
┃ • Followers: ${stats.followers?.toLocaleString() || 0}
┃ • Following: ${stats.following || 0}
┃ • Hearts: ${stats.hearts?.toLocaleString() || 0}
┃ • Videos: ${stats.videos || 0}
┃
┃ 📝 Bio: ${d.signature || "-"}
┃
┃ 🔗 ${data.data.profile_url}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: d.avatar
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