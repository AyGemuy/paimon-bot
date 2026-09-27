import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
export default {
  name: "tovn",
  aliases: ["toptt", "voicenote", "tovoice", "ptt"],
  description: "Ubah video atau audio biasa menjadi Voice Note (PTT) WhatsApp.",
  category: "Tools",
  example: "Reply video / audio dengan .tovn",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        return ctx.reply("❌ Harap reply video atau audio yang ingin diubah ke Voice Note (PTT)!");
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      await sendPTT(sock, targetJid, buffer, quotedMsg);
      await ctx.react("✅");
    } catch (error) {
      console.error("[tovn Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengonversi ke Voice Note: ${error?.message || error}`);
    }
  }
};