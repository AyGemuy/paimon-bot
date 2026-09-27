import db from "../../data/db.js";
export default {
  name: "autolevelup",
  aliases: ["levelup", "autolvl"],
  description: "Aktifkan/Nonaktifkan pengiriman kartu gambar canvas saat pemain naik level",
  category: "Group",
  admin: true,
  group: true,
  example: ".autolevelup on / .autolevelup off",
  execute: async (sock, ctx, msg) => {
    const opt = (ctx.args[0] || "").toLowerCase();
    if (!["on", "off", "enable", "disable", "1", "0"].includes(opt)) {
      const isAuto = global.db?.group?.[ctx.chat]?.autolevelup !== false;
      return ctx.reply(`🎖️ *AUTO LEVEL-UP NOTIFICATION*\n\n` + `Status saat ini: ${isAuto ? "🟢 *AKTIF*" : "🔴 *NONAKTIF*"}\n\n` + `📌 *Cara Penggunaan:*\n` + `• \`${ctx.prefix}autolevelup on\` (Kirim gambar tiap level up)\n` + `• \`${ctx.prefix}autolevelup off\` (Nonaktifkan spam gambar)`);
    }
    const isEnable = ["on", "enable", "1"].includes(opt);
    global.db.group = global.db.group || {};
    global.db.group[ctx.chat] = global.db.group[ctx.chat] || {};
    global.db.group[ctx.chat].autolevelup = isEnable;
    if (typeof db?.write === "function") {
      db.write(global.db);
    }
    await ctx.react(isEnable ? "✅" : "❌");
    await ctx.reply(`🎖️ Notifikasi gambar *Auto Level-Up* berhasil ${isEnable ? "*DIAKTIFKAN* 🟢" : "*DINONAKTIFKAN* 🔴"} di grup ini.`);
  }
};