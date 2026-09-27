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
  name: "komikusearch",
  aliases: ["komiku", "mangasearch"],
  description: "Mencari manga di Komiku",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    if (!ctx.args.length) return ctx.reply("❌ Masukkan judul manga");
    try {
      if (ctx.args[0].toLowerCase() === "detail") {
        const q = ctx.args.slice(1).join(" ").trim();
        const url = q.startsWith("http") ? q : "https://komiku.org/manga/" + q.replace(/\s+/g, "-").toLowerCase() + "/";
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);
        const title = $("#Judul h1 span").text().trim();
        const indo = $("#Judul .j2").text().trim();
        const desk = $(".desc").text().trim().slice(0, 600);
        const img = $(".ims img").attr("src");
        const info = {};
        $(".inftable tr").each((i, e) => {
          const k = $(e).find("td").eq(0).text().trim();
          const v = $(e).find("td").eq(1).text().trim();
          if (k) info[k] = v;
        });
        const genre = $(".genre span").map((i, e) => $(e).text()).get().join(", ");
        const teks = `┏━━━〔 DETAIL MANGA 〕━━━┓
┃ Judul : ${title}
┃ Indo  : ${indo}
┃ Jenis : ${info["Jenis Komik"] || "-"}
┃ Konsep: ${info["Konsep Cerita"] || "-"}
┃ Author: ${info["Pengarang"] || "-"}
┃ Status: ${info["Status"] || "-"}
┃ Umur  : ${info["Umur Pembaca"] || "-"}
┃ Genre : ${genre}
┗━━━━━━━━━━━━━━━━━━━━┛

Sinopsis:
${desk}...

🔗 Link → ${url}`;
        await sock.sendMessage(ctx.id, {
          image: {
            url: img
          },
          caption: teks
        }, {
          quoted: simpleQuoted(ctx)
        });
      } else {
        const res = await axios.get("https://api.komiku.id/", {
          params: {
            post_type: "manga",
            s: ctx.query
          }
        });
        const $ = cheerio.load(res.data);
        const el = $(".bge").first();
        if (!el.length) return ctx.reply("❌ Manga tidak ditemukan");
        const title = el.find("h3").text().trim();
        const link = "https://komiku.org" + el.find("a").attr("href");
        const img = el.find("img").attr("src");
        const type = el.find(".tpe1_inf").text().trim();
        const update = el.find(".kan p").text().trim();
        const awal = el.find(".new1").eq(0).text().replace(/\s+/g, " ").trim();
        const latest = el.find(".new1").eq(1).text().replace(/\s+/g, " ").trim();
        const teks = `┏━━━〔 KOMIKU SEARCH 〕━━━┓
┃ Judul   : ${title}
┃ Tipe    : ${type}
┃ Update  : ${update}
┃ Awal    : ${awal}
┃ Terbaru : ${latest}
┗━━━━━━━━━━━━━━━━━━━━┛
🔍 Detail → .komikusearch detail ${link}`;
        await sock.sendMessage(ctx.id, {
          image: {
            url: img
          },
          caption: teks
        }, {
          quoted: simpleQuoted(ctx)
        });
      }
    } catch (error) {
      ctx.reply(`❌ Gagal mengambil data: ${error.message}`);
    }
  }
};