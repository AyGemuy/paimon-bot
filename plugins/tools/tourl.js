import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "tourl",
  aliases: ["upload", "tolink", "phototourl", "uploadlink"],
  description: "Upload media ke link CDN permanen menggunakan lib upload (pone.rs)",
  category: "Tools",
  example: "reply gambar/video/stiker/audio dengan .tourl",
  limit: true,
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!isMedia) {
        return ctx.reply("❌ Harap reply atau kirim media (gambar, video, audio, atau stiker) yang ingin diunggah!");
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan WhatsApp.");
      }
      const res = await upload(buffer);
      if (!res?.status || !res?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Upload gagal: ${res?.message || "Terjadi kesalahan saat mengunggah."}`);
      }
      await ctx.react("✅");
      const botName = global.bot?.name || "WudysoftBot";
      const responseText = `╭─〔 *UPLOAD SUCCESS* 〕─⬿\n` + `│\n` + `│ 🔗 *Direct URL* : ${res.url}\n` + `│ 📦 *Ukuran File*: ${res.formattedSize || "N/A"}\n` + `│ 📑 *MIME Type*  : ${res.mime}\n` + `│ 🏷️ *Ekstensi*   : .${res.ext.toUpperCase()}\n` + `│ 📁 *Filename*   : ${res.filename}\n` + `│ 🌐 *Server*     : pone.rs CDN\n` + `│\n` + `╰─〔 ${botName} 〕─⬿`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin Direct URL",
        copy_code: res.url
      }, {
        name: "cta_url",
        display_text: "🌐 Buka Link di Browser",
        url: res.url
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(responseText, `${botName} • Media CDN Uploader`, buttons, {
          title: "乂 MEDIA TO LINK 乂",
          subtitle: `File: ${res.filename}`,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: responseText
        }, {
          quoted: quotedMsg
        });
      }
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};