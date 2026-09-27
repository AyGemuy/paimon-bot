import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "sfiledl",
  aliases: ["sfile", "sfilemobi", "sfiled"],
  description: "Download file dari Sfile.co / Sfile.mobi dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    if (!url) {
      return ctx.reply(`📁 *SFILE DOWNLOADER*\n\n` + `Silakan masukkan link file dari Sfile!\n` + `👉 Contoh: \`${ctx.prefix || "."}sfile https://sfile.co/mG4XRoq3WLn\``);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/sfile/v1", {
        url: url
      });
      const data = res.data;
      const downloadUrl = data.result || data.direct || data.cdnDirect;
      if (!downloadUrl) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan link unduhan atau file tidak ditemukan.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const trendingRows = (data.trending || []).slice(0, 10).map((item, i) => ({
        title: `${i + 1}. ${item.name.slice(0, 24)}`,
        id: `${prefix}sfile ${item.link}`,
        description: `🔗 ${item.name}`.slice(0, 60)
      }));
      const listSections = [];
      if (trendingRows.length > 0) {
        listSections.push({
          title: "🔥 SFILE TRENDING FILES",
          rows: trendingRows
        });
      }
      const bodyText = `📁 *${data.name || "Sfile Document"}*\n\n` + `╭───『 *FILE DETAILS* 』\n` + `│ 👤 *Uploader:* ${data.user || "-"}\n` + `│ 📦 *Size:* ${data.size || "-"}\n` + `│ 📅 *Uploaded:* ${data.date || "-"}\n` + `│ 📥 *Total Download:* ${data.dlCount || "0"}x\n` + `│ 🏷️ *MIME Type:* ${data.mime || "application/octet-stream"}\n` + `╰──────────────────\n\n` + `_File sedang dikirimkan ke chat, atau Anda dapat menggunakan tombol CTA di bawah untuk mengunduh manual._`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Sfile Downloader`;
      const buttons = [];
      if (listSections.length > 0) {
        buttons.push({
          name: "single_select",
          title: "🔥 PILIH TRENDING FILE",
          sections: listSections
        });
      }
      buttons.push({
        name: "cta_url",
        display_text: "🌐 Direct Download Link",
        url: downloadUrl
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Link Unduhan",
        copy_code: downloadUrl
      });
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 SFILE DOWNLOADER 乂",
          subtitle: data.name,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText);
      }
      await sock.sendMessage(ctx.id, {
        document: {
          url: downloadUrl
        },
        fileName: data.name || "download_file",
        mimetype: data.mime || "application/octet-stream",
        caption: `✅ *${data.name}* (${data.size || "-"})`
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ Sfile Download Error: ${e.message}`);
    }
  }
};