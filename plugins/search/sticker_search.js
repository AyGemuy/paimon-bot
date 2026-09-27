import axios from "axios";
import {
  writeExif,
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  stickerPack
} from "../../lib/pack.js";
export default {
  name: "sticker-search",
  aliases: ["stickersearch", "ssearch"],
  description: "Cari & unduh sticker pack dari Combot langsung jadi WhatsApp Sticker Pack",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    const query = ctx.query || ctx.args?.join(" ")?.trim();
    if (!query) {
      return ctx.reply("❌ Masukkan kata kunci pencarian sticker!\nContoh: .stickersearch cat");
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://api.siputzx.my.id/api/sticker/combot-search", {
        q: query,
        page: 1
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      const data = res.data?.data?.results;
      if (!data || !data.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Sticker tidak ditemukan untuk kata kunci: *"${query}"*`);
      }
      const pack = data[Math.floor(Math.random() * data.length)];
      const stickerUrls = pack.sticker_urls || [];
      if (!stickerUrls.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Pack stiker ditemukan tetapi tidak ada item stiker di dalamnya.");
      }
      const botName = global.bot?.name || "WudysoftBot";
      const authorName = global.bot?.author?.name || "Combot Search";
      const packTitle = pack.title || `${query.toUpperCase()} Pack`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const downloadedStickers = [];
      for (let i = 0; i < stickerUrls.length; i++) {
        try {
          const r = await axios.get(stickerUrls[i], {
            responseType: "arraybuffer",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            },
            timeout: 2e4
          });
          const rawBuffer = Buffer.from(r.data);
          const exif = {
            packname: packTitle,
            author: authorName,
            categories: ["✨"]
          };
          const webpBuffer = await writeExif(rawBuffer, exif).catch(async () => {
            return await writeExifVid(rawBuffer, exif) || await writeExifImg(rawBuffer, exif) || rawBuffer;
          });
          downloadedStickers.push({
            buffer: webpBuffer,
            emoji: "✨"
          });
        } catch (err) {
          console.error(`[StickerSearch Item Error]:`, err?.message || err);
        }
      }
      if (!downloadedStickers.length) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh gambar stiker dari pack tersebut.");
      }
      await stickerPack(sock, ctx.id, downloadedStickers, {
        name: packTitle,
        publisher: authorName,
        description: `Combot Sticker Search: ${query}`,
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[StickerSearch Error]:", error?.message || error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil sticker: ${error.message}`);
    }
  }
};