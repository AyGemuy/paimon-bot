import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  upload
} from "../../lib/upload.js";
const API_URL = "https://www.wudysoft.my.id/api/tools/zamzar";
export default {
  name: "zamzar",
  aliases: ["convertfile", "konversi", "tofile", "fileconvert", "zamzarconvert"],
  description: "Konversi berkas apa saja secara otomatis via Zamzar Cloud API (Mendukung Reply Media & URL Langsung)",
  category: "Tools",
  example: "zamzar pdf / balas berkas / zamzar pdf https://site.com/file.docx",
  execute: async (sock, ctx, msg) => {
    const prefix = ctx?.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const botName = global.bot?.name || "Wudysoft Bot";
    const chatId = ctx.chat || ctx.id;
    const rawText = ctx?.text || ctx?.body || (ctx?.args || []).join(" ");
    const isFromButton = rawText.includes("|");
    let targetExt = null;
    let mediaUrl = null;
    let sourceExt = "";
    if (isFromButton) {
      const parts = rawText.replace(new RegExp(`^${prefix}?zamzar\\s*`, "i"), "").split("|").map(s => s.trim());
      targetExt = parts[0]?.toLowerCase().replace(/[^a-z0-9]/g, "");
      mediaUrl = parts[1] || null;
      sourceExt = parts[2]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
    } else {
      const args = ctx?.args || [];
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const foundUrl = rawText.match(urlRegex)?.[0] || null;
      if (foundUrl) {
        mediaUrl = foundUrl;
        const remainingArgs = args.filter(a => !a.match(urlRegex) && a.toLowerCase() !== "to").map(a => a.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
        targetExt = remainingArgs[0] || null;
        try {
          const parsedUrlPath = new URL(foundUrl).pathname;
          if (parsedUrlPath.includes(".")) {
            sourceExt = parsedUrlPath.split(".").pop().toLowerCase().trim();
          }
        } catch {}
      } else {
        const rawArgs = args.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
        targetExt = rawArgs[0] === "to" ? rawArgs[1] : rawArgs[0] || null;
      }
    }
    const targetObj = ctx?.quoted?.isMedia ? ctx.quoted : ctx;
    const isMedia = Boolean(ctx?.isMedia || ctx?.quoted?.isMedia || msg?.message?.imageMessage || msg?.message?.documentMessage || msg?.message?.audioMessage || msg?.message?.videoMessage || ctx?.quoted?.message?.imageMessage || ctx?.quoted?.message?.documentMessage || ctx?.quoted?.message?.audioMessage || ctx?.quoted?.message?.videoMessage);
    if (!mediaUrl && !isMedia) {
      return ctx.reply(`📁 *ZAMZAR CLOUD CONVERTER (FULL AUTO)*\n\n` + `*Cara Penggunaan:*\n` + `1️⃣ *Balas/Kirim Berkas:* Balas berkas dengan \`${prefix}zamzar pdf\` atau \`${prefix}zamzar\`\n` + `2️⃣ *Input URL Langsung:*\n` + `   • \`${prefix}zamzar pdf https://site.com/file.docx\`\n` + `   • \`${prefix}zamzar https://site.com/file.png\` _(Pilih target via menu)_\n\n` + `_${global.bot?.footer || "Wudysoft Bot • Multi-Device"}_`);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      if (!mediaUrl) {
        const rawFileName = targetObj?.fileName || targetObj?.msg?.fileName || "";
        if (rawFileName.includes(".")) {
          sourceExt = rawFileName.split(".").pop().toLowerCase().trim();
        }
        if (!sourceExt) {
          const mime = (targetObj?.mimetype || targetObj?.msg?.mimetype || "").toLowerCase();
          if (mime.includes("/")) {
            sourceExt = mime.split("/")[1].split(";")[0].replace("jpeg", "jpg").trim();
          }
        }
        if (!sourceExt) sourceExt = "jpg";
        const downloadFn = typeof ctx?.download === "function" ? ctx.download : ctx?.quoted?.download;
        let fileBuffer = null;
        if (typeof downloadFn === "function") {
          fileBuffer = await downloadFn().catch(() => null);
        }
        if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh berkas. Pastikan file masih dapat dibuka!");
        }
        const uploadRes = await upload(fileBuffer).catch(() => null);
        mediaUrl = uploadRes?.url || uploadRes?.status?.url || (typeof uploadRes === "string" ? uploadRes : null);
        if (!mediaUrl) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunggah berkas ke server sementara.");
        }
      }
      if (!targetExt) {
        const probeRes = await axios.post(API_URL, {
          media: mediaUrl,
          source: sourceExt || "",
          target: ""
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0"
          }
        }).catch(err => err.response?.data || {});
        const availableTargets = probeRes?.targets || probeRes?.data?.targets || [];
        if (!availableTargets || availableTargets.length === 0) {
          if (typeof ctx.react === "function") await ctx.react("❌");
          return ctx.reply(`❌ Format .${(sourceExt || "file").toUpperCase()} tidak didukung untuk dikonversi oleh Zamzar.`);
        }
        const bodyText = `╭───『 *PILIH FORMAT TUJUAN* 』\n` + `│ 📁 *Format Asal:* \`.${(sourceExt || "UNKNOWN").toUpperCase()}\`\n` + `│ 📊 *Format Tersedia:* ${availableTargets.length} Opsi\n` + `│ ⚙️ *Engine:* Zamzar Live API\n` + `╰──────────────────────────\n\n` + `Pilih format tujuan di bawah untuk langsung mengonversi:`;
        const footerText = global.bot?.footer || `${botName} • Zamzar Live Converter`;
        const buttons = [{
          name: "single_select",
          title: "📂 PILIH FORMAT TUJUAN",
          sections: [{
            title: `Pilihan Konversi dari .${(sourceExt || "FILE").toUpperCase()}`,
            rows: availableTargets.slice(0, 20).map(tgt => ({
              title: `.${tgt.toUpperCase()}`,
              description: `Konversi langsung ke format ${tgt.toUpperCase()}`,
              id: `${prefix}zamzar ${tgt}|${mediaUrl}|${sourceExt}`
            }))
          }]
        }];
        const options = {
          title: "🔄 Zamzar File Converter",
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Format Live`,
              button_title: "📂 Pilih Format"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, footerText, buttons, options);
        }
        return ctx.reply(bodyText);
      }
      const {
        data
      } = await axios.post(API_URL, {
        media: mediaUrl,
        source: sourceExt || "",
        target: targetExt
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 18e4
      });
      if (!data || !data.status || !data.result) {
        const supportedTargets = data?.targets ? `\n\n*Format yang didukung:* ${data.targets.join(", ")}` : "";
        throw new Error((data?.result || "Gagal mengonversi berkas melalui server Zamzar.") + supportedTargets);
      }
      const downloadResultUrl = data.result;
      const resFile = await axios.get(downloadResultUrl, {
        responseType: "arraybuffer",
        timeout: 9e4
      });
      const convertedBuffer = Buffer.from(resFile.data);
      const outputFileName = `zamzar_${Date.now()}.${targetExt}`;
      const captionText = `✅ *BERHASIL DIKONVERSI VIA ZAMZAR*\n\n` + `├─ 🏷️ *Dari:* \`.${(sourceExt || "AUTO").toUpperCase()}\`\n` + `├─ 🎯 *Ke:* \`.${targetExt.toUpperCase()}\`\n` + `├─ 📁 *Nama File:* \`${outputFileName}\`\n` + `└─ 📊 *Ukuran:* \`${(convertedBuffer.length / 1024).toFixed(2)} KB\`\n\n` + `_${global.bot?.footer || "Wudysoft Bot • Multi-Device"}_`;
      if (["jpg", "jpeg", "png", "webp"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          image: convertedBuffer,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      } else if (["mp3", "wav", "m4a", "ogg", "aac", "flac"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          audio: convertedBuffer,
          mimetype: `audio/${targetExt}`,
          fileName: outputFileName
        }, {
          quoted: quotedMsg
        });
      } else if (["mp4", "3gp", "avi", "mkv", "mov", "webm"].includes(targetExt)) {
        await sock.sendMessage(chatId, {
          video: convertedBuffer,
          caption: captionText,
          mimetype: `video/${targetExt}`
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(chatId, {
          document: convertedBuffer,
          mimetype: "application/octet-stream",
          fileName: outputFileName,
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      console.error("[Zamzar Error]:", e);
      if (typeof ctx.react === "function") await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.result || e.message;
      return ctx.reply(`❌ *Gagal mengonversi berkas:*\n${errMsg}`);
    }
  }
};