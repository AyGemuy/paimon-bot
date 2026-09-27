import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "megadl",
  aliases: ["mega", "meganz", "meganzdl"],
  description: "Download file dari Mega.nz dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const rawArgs = ctx.args || [];
    const url = rawArgs.find(arg => /https?:\/\/(www\.)?mega\.nz\/(file|folder|#)/i.test(arg)) || "";
    if (!url) {
      return ctx.reply(`📦 *MEGA.NZ DOWNLOADER*\n\n` + `Silakan masukkan link file Mega.nz yang valid!\n` + `👉 Contoh: \`${ctx.prefix || "."}mega https://mega.nz/file/DtUQWDzA#Qkn5oqvpHoGuFcsYjUbtQJs49iqXLeRxqlQWkyB3CZk\``);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/mega/v1", {
        url: url,
        output: "base64"
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
      const data = res.data;
      const info = data.info || {};
      if (!data.base64 && !info.downloadUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh file Mega atau link tidak valid.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const fileName = info.fileName || "mega_download_file";
      const mimeType = info.mimeType || "application/octet-stream";
      const fileSize = info.fileSize || `${Math.round((info.fileSizeBytes || 0) / (1024 * 1024))} MB`;
      const bodyText = `📦 *${fileName}*\n\n` + `╭───『 *MEGA.NZ DETAIL* 』\n` + `│ 📄 *File Name:* ${fileName}\n` + `│ 💾 *Size:* ${fileSize}\n` + `│ 🏷️ *MIME Type:* ${mimeType}\n` + `│ 🆔 *File ID:* ${info.fileId || "-"}\n` + `╰──────────────────\n\n` + `_File sedang dikirimkan ke chat dalam bentuk dokumen. Anda juga bisa mengunduh manual melalui tombol di bawah._`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Mega Downloader`;
      const buttons = [];
      if (info.downloadUrl) {
        buttons.push({
          name: "cta_url",
          display_text: "📥 Direct Download Link",
          url: info.downloadUrl
        });
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Unduhan",
          copy_code: info.downloadUrl
        });
      } else {
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Mega",
          copy_code: url
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 MEGA DOWNLOADER 乂",
          subtitle: fileName,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText);
      }
      const filePayload = data.base64 ? {
        document: Buffer.from(data.base64, "base64")
      } : {
        document: {
          url: info.downloadUrl
        }
      };
      await sock.sendMessage(ctx.id, {
        ...filePayload,
        fileName: fileName,
        mimetype: mimeType,
        caption: `✅ *${fileName}* (${fileSize})`
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Mega Download Error: ${e.message}`);
    }
  }
};