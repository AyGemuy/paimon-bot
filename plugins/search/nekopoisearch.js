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
  name: "nekopoisearch",
  aliases: ["nekopoi-search", "nekopoi"],
  description: "Mencari konten di Nekopoi",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    if (!ctx.args.length) return ctx.reply("❌ Masukkan query pencarian!\nContoh: .nekopoisearch Shoujo Ramune");
    try {
      const {
        data
      } = await axios.get(`https://api.nekolabs.web.id/discovery/nekopoi/v1/search?q=${encodeURIComponent(ctx.query)}`);
      if (!data.result || !data.result.length) return ctx.reply("❌ Hasil tidak ditemukan!");
      const first = data.result[0];
      await sock.sendMessage(ctx.id, {
        image: {
          url: first.cover
        },
        caption: `┏━━━〔 NEKOPOI SEARCH 〕━━━┓
┃ Title: ${first.title}
┃ Type: ${first.type}
┗━━━━━━━━━━━━━━━━━━━━┛
🔗 URL: ${first.url}`
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  }
};