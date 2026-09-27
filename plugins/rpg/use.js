import db from "../../data/db.js";
const USABLE_ITEMS = {
  water: {
    name: "Air Mineral",
    emoji: "💧",
    hp: 15,
    mana: 0,
    category: "drink"
  },
  juice: {
    name: "Jus Buah Segar",
    emoji: "🧃",
    hp: 30,
    mana: 10,
    category: "drink"
  },
  herbal_tea: {
    name: "Teh Herbal",
    emoji: "🍵",
    hp: 50,
    mana: 25,
    category: "drink"
  },
  mana_potion: {
    name: "Mana Potion",
    emoji: "🔵",
    hp: 0,
    mana: 80,
    category: "drink"
  },
  elixir: {
    name: "Elixir Suci",
    emoji: "✨",
    hp: 200,
    mana: 100,
    category: "drink"
  },
  bread: {
    name: "Roti Gandum",
    emoji: "🍞",
    hp: 20,
    mana: 0,
    category: "food"
  },
  rice: {
    name: "Nasi Putih",
    emoji: "🍚",
    hp: 40,
    mana: 5,
    category: "food"
  },
  grilled_fish: {
    name: "Ikan Bakar",
    emoji: "🐟",
    hp: 60,
    mana: 10,
    category: "food"
  },
  fruit_salad: {
    name: "Salad Buah Segar",
    emoji: "🥗",
    hp: 45,
    mana: 30,
    category: "food"
  },
  roast_chicken: {
    name: "Ayam Panggang",
    emoji: "🍗",
    hp: 80,
    mana: 15,
    category: "food"
  },
  steak: {
    name: "Steak Daging Sapi",
    emoji: "🥩",
    hp: 100,
    mana: 20,
    category: "food"
  }
};
export default {
  name: "use",
  aliases: ["pakai", "consume", "makan", "minum", "heal"],
  description: "Mengonsumsi makanan atau ramuan untuk memulihkan HP & Mana via Interactive CTA",
  category: "RPG",
  example: "use potion atau use steak 2",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Wudysoft Bot";
      const itemKey = ctx.args[0]?.toLowerCase().replace(/\s+/g, "_");
      const qty = Math.max(1, parseInt(ctx.args[1]) || 1);
      if (!itemKey || !USABLE_ITEMS[itemKey]) {
        const ownedRows = [];
        for (const [key, item] of Object.entries(USABLE_ITEMS)) {
          const count = user.inventory?.[item.category]?.[key] || 0;
          if (count > 0) {
            const statText = [item.hp > 0 ? `+${item.hp} HP` : "", item.mana > 0 ? `+${item.mana} MP` : ""].filter(Boolean).join(" & ");
            ownedRows.push({
              title: `${item.emoji} ${item.name} (${count}x)`.slice(0, 24),
              description: `Efek: ${statText}`,
              id: `${prefix}use ${key} 1`
            });
          }
        }
        const buttons = [];
        if (ownedRows.length > 0) {
          buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🍽️ Pilih Makanan / Potion",
              sections: [{
                title: `Konsumsi Milikmu (${ownedRows.length} Jenis)`,
                rows: ownedRows
              }]
            })
          });
        }
        buttons.push({
          name: "quick_reply",
          display_text: "⛺ Tidur & Pulih (.rest)",
          id: `${prefix}rest`
        }, {
          name: "quick_reply",
          display_text: "🍳 Masak di Dapur",
          id: `${prefix}craft`
        }, {
          name: "quick_reply",
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        });
        let menuText = `╭───『 *PULIHKAN STATUS HP & MANA* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ ❤️ *HP:* \`${user.hp}/${user.hpMax}\`\n` + `│ 🔮 *Mana:* \`${user.mana}/${user.manaMax}\`\n` + `├────────────────────────\n` + `│ 🍱 *Total Makanan & Potion Milikmu:* ${ownedRows.length} Jenis\n` + `╰────────────────────────\n\n` + (ownedRows.length > 0 ? `_Pilih makanan/minuman pada dropdown di bawah untuk langsung mengonsumsinya:_` : `❌ _Kamu tidak memiliki makanan atau ramuan pemulih di tas._\n👉 _Masak makanan di \`${prefix}craft\`, beli di \`${prefix}shop\`, atau tidur di \`${prefix}rest\`._`);
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(menuText, `${botName} • Recovery Center`, buttons, {
            title: "🧪 RECOVERY & CONSUMABLES",
            mentions: [ctx.sender],
            quoted: msg
          });
        }
        return await ctx.reply(menuText, {
          mentions: [ctx.sender]
        });
      }
      const item = USABLE_ITEMS[itemKey];
      const inv = user.inventory?.[item.category];
      if (!inv || (inv[itemKey] || 0) < qty) {
        return ctx.reply(`❌ *${item.name}* kamu tidak cukup!\n` + `• Kamu hanya memiliki: \`${inv?.[itemKey] || 0} buah\`\n` + `👉 _Masak makanan di \`${prefix}craft\` atau beli di \`${prefix}shop\`._`);
      }
      if (user.hp >= user.hpMax && user.mana >= user.manaMax) {
        return ctx.reply(`💚 *HP & MANA SUDAH PENUH!*\n\n` + `• ❤️ *HP:* \`${user.hp}/${user.hpMax}\`\n` + `• 🔮 *Mana:* \`${user.mana}/${user.manaMax}\`\n\n` + `_Kondisimu sangat bugar untuk bertarung di \`${prefix}adv\`!_`);
      }
      const hpBefore = user.hp;
      const manaBefore = user.mana;
      inv[itemKey] -= qty;
      const totalHpHeal = item.hp * qty;
      const totalManaHeal = item.mana * qty;
      user.hp = Math.min(user.hpMax, user.hp + totalHpHeal);
      user.mana = Math.min(user.manaMax, user.mana + totalManaHeal);
      const realHpGained = user.hp - hpBefore;
      const realManaGained = user.mana - manaBefore;
      db.write(global.db);
      await ctx.react("🧪");
      const successText = `╭───『 *KONSUMSI ITEM BERHASIL* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ 🍽️ *Mengonsumsi:* ${item.emoji} *${item.name}* (x${qty})\n` + `├────────────────────────\n` + (item.hp > 0 ? `│ ❤️ *HP Pulih:* \`${hpBefore}\` ➔ \`${user.hp}/${user.hpMax}\` (+${realHpGained})\n` : "") + (item.mana > 0 ? `│ 🔮 *Mana Pulih:* \`${manaBefore}\` ➔ \`${user.mana}/${user.manaMax}\` (+${realManaGained})\n` : "") + `│ 📦 *Sisa di Tas:* \`${inv[itemKey]} buah\`\n` + `╰────────────────────────\n\n` + `_Tubuhmu terasa lebih bertenaga untuk kembali berpetualang!_`;
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Masuk Dungeon",
        id: `${prefix}adv`
      }, {
        name: "quick_reply",
        display_text: "🎒 Cek Inventory",
        id: `${prefix}inv`
      }];
      if (inv[itemKey] > 0 && (user.hp < user.hpMax || user.mana < user.manaMax)) {
        buttons.unshift({
          name: "quick_reply",
          display_text: `🧪 Pakai Lagi (${inv[itemKey]}x)`,
          id: `${prefix}use ${itemKey} 1`
        });
      }
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(successText, `${botName} • Recovery Center`, buttons, {
          title: "✨ STATUS RESTORED",
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      return await ctx.reply(successText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[USE ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};