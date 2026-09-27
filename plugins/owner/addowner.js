import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  makeJid,
  ensureUser
} from "../../core/tools.js";
import db from "../../data/db.js";
export default {
  name: "addowner",
  aliases: ["tambahowner"],
  description: "Menambahkan nomor ke daftar owner",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      const raw = ctx.args[0]?.replace(/\D/g, "") || "";
      const jid = raw ? makeJid(raw) : ctx.quoted?.sender;
      if (!jid) return ctx.reply("❌ Sertakan nomor atau reply pesan target.");
      ensureUser(jid, jid.split("@")[0]);
      global.db.user[jid].ownerAcces = true;
      if (!global.bot.owner) global.bot.owner = [];
      const noJid = jid.split("@")[0];
      if (!global.bot.owner.includes(noJid)) global.bot.owner.push(noJid);
      db.write(global.db);
      await sock.sendMessage(ctx.id, {
        text: `✅ *${noJid}* berhasil ditambahkan sebagai owner`
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};