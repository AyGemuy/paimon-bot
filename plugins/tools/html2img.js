import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "html2img",
  aliases: ["htmltoimg", "renderhtml", "htmlrender"],
  description: "Render kode HTML atau dokumen .html menjadi gambar (Pilihan versi v1 - v26 dengan custom payload)",
  category: "Tools",
  limit: true,
  example: "html2img <h1>Halo Dunia</h1> [--v 24] [--width 800] [--height 600]",
  execute: async (sock, ctx, msg) => {
    try {
      let htmlCode = "";
      let flagText = ctx.args?.join(" ") || "";
      const targetMsg = ctx.quoted?.isMedia ? ctx.quoted : ctx.isMedia ? ctx : null;
      const mime = targetMsg?.mimetype || targetMsg?.msg?.documentMessage?.mimetype || "";
      const fileName = targetMsg?.fileName || targetMsg?.msg?.documentMessage?.fileName || "";
      const isHtmlDoc = mime.includes("text/html") || mime.includes("text/plain") || fileName.endsWith(".html") || fileName.endsWith(".htm");
      if (targetMsg && isHtmlDoc) {
        await ctx.react("⏳");
        let buffer;
        if (typeof targetMsg.download === "function") {
          buffer = await targetMsg.download();
        } else if (typeof ctx.download === "function") {
          buffer = await ctx.download();
        }
        if (buffer) {
          htmlCode = buffer.toString("utf-8");
        }
      }
      if (!htmlCode) {
        let text = ctx.quoted?.text || ctx.args?.join(" ") || "";
        if (!text && ctx.text) {
          const raw = ctx.text.trim();
          const firstWord = raw.split(/\s+/)[0].toLowerCase();
          if (firstWord.endsWith("html2img") || firstWord.endsWith("htmltoimg") || firstWord.endsWith("renderhtml") || firstWord.endsWith("htmlrender")) {
            text = raw.slice(firstWord.length).trim();
          }
        }
        flagText = text;
        htmlCode = text;
      }
      if (!htmlCode && !flagText) {
        return ctx.reply(`🌐 *HTML TO IMAGE RENDERER*\n\n` + `Masukkan kode HTML atau *kirim/reply file dokumen .html* yang ingin di-render menjadi gambar!\n\n` + `👉 *Contoh Penggunaan:*\n` + `• \`${ctx.prefix || "."}html2img <h1 style="color:red; text-align:center;">Halo Dunia</h1>\`\n` + `• Kirim/Reply file \`.html\` dengan caption \`${ctx.prefix || "."}html2img\`\n` + `• Balas (reply) pesan teks HTML dengan \`${ctx.prefix || "."}html2img\`\n\n` + `⚙️ *Pilihan Versi Engine (v1 - v26):*\n` + `• \`--v 24\` (Default: v24)\n\n` + `🛠️ *Custom Payload Override:*\n` + `• \`${ctx.prefix || "."}html2img <h1>Test</h1> --v 24 --width 800 --height 600\``);
      }
      await ctx.react("⏳");
      let version = 24;
      const versionMatch = flagText.match(/--v(?:ersion)?\s+(\d+)/i);
      if (versionMatch) {
        const parsedVersion = parseInt(versionMatch[1]);
        if (parsedVersion >= 1 && parsedVersion <= 26) {
          version = parsedVersion;
        }
        flagText = flagText.replace(versionMatch[0], "").trim();
      }
      const restPayload = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s<]+)/g;
      let match;
      while ((match = flagRegex.exec(flagText)) !== null) {
        const key = match[1];
        const value = match[2];
        restPayload[key] = isNaN(value) ? value : Number(value);
      }
      if (!isHtmlDoc || !targetMsg) {
        htmlCode = flagText.replace(/--[a-zA-Z0-9_]+\s+[^\s<]+/g, "").trim();
      }
      if (!htmlCode) {
        await ctx.react("❌");
        return ctx.reply("❌ Kode HTML tidak boleh kosong!");
      }
      const hasHtmlTag = /<[a-z][\s\S]*>/i.test(htmlCode);
      if (!hasHtmlTag) {
        await ctx.react("❌");
        return ctx.reply("❌ Format tidak valid! Masukkan kode HTML yang memiliki tag (contoh: `<h1>Teks</h1>`, `<div>...</div>`, dsb).");
      }
      const body = {
        html: htmlCode,
        ...restPayload
      };
      const {
        data
      } = await axios.post(`https://wudysoft.my.id/api/tools/html2img/v${version}`, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const imageUrl = data?.url || data?.result?.url || (typeof data?.result === "string" ? data.result : null) || data?.image;
      if (!imageUrl || typeof imageUrl !== "string") {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal merender HTML: ${data?.message || "Pastikan struktur tag dan sintaks HTML valid."}`);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let caption = `🌐 *HTML Render Berhasil*\n\n`;
      caption += `⚙️ *Engine Version:* \`v${version}\`\n`;
      caption += `📝 *Panjang Kode:* \`${htmlCode.length} karakter\`\n`;
      const overrideKeys = Object.keys(restPayload);
      if (overrideKeys.length > 0) {
        caption += `🛠️ *Overrides:* ${overrideKeys.map(k => `${k}: ${restPayload[k]}`).join(", ")}\n`;
      }
      await sock.sendMessage(ctx.id, {
        image: {
          url: imageUrl
        },
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ HTML2Img Error: ${errMsg}`);
    }
  }
};