import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "setprofile",
  aliases: ["setbotname", "setbio", "setppbot", "delppbot"],
  description: "Ubah Nama, Bio/Status, Foto Profil, atau Hapus Foto Profil Bot",
  category: "Owner",
  example: ".setbotname Bot Baru | .setbio Available 24/7 | .setppbot (reply foto)",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const cmd = ctx.command?.toLowerCase();
      const text = (ctx.query || ctx.args?.join(" ") || "").trim();
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (cmd === "setbotname") {
        if (!text) return ctx.reply("❌ Masukkan nama baru untuk bot.\nContoh: `.setbotname Wudysoft v2`");
        await sock.updateProfileName(text);
        await ctx.react("✅");
        return ctx.reply(`✅ *Nama Bot Berhasil Diubah:*\n🏷️ *Nama Baru:* ${text}`);
      }
      if (cmd === "setbio") {
        if (!text) return ctx.reply("❌ Masukkan bio/status baru untuk bot.\nContoh: `.setbio Bot Aktif 24 Jam`");
        await sock.updateProfileStatus(text);
        await ctx.react("✅");
        return ctx.reply(`✅ *Bio / Status Bot Berhasil Diubah:*\n📝 *Status:* ${text}`);
      }
      if (cmd === "setppbot") {
        const target = ctx.quoted || ctx;
        if (!target.isMedia && !/image/i.test(target.mimetype || "")) {
          return ctx.reply("❌ Balas (reply) gambar atau kirim gambar dengan caption `.setppbot`");
        }
        const buffer = await target.download();
        if (!buffer) return ctx.reply("❌ Gagal mengunduh gambar.");
        await sock.updateProfilePicture(sock.user.id, buffer);
        await ctx.react("✅");
        return ctx.reply("✅ *Foto profil bot berhasil diperbarui!*");
      }
      if (cmd === "delppbot") {
        await sock.removeProfilePicture(sock.user.id);
        await ctx.react("✅");
        return ctx.reply("✅ *Foto profil bot berhasil dihapus!*");
      }
      return ctx.reply(`👤 *PENGATURAN PROFIL BOT*\n\n` + `• *Ganti Nama:* \`${ctx.prefix}setbotname <Nama>\`\n` + `• *Ganti Bio/About:* \`${ctx.prefix}setbio <Teks>\`\n` + `• *Ganti Foto Profil:* Reply foto dengan \`${ctx.prefix}setppbot\`\n` + `• *Hapus Foto Profil:* \`${ctx.prefix}delppbot\``);
    } catch (e) {
      console.error("[SETPROFILE ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memperbarui profil bot: ${e.message}`);
    }
  }
};