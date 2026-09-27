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
  name: "countryinfo",
  aliases: ["country", "negara"],
  description: "Menampilkan informasi negara",
  category: "Tools",
  example: "Indonesia",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan nama negara.\nContoh: .countryinfo Indonesia");
      const res = await axios.get("https://api.siputzx.my.id/api/tools/countryInfo", {
        params: {
          name: ctx.query
        }
      });
      const data = res.data;
      if (!data || data.status !== true) return ctx.reply("❌ Negara tidak ditemukan.");
      let c = data.data;
      let neighbors = c.neighbors?.map(v => `• ${v.name}`).join("\n") || "-";
      await sock.sendMessage(ctx.id, {
        image: {
          url: c.flag
        },
        caption: `┏━━━〔 COUNTRY INFO 〕━━━┓
┃ 🏳️ Nama: ${c.name}
┃ 🏛️ Ibu Kota: ${c.capital}
┃ 🌏 Benua: ${c.continent.name} ${c.continent.emoji}
┃ 📞 Kode Telepon: ${c.phoneCode}
┃ 💱 Mata Uang: ${c.currency}
┃ 🚗 Jalur Mengemudi: ${c.drivingSide}
┃ 🗣️ Bahasa: ${c.languages.native.join(", ")}
┃ 📐 Luas: ${c.area.squareKilometers.toLocaleString()} km²
┃ 🌐 Domain: ${c.internetTLD}
┃ 🏛️ Bentuk Negara: ${c.constitutionalForm}
┃ ⭐ Terkenal: ${c.famousFor}
┃
┃ 🧭 Tetangga:
${neighbors}
┃
┃ 🗺️ ${c.googleMapsLink}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  }
};