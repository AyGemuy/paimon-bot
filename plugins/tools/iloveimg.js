import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  upload
} from "../../lib/upload.js";
const API_URL = "https://www.wudysoft.my.id/api/tools/iloveimg";
const MODE_MAP = {
  removebg: "remove-background",
  nobg: "remove-background",
  hapusbg: "remove-background",
  transparent: "remove-background",
  "remove-background": "remove-background",
  upscale: "upscale-image",
  hd: "upscale-image",
  perjelas: "upscale-image",
  "upscale-image": "upscale-image",
  compress: "compress-image",
  kompres: "compress-image",
  kecilkan: "compress-image",
  "compress-image": "compress-image",
  blurface: "blur-face",
  sensor: "blur-face",
  sensorwajah: "blur-face",
  "blur-face": "blur-face",
  convert: "convert-to-jpg",
  tojpg: "convert-to-jpg",
  jpg: "convert-to-jpg",
  "convert-to-jpg": "convert-to-jpg",
  resize: "resize-image",
  "resize-image": "resize-image",
  crop: "crop-image",
  "crop-image": "crop-image"
};
export default {
  name: "iloveimg",
  aliases: ["iloveimage", "imgtools", "removebg", "nobg", "upscale", "hd", "blurface", "compress"],
  description: "Pengolah gambar pintar (Upscale HD, Hapus Background, Kompres, Blur Face) via iLoveIMG API",
  category: "Tools",
  example: "iloveimg upscale / balas gambar dengan .removebg",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx?.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const botName = global.bot?.name || "Wudysoft Bot";
    const chatId = ctx.chat || ctx.id;
    const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || ctx?.quoted?.message?.imageMessage || ctx?.quoted?.msg?.mimetype?.includes("image"));
    const rawCommand = (ctx?.command || "").toLowerCase();
    const rawArg = (ctx?.args?.[0] || ctx?.query || "").trim().toLowerCase();
    const inputMode = MODE_MAP[rawArg] || MODE_MAP[rawCommand] || null;
    if (!isMedia) {
      return ctx.reply(`🖼️ *iLoveIMG PENGOLAH GAMBAR PINTAR*\n\n` + `Kirim atau balas (*reply*) foto dengan perintah berikut:\n\n` + `• *Perjelas (HD):* \`${prefix}iloveimg upscale\`\n` + `• *Hapus Background:* \`${prefix}iloveimg removebg\`\n` + `• *Kompres Ukuran:* \`${prefix}iloveimg compress\`\n` + `• *Sensor Wajah:* \`${prefix}iloveimg blurface\`\n` + `• *Ubah ke JPG:* \`${prefix}iloveimg convert\`\n\n` + `_${global.bot?.footer || "Wudysoft Bot • Multi-Device"}_`);
    }
    if (!inputMode) {
      const bodyText = `╭───『 *PILIH ALAT PENGOLAH* 』\n` + `│ 🖼️ *Media:* Foto Terdeteksi\n` + `│ ⚙️ *Server:* iLoveIMG Cloud Processing\n` + `╰──────────────────────────\n\n` + `Silakan klik tombol *PILIH ALAT* di bawah untuk mulai memproses foto:`;
      const footerText = global.bot?.footer || `${botName} • iLoveIMG Engine`;
      const buttons = [{
        name: "single_select",
        title: "🛠️ PILIH ALAT PENGOLAH",
        sections: [{
          title: "Alat Pemroses Gambar",
          rows: [{
            title: "✂️ Hapus Background",
            description: "Hapus latar belakang menjadi transparan (PNG)",
            id: `${prefix}iloveimg removebg`
          }, {
            title: "✨ Upscale HD (2x)",
            description: "Tingkatkan resolusi & kejernihan foto",
            id: `${prefix}iloveimg upscale`
          }, {
            title: "📦 Kompres Ukuran",
            description: "Perkecil ukuran file tanpa merusak kualitas",
            id: `${prefix}iloveimg compress`
          }, {
            title: "🙈 Sensor Wajah (Blur)",
            description: "Sensor otomatis wajah orang di dalam foto",
            id: `${prefix}iloveimg blurface`
          }, {
            title: "🔄 Konversi ke JPG",
            description: "Ubah format gambar apa saja ke standard JPG",
            id: `${prefix}iloveimg convert`
          }]
        }]
      }];
      const options = {
        title: "🖼️ iLoveIMG Image Tools",
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Tools Gambar`,
            button_title: "🛠️ Buka Menu"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, footerText, buttons, options);
      }
      return ctx.reply(bodyText);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
      let mediaBuffer = null;
      if (typeof downloadFn === "function") {
        mediaBuffer = await downloadFn().catch(() => null);
      }
      if (!mediaBuffer || !Buffer.isBuffer(mediaBuffer)) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh gambar. Pastikan media masih valid!");
      }
      const uploadRes = await upload(mediaBuffer).catch(() => null);
      const mediaUrl = uploadRes?.url || uploadRes?.status?.url || (typeof uploadRes === "string" ? uploadRes : null);
      if (!mediaUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunggah media ke server sementara.");
      }
      const requestPayload = {
        mode: inputMode,
        media: mediaUrl,
        output: "url"
      };
      if (inputMode === "upscale-image") {
        requestPayload.multiplier = "2";
      }
      const {
        data
      } = await axios.post(API_URL, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 9e4
      });
      if (!data || !data.status || !data.result) {
        throw new Error(data?.message || "Gagal memproses gambar melalui server iLoveIMG.");
      }
      const captionText = `✅ *BERHASIL DIPROSES VIA iLoveIMG*\n\n` + `🛠️ *Mode:* \`${data.info?.mode || inputMode}\`\n` + `⚙️ *Tool:* \`${data.info?.tool || "-"}\`\n` + `⚡ *Server:* \`${data.info?.server || "api"}\`\n` + `📁 *Task ID:* \`${data.info?.taskId?.slice(0, 16) || "-"}...\`\n\n` + `_${global.bot?.footer || "Wudysoft Bot • Multi-Device"}_`;
      await sock.sendMessage(chatId, {
        image: {
          url: data.result
        },
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[iLoveIMG Plugin Error]:", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = e.response?.data?.message || e.response?.data?.error || e.message;
      return ctx.reply(`❌ Gagal memproses gambar: ${errMsg}`);
    }
  }
};