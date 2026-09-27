import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  toMP3
} from "../../lib/audio.js";
export default {
  name: "tomp3",
  aliases: ["toaudio", "getaudio", "mp3"],
  description: "Ubah video atau voice note (PTT) menjadi file audio MP3 murni.",
  category: "Tools",
  example: "Reply video / vn / audio dengan .tomp3",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        return ctx.reply("❌ Harap reply video atau voice note yang ingin diubah ke format MP3!");
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const mp3Buffer = await toMP3(buffer);
      await sock.sendMessage(targetJid, {
        audio: mp3Buffer,
        mimetype: "audio/mpeg",
        fileName: `audio_${Date.now()}.mp3`,
        ptt: false
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[tomp3 Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengonversi ke MP3: ${error?.message || error}`);
    }
  }
};