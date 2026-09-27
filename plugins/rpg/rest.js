import db from "../../data/db.js";
export default {
  name: "rest",
  aliases: ["heal", "tidur", "istirahat", "camp"],
  description: "Mendirikan tenda perkemahan dan memulihkan seluruh HP & Mana",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const now = Date.now();
      const COOLDOWN = 10 * 60 * 1e3;
      if (user.cooldown?.rest && now - user.cooldown.rest < COOLDOWN) {
        const sisa = COOLDOWN - (now - user.cooldown.rest);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        return ctx.reply(`⛺ *KAMU BARU SAJA ISTIRAHAT!*\nTubuhmu masih bugar. Cooldown: *${m}m ${s}d*.`);
      }
      if (user.hp >= user.hpMax && user.mana >= user.manaMax) {
        return ctx.reply(`❤️ *DARAH & MANA SUDAH PENUH!*\nHP: \`${user.hp}/${user.hpMax}\` | Mana: \`${user.mana}/${user.manaMax}\`.\nKamu siap bertarung (\`${prefix}adv\`)!`);
      }
      const oldHp = user.hp;
      user.hp = user.hpMax;
      user.mana = user.manaMax;
      user.cooldown.rest = now;
      let foundFruit = "";
      if (Math.random() < .4) {
        user.inventory.fruit.apple = (user.inventory.fruit.apple || 0) + 2;
        foundFruit = `\n🍎 _Saat berkemah, kamu memetik 2x Apel Segar!_`;
      }
      db.write(global.db);
      const restText = `⛺ *PERKEMAHAN SELESAI — PULIH PENUH!* ⛺\n\n` + `Kamu beristirahat di dekat api unggun yang hangat.\n\n` + `• ❤️ *HP Pulih:* \`${oldHp}\` ➔ \`${user.hpMax}/${user.hpMax}\` (+100%)\n` + `• 🔮 *Mana Pulih:* \`${user.manaMax}/${user.manaMax}\` (Penuh)${foundFruit}\n\n` + `_Staminalah kembali membara! Ayo bertualang kembali._`;
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Lanjut Bertualang",
        id: `${prefix}adv`
      }, {
        name: "quick_reply",
        display_text: "⛏️ Pergi Menambang",
        id: `${prefix}mine`
      }, {
        name: "quick_reply",
        display_text: "🎒 Buka Inventory",
        id: `${prefix}inv`
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(restText, `${global.bot?.name || "RPG"} • Rest & Recovery`, buttons, {
          title: "🏕️ CAMPING & HEALING",
          quoted: msg
        });
      }
      return await ctx.reply(restText);
    } catch (err) {
      console.error("[REST ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};