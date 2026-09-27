import axios from "axios";
import * as cheerio from "cheerio";
import yts from "yt-search";
import {
  Buffer
} from "buffer";
import {
  contactQuoted,
  simpleQuoted
} from "../../lib/quoted.js";

function convertMs(ms) {
  const m = Math.floor(ms / 6e4);
  const s = (ms % 6e4 / 1e3).toFixed(0);
  return m + ":" + (Number(s) < 10 ? "0" : "") + s;
}
async function spotifyTokenGen(client) {
  return axios.post("https://accounts.spotify.com/api/token", "grant_type=client_credentials", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(client).toString("base64")
    },
    timeout: 3e4
  }).then(r => ({
    status: true,
    token: r.data.access_token
  })).catch(() => ({
    status: false
  }));
}
async function getSpotifyToken() {
  let t1 = await spotifyTokenGen("7bbae52593da45c69a27c853cc22edff:88ae1f7587384f3f83f62a279e7f87af");
  if (t1.status) return t1.token;
  let t2 = await spotifyTokenGen("f97b33bf590840f7ab31e7d372b1a1bf:d700cceafc7c4de483b2ec3850f97a6a");
  if (t2.status) return t2.token;
  return null;
}
export default {
  name: "tiktoksearch",
  aliases: ["ttsearch", "tiktok-search"],
  description: "Mencari video di TikTok",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    if (!ctx.args.length) return ctx.reply("❌ Masukkan kata kunci pencarian");
    try {
      const res = await axios("https://tikwm.com/api/feed/search", {
        method: "POST",
        data: {
          keywords: ctx.query,
          count: 12,
          cursor: 0,
          web: 1,
          hd: 1
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: "current_langange=en;",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });
      const vids = res.data.data.videos;
      if (!vids || !vids.length) return ctx.reply("❌ Video tidak ditemukan");
      const v = vids[Math.floor(Math.random() * vids.length)];
      const teks = `┏━━━〔 TIKTOK SEARCH 〕━━━┓
┃ Judul   : ${v.title || "-"}
┃ Author  : ${v.author.nickname}
┃ Username: @${v.author.unique_id}
┃ Region  : ${v.region}
┃ Likes   : ${v.digg_count || 0}
┃ Comments: ${v.comment_count || 0}
┗━━━━━━━━━━━━━━━━━━━━┛
🎵 Audio → https://tikwm.com${v.music}`;
      await sock.sendMessage(ctx.id, {
        video: {
          url: "https://tikwm.com" + v.play
        },
        caption: teks
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Gagal mengambil video: ${error.message}`);
    }
  }
};