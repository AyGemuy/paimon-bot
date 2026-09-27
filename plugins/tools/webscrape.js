import axios from "axios";
import {
  exec
} from "child_process";
import fs from "fs";
import path from "path";
import {
  promisify
} from "util";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = promisify(exec);
export default {
  name: "webscrape",
  aliases: ["scrapeweb", "webscraping"],
  description: "Scrape konten dari URL",
  category: "Tools",
  example: "url [--text]",
  execute: async (sock, ctx, msg) => {
    try {
      const args = ctx.query.trim().split(" ");
      const url = args.find(v => v.startsWith("http"));
      if (!url) return ctx.reply("❌ URL tidak ditemukan.");
      const api = new URL("https://api.api-ninjas.com/v1/webscraper");
      api.searchParams.append("url", url);
      if (args.includes("--text") || args.includes("-t")) {
        api.searchParams.append("text_only", "true");
      }
      await ctx.reply("🕵️ Lagi ngintip web...");
      const res = await axios.get(api.toString(), {
        headers: {
          "X-Api-Key": "S8bcSHT0z15lVc1OGljv9ssbcouQE163Io6fkCDu"
        }
      });
      const data = res.data;
      const content = data.data?.substring(0, 3500) || "😕 Tidak ada konten";
      const note = content.length > 3500 ? "\n\n📌 *Kepotong ya, kebanyakan konten*" : "";
      await sock.sendMessage(ctx.id, {
        text: `┏━━━〔 WEB SCRAPE 〕━━━┓\n┃\n${content}${note}\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`💥 Error: ${error.message}`);
    }
  }
};