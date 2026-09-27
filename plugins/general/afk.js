import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "afk",
  aliases: ["away"],
  description: "Mengaktifkan mode AFK (Away From Keyboard) dengan alasan",
  category: "General",
  example: ".afk Sedang makan / tidur",
  execute: async (sock, ctx, msg) => {
    const reason = ctx.query?.trim() || "Tanpa alasan";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const userJid = ctx.userPhoneJid || ctx.sender;
    if (typeof db?.ensureUser === "function") {
      db.ensureUser(userJid, ctx.pushname || ctx.senderNumber);
    }
    const userObj = ctx.user || global.db?.user?.[userJid];
    if (userObj) {
      userObj.afk = {
        afkTime: Date.now(),
        reason: reason
      };
    }
    if (typeof db?.write === "function") {
      db.write(global.db);
    }
    await ctx.react("💤");
    const name = userObj?.name || ctx.pushname || ctx.senderNumber;
    const text = `💤 *MODE AFK DIAKTIFKAN*\n\n` + `│ 👤 *User:* ${name}\n` + `│ 📌 *Alasan:* ${reason}\n` + `│ 🕒 *Waktu:* ${new Date().toLocaleTimeString("id-ID")}\n\n` + `_Bot akan otomatis memberitahu siapa saja yang me-mention kamu, dan status AFK akan otomatis lepas saat kamu mengetik pesan lagi._`;
    await sock.sendMessage(ctx.chat, {
      text: text
    }, {
      quoted: quotedMsg
    });
  }
};