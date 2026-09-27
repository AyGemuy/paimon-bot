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
  name: "subdomainfinder",
  aliases: ["subdomain", "findsubdomain"],
  description: "Cari subdomain via crt.sh",
  category: "Tools",
  example: "domain.com",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan domain.\nContoh: .subdomainfinder example.com");
      const res = await axios.get(`https://crt.sh/?q=%25.${ctx.query.toLowerCase()}&output=json`);
      if (!Array.isArray(res.data)) return ctx.reply("❌ Tidak ada hasil.");
      let domain = ctx.query.toLowerCase();
      let subdomains = [...new Set(res.data.flatMap(v => (v.name_value || "").split("\n")).map(v => v.replace(/^\*\./, "").trim()).filter(v => v.endsWith(domain)))];
      if (!subdomains.length) return ctx.reply("❌ Subdomain tidak ditemukan.");
      let limited = subdomains.slice(0, 30);
      const teks = `┏━━━〔 SUBDOMAIN FINDER 〕━━━┓
┃ 🌐 Domain: ${domain}
┃ 📊 Total: ${subdomains.length}
┃ 📌 Ditampilkan: ${limited.length}
┃
${limited.map((v, i) => `┃ ${i + 1}. ${v}`).join("\n")}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
      ctx.reply(teks);
    } catch (error) {
      ctx.reply(`❌ Gagal mengambil data: ${error.message}`);
    }
  }
};