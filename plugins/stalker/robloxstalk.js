import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "robloxstalk",
  aliases: ["rblxstalk", "stalkroblox"],
  description: "Menampilkan informasi profil Roblox",
  category: "Stalker",
  example: "username",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan username Roblox.\nContoh: .robloxstalk lelia_liyaa");
      const username = ctx.query;
      const {
        data
      } = await axios.get(`https://api.deltaku.web.id/api/stalk/roblox?q=${encodeURIComponent(username)}`);
      if (!data.status) return ctx.reply("❌ User tidak ditemukan");
      const d = data.data;
      const basic = d.basic_info;
      const teks = `┏━━━〔 ROBLOX STALKER 〕━━━┓
┃ Username: ${basic.username}
┃ Display Name: ${basic.display_name}
┃ User ID: ${basic.user_id}
┃ Created: ${basic.created_formatted}
┃ Verified Badge: ${basic.has_verified_badge ? "✅" : "❌"}
┃ Banned: ${basic.is_banned ? "🚫" : "✅"}
┃
┃ 📊 Stats:
┃ • Friends: ${d.friends?.count || 0}
┃ • Followers: ${d.followers?.count || 0}
┃ • Following: ${d.following?.count || 0}
┃ • Groups: ${d.groups?.count || 0}
┃ • Badges: ${d.badges?.count || 0}
┃ • Games: ${d.games?.count || 0}
┃
┃ 📝 Bio: ${basic.description || "-"}
┃
┃ 🔗 ${basic.profile_url}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: d.avatar?.image_url
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