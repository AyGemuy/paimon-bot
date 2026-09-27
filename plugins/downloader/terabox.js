import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "teraboxdl",
  aliases: ["terabox", "tb", "tbdl"],
  description: "Download file/video dari TeraBox dengan detail & CTA",
  category: "Downloader",
  execute: async (sock, ctx, msg) => {
    const url = (ctx.args[0] || ctx.query || "").trim();
    if (!url) {
      return ctx.reply(`📦 *TERABOX DOWNLOADER*\n\n` + `Silakan masukkan link TeraBox yang valid!\n` + `👉 Contoh: \`${ctx.prefix || "."}terabox https://www.terabox.app/wap/share/filelist?surl=GJACgid49fFsWkxtfVH3cA\``);
    }
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/download/terabox/v21", {
        url: url
      });
      const data = res.data;
      if (!data.status || !data.response || data.response.length === 0) {
        if (typeof ctx.react === "function") await ctx.react("❌");
        return ctx.reply(`❌ Gagal: ${data.message || "File tidak ditemukan atau link kadaluarsa."}`);
      }
      const files = data.response;
      const topFile = files[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const listSections = [];
      if (files.length > 1) {
        const fileRows = files.map((f, i) => ({
          title: `${i + 1}. ${f.file_name.slice(0, 24)}`,
          id: `${prefix}terabox ${url}`,
          description: `📦 Size: ${f.file_size || "-"}`
        }));
        listSections.push({
          title: `📁 DAFTAR FILE TERABOX (${files.length})`,
          rows: fileRows
        });
      }
      const bodyText = `📦 *${topFile.file_name}*\n\n` + `╭───『 *TERABOX DETAIL* 』\n` + `│ 📄 *File Name:* ${topFile.file_name}\n` + `│ 💾 *Size:* ${topFile.file_size || "-"}\n` + `│ 📁 *Total File:* ${files.length} File\n` + `╰──────────────────\n\n` + `_File sedang dikirimkan ke chat. Anda juga bisa mengunduh atau menonton langsung lewat tombol di bawah._`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • TeraBox Downloader`;
      const buttons = [];
      if (listSections.length > 0) {
        buttons.push({
          name: "single_select",
          title: "📂 PILIH DAFTAR FILE",
          sections: listSections
        });
      }
      if (topFile.download_url) {
        buttons.push({
          name: "cta_url",
          display_text: "📥 Direct Download Link",
          url: topFile.download_url
        });
      }
      if (topFile.fast_stream_url) {
        buttons.push({
          name: "cta_url",
          display_text: "▶️ Fast Stream (M3U8)",
          url: topFile.fast_stream_url
        });
      }
      if (topFile.download_url) {
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Unduhan",
          copy_code: topFile.download_url
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 TERABOX DOWNLOADER 乂",
          subtitle: topFile.file_name,
          media: topFile.thumbnail || null,
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText);
      }
      for (const file of files) {
        if (!file.download_url) continue;
        await sock.sendMessage(ctx.id, {
          document: {
            url: file.download_url
          },
          fileName: file.file_name.includes(".") ? file.file_name : `${file.file_name}.mp4`,
          mimetype: "video/mp4",
          caption: `✅ *${file.file_name}* (${file.file_size || "-"})`
        }, {
          quoted: quotedMsg
        });
      }
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (e) {
      if (typeof ctx.react === "function") await ctx.react("❌");
      ctx.reply(`❌ TeraBox Download Error: ${e.message}`);
    }
  }
};