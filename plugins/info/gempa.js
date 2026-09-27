import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const DEFAULT_BANNER = "https://data.bmkg.go.id/DataMKG/TEWS/20240101000000.mmi.jpg";
const FALLBACK_BANNER = "https://files.catbox.moe/k3h2vd.jpg";
export default {
  name: "gempa",
  aliases: ["infogempa", "bmkg", "gempabmkg"],
  description: "Menampilkan informasi gempa bumi terkini dari BMKG (Auto, Terkini, & Dirasakan)",
  category: "Info",
  example: "gempa / gempa --terkini / gempa --dirasakan",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.text || "").toLowerCase().trim();
      let type = "auto";
      if (rawQuery.includes("--terkini") || rawQuery.includes("terkini") || rawQuery.includes("-t")) {
        type = "terkini";
      } else if (rawQuery.includes("--dirasakan") || rawQuery.includes("dirasakan") || rawQuery.includes("-d")) {
        type = "dirasakan";
      }
      const endpoint = `https://wudysoft.my.id/api/info/gempa?type=${type}`;
      const response = await axios.get(endpoint, {
        timeout: 15e3
      });
      if (!response.data || response.data.status !== "success" || !response.data.data) {
        throw new Error("Gagal mendapatkan data gempa dari server BMKG.");
      }
      const resData = response.data.data;
      let bodyText = "";
      let mediaUrl = FALLBACK_BANNER;
      let titleHeader = "乂 INFORMASI GEMPA BMKG 乂";
      let subtitleHeader = "Badan Meteorologi, Klimatologi, dan Geofisika";
      let listSections = [];
      let mapsUrl = "https://www.google.com/maps";
      if (type === "auto") {
        const item = resData;
        mediaUrl = item.shakemap || FALLBACK_BANNER;
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.coordinates || `${item.lintang},${item.bujur}`)}`;
        titleHeader = "🚨 GEMPA BUMI REALTIME TERBARU";
        subtitleHeader = `${item.wilayah || "Indonesia"}`;
        bodyText = `🚨 *INFORMASI GEMPA BUMI REALTIME (BMKG)*\n\n` + `╭───『 *DETAIL GEMPA* 』\n` + `│ 📅 *Waktu:* ${item.tanggal} | ${item.jam}\n` + `│ 💥 *Kekuatan:* *${item.magnitude} SR*\n` + `│ 🕳️ *Kedalaman:* ${item.kedalaman}\n` + `│ 📍 *Koordinat:* ${item.lintang} - ${item.bujur}\n` + `│ 📌 *Lokasi:* ${item.wilayah}\n` + `│ ⚠️ *Potensi:* ${item.potensi || "-"}\n` + `│ 📢 *Dirasakan:* ${item.dirasakan || "Tidak ada data"}\n` + `╰──────────────────\n\n` + `_Peta guncangan (shakemap) ditampilkan pada gambar di atas._`;
        listSections = [{
          title: "🌐 OPSI KATEGORI GEMPA LAINNYA",
          rows: [{
            title: "📊 15 GEMPA TERKINI (M >= 5.0)",
            id: `${prefix}gempa --terkini`,
            description: "Daftar 15 gempa terbaru berkekuatan di atas 5.0 SR"
          }, {
            title: "🌊 15 GEMPA DIRASAKAN",
            id: `${prefix}gempa --dirasakan`,
            description: "Daftar 15 gempa bumi terbaru yang dirasakan masyarakat"
          }]
        }];
      } else if (type === "terkini") {
        const list = Array.isArray(resData) ? resData : [resData];
        const top = list[0] || {};
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(top.coordinates || `${top.lintang},${top.bujur}`)}`;
        titleHeader = "📊 15 GEMPA TERKINI (M >= 5.0)";
        subtitleHeader = `Gempa Teratas: ${top.magnitude} SR - ${top.wilayah}`;
        bodyText = `📊 *DAFTAR GEMPA TERKINI (M >= 5.0)*\n\n` + `*Gempa Terkini Utama:*\n` + `╭──────────────────\n` + `│ 📅 *Waktu:* ${top.tanggal} | ${top.jam}\n` + `│ 💥 *Magnitudo:* *${top.magnitude} SR*\n` + `│ 🕳️ *Kedalaman:* ${top.kedalaman}\n` + `│ 📍 *Koordinat:* ${top.lintang} - ${top.bujur}\n` + `│ 📌 *Wilayah:* ${top.wilayah}\n` + `│ ⚠️ *Potensi:* ${top.potensi || "Tidak berpotensi tsunami"}\n` + `╰──────────────────\n\n` + `_Gunakan dropdown menu di bawah untuk melihat daftar 14 gempa terkini lainnya._`;
        const otherRows = list.slice(1, 15).map((g, i) => ({
          title: `${i + 2}. M ${g.magnitude} SR - ${g.tanggal}`,
          id: `${prefix}gempa`,
          description: `⏱️ ${g.jam} | 🕳️ ${g.kedalaman} | 📌 ${g.wilayah}`.slice(0, 60)
        }));
        listSections = [{
          title: "📋 14 GEMPA TERKINI LAINNYA",
          rows: otherRows
        }, {
          title: "🔄 GANTI TIPE GEMPA",
          rows: [{
            title: "🚨 Gempa Realtime (Auto)",
            id: `${prefix}gempa`,
            description: "Lihat gempa terbaru + Shakemap"
          }, {
            title: "🌊 Gempa Dirasakan",
            id: `${prefix}gempa --dirasakan`,
            description: "Daftar gempa dirasakan masyarakat"
          }]
        }];
      } else if (type === "dirasakan") {
        const list = Array.isArray(resData) ? resData : [resData];
        const top = list[0] || {};
        mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(top.coordinates || `${top.lintang},${top.bujur}`)}`;
        titleHeader = "🌊 15 GEMPA DIRASAKAN MASYARAKAT";
        subtitleHeader = `Skala: ${top.dirasakan || "-"}`;
        bodyText = `🌊 *DAFTAR GEMPA DIRASAKAN TERBARU*\n\n` + `*Gempa Dirasakan Teratas:*\n` + `╭──────────────────\n` + `│ 📅 *Waktu:* ${top.tanggal} | ${top.jam}\n` + `│ 💥 *Magnitudo:* *${top.magnitude} SR*\n` + `│ 🕳️ *Kedalaman:* ${top.kedalaman}\n` + `│ 📍 *Koordinat:* ${top.lintang} - ${top.bujur}\n` + `│ 📌 *Pusat:* ${top.wilayah}\n` + `│ 📢 *Skala MMI:* ${top.dirasakan || "-"}\n` + `╰──────────────────\n\n` + `_Pilih opsi di bawah untuk melihat riwayat gempa dirasakan lainnya._`;
        const otherRows = list.slice(1, 15).map((g, i) => ({
          title: `${i + 2}. M ${g.magnitude} SR - ${g.tanggal}`,
          id: `${prefix}gempa`,
          description: `📍 ${g.wilayah} | 📢 ${g.dirasakan || "-"}`.slice(0, 60)
        }));
        listSections = [{
          title: "📋 14 GEMPA DIRASAKAN LAINNYA",
          rows: otherRows
        }, {
          title: "🔄 GANTI TIPE GEMPA",
          rows: [{
            title: "🚨 Gempa Realtime (Auto)",
            id: `${prefix}gempa`,
            description: "Lihat gempa terbaru + Shakemap"
          }, {
            title: "📊 Gempa Terkini (M >= 5.0)",
            id: `${prefix}gempa --terkini`,
            description: "Daftar gempa berkekuatan besar"
          }]
        }];
      }
      const footerText = `${global.bot?.name || "WudysoftBot"} • BMKG Indonesia`;
      const buttons = [{
        name: "single_select",
        title: "📑 PILIH KATEGORI / DAFTAR GEMPA",
        sections: listSections
      }, {
        name: "quick_reply",
        display_text: "🔄 Refresh Data",
        id: `${prefix}gempa ${type !== "auto" ? `--${type}` : ""}`.trim()
      }, {
        name: "cta_url",
        display_text: "📍 Lokasi di Google Maps",
        url: mapsUrl
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Info Gempa",
        copy_code: `Gempa BMKG: ${bodyText.replace(/\*/g, "").slice(0, 200)}...`
      }];
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: titleHeader,
        subtitle: subtitleHeader,
        media: mediaUrl,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[Gempa Error]", error);
      await ctx.react("❌");
      ctx.reply(`❌ *Gagal mengambil info gempa:* ${error?.message || error}`);
    }
  }
};