import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  enhanceHDVideo
} from "../../lib/video.js";
export default {
  name: "hdvid",
  aliases: ["hdvideo", "vidhd", "enhancevid", "jernihkanvideo"],
  description: "Tingkatkan kualitas & kejernihan video menjadi Ultra HD via filter AI Denoise & Enhancer.",
  category: "Tools",
  limit: true,
  example: "Kirim / reply video dengan .hdvid",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const mediaType = ctx.mediaType || ctx.quoted?.mediaType || "";
      const mimetype = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const isVideo = mediaType === "video" || mimetype.startsWith("video/") || mimetype.includes("mp4") || mimetype.includes("mkv");
      if (!isMedia || !isVideo) {
        return ctx.reply(`🎬 *HD VIDEO ENHANCER (FFMPEG PRO)*\n\n` + `Fitur ini menggunakan algoritma deep denoiser, deband, sharpening, & color correction untuk menjernihkan video.\n\n` + `👉 *Cara Penggunaan:*\n` + `Kirim atau balas video dengan caption: \`${prefix}hdvid\``);
      }
      await ctx.react("⏳");
      await ctx.reply("⏳ _Sedang memproses video ke Ultra HD... Proses ini membutuhkan beberapa saat tergantung durasi video._");
      const rawBuffer = await ctx.download();
      if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh file video dari pesan.");
      }
      const hdBuffer = await enhanceHDVideo(rawBuffer);
      const caption = `✨ *Video HD Enhancement Berhasil!*\n\n` + `• 🔍 *Filter:* \`hqdn3d + nlmeans + deband + unsharp\`\n` + `• 🎞️ *Codec:* \`libx264 (CRF 18 / Veryslow)\`\n` + `• 🎨 *Color Profile:* \`Enhanced Contrast & Saturation\``;
      await sock.sendMessage(targetJid, {
        video: hdBuffer,
        mimetype: "video/mp4",
        caption: caption
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[HDVID Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal meningkatkan kualitas video: ${error?.message || error}`);
    }
  }
};