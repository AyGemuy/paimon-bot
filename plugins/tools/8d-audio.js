import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  to8DAudio
} from "../../lib/audio.js";
export default {
  name: "8d",
  aliases: ["8daudio", "8kaudio", "audio8d", "audio8k", "apulsator"],
  description: "Ubah audio atau video menjadi efek 8D Audio Surround Stereo (Gunakan Headset/Earphone).",
  category: "Tools",
  limit: true,
  example: "Reply audio / vn / video dengan .8d",
  execute: async (sock, ctx, msg) => {
    try {
      const isMedia = ctx.mediaType === "video" || ctx.mediaType === "audio" || ctx.quoted?.mediaType === "video" || ctx.quoted?.mediaType === "audio" || (ctx.mimetype || ctx.quoted?.mimetype || "").match(/(video|audio)/);
      if (!isMedia) {
        return ctx.reply("🎧 *Harap reply audio, voice note, atau video yang ingin diubah ke efek 8D Audio!*");
      }
      await ctx.react("⏳");
      const buffer = await ctx.download();
      if (!buffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan.");
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const eightDBuffer = await to8DAudio(buffer);
      await sock.sendMessage(targetJid, {
        audio: eightDBuffer,
        mimetype: "audio/mpeg",
        fileName: `8D_Audio_${Date.now()}.mp3`,
        ptt: false
      }, {
        quoted: quotedMsg
      });
      await ctx.react("🎧");
    } catch (error) {
      console.error("[8D Audio Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengubah audio ke efek 8D: ${error?.message || error}`);
    }
  }
};