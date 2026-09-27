import db from "../../data/db.js";
const SHOP_ITEMS = {
  bait: {
    name: "Umpan Cacing",
    category: "nature",
    emoji: "🪱",
    price: 200,
    sell: 50
  },
  water: {
    name: "Air Mineral",
    category: "drink",
    emoji: "💧",
    price: 100,
    sell: 30
  },
  juice: {
    name: "Jus Buah Segar",
    category: "drink",
    emoji: "🧃",
    price: 500,
    sell: 150
  },
  herbal_tea: {
    name: "Teh Herbal",
    category: "drink",
    emoji: "🍵",
    price: 800,
    sell: 250
  },
  mana_potion: {
    name: "Mana Potion",
    category: "drink",
    emoji: "🔵",
    price: 2e3,
    sell: 600
  },
  elixir: {
    name: "Elixir Suci",
    category: "drink",
    emoji: "✨",
    price: 5e3,
    sell: 1500
  },
  bread: {
    name: "Roti Gandum",
    category: "food",
    emoji: "🍞",
    price: 300,
    sell: 80
  },
  rice: {
    name: "Nasi Putih",
    category: "food",
    emoji: "🍚",
    price: 400,
    sell: 100
  },
  pickaxe_iron: {
    name: "Pickaxe Besi",
    category: "tools",
    emoji: "⛏️",
    price: 5e3,
    sell: 1500
  },
  pickaxe_diamond: {
    name: "Pickaxe Berlian",
    category: "tools",
    emoji: "💎",
    price: 2e4,
    sell: 6e3
  },
  rod_wood: {
    name: "Joran Kayu",
    category: "tools",
    emoji: "🎣",
    price: 3e3,
    sell: 900
  },
  rod_premium: {
    name: "Joran Premium",
    category: "tools",
    emoji: "🌟",
    price: 15e3,
    sell: 4500
  },
  sword_stone: {
    name: "Pedang Batu",
    category: "weapon",
    emoji: "🗡️",
    price: 3e3,
    sell: 800
  },
  sword_iron: {
    name: "Pedang Besi",
    category: "weapon",
    emoji: "⚔️",
    price: 8e3,
    sell: 2400
  },
  sword_diamond: {
    name: "Pedang Berlian",
    category: "weapon",
    emoji: "💠",
    price: 25e3,
    sell: 7500
  },
  sword_light: {
    name: "Pedang Cahaya",
    category: "weapon",
    emoji: "☀️",
    price: 6e4,
    sell: 18e3
  },
  sword_dark: {
    name: "Pedang Kegelapan",
    category: "weapon",
    emoji: "🌑",
    price: 8e4,
    sell: 24e3
  },
  armor_leather: {
    name: "Armor Kulit",
    category: "armor",
    emoji: "🟤",
    price: 4e3,
    sell: 1200
  },
  armor_iron: {
    name: "Armor Besi",
    category: "armor",
    emoji: "🔩",
    price: 12e3,
    sell: 3600
  },
  armor_crystal: {
    name: "Armor Kristal",
    category: "armor",
    emoji: "💎",
    price: 35e3,
    sell: 10500
  }
};
export default {
  name: "shop",
  aliases: ["toko", "store", "beli", "buy", "jual", "sell", "pasar"],
  description: "Toko dan pasar jual-beli item RPG lengkap via Menu List CTA",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const args = ctx.args || [];
      const botName = global.bot?.name || "Wudysoft Bot";
      if (cmd === "jual" || cmd === "sell" || args[0]?.toLowerCase() === "jual") {
        const itemKey = (cmd === "jual" || cmd === "sell" ? args[0] : args[1])?.toLowerCase();
        const qty = parseInt(cmd === "jual" || cmd === "sell" ? args[1] : args[2]) || 1;
        if (!itemKey || !SHOP_ITEMS[itemKey]) {
          return ctx.reply(`❌ *Item tidak ditemukan!*\n\n` + `👉 *Format Jual:* \`${prefix}jual <nama_item> <jumlah>\`\n` + `_Contoh: \`${prefix}jual bait 10\`_\n` + `Cek katalog barang di \`${prefix}toko\``);
        }
        const item = SHOP_ITEMS[itemKey];
        const inv = user.inventory[item.category];
        if (!inv || (inv[itemKey] || 0) < qty) {
          return ctx.reply(`❌ *${item.name}* kamu tidak cukup! Kamu memiliki: *${inv?.[itemKey] || 0} buah*.`);
        }
        inv[itemKey] -= qty;
        const totalSell = item.sell * qty;
        user.money += totalSell;
        db.write(global.db);
        await ctx.react("💰");
        return ctx.reply(`✅ *PENJUALAN BERHASIL!*\n\n` + `• *Barang:* ${item.emoji} ${item.name} (x${qty})\n` + `• *Pendapatan:* +Rp ${totalSell.toLocaleString("id-ID")}\n` + `• 💳 *Saldo Sekarang:* Rp ${user.money.toLocaleString("id-ID")}`);
      }
      if (cmd === "beli" || cmd === "buy" || args[0]?.toLowerCase() === "beli") {
        const itemKey = (cmd === "beli" || cmd === "buy" ? args[0] : args[1])?.toLowerCase();
        const qty = parseInt(cmd === "beli" || cmd === "buy" ? args[1] : args[2]) || 1;
        if (!itemKey || !SHOP_ITEMS[itemKey]) {
          return ctx.reply(`❌ *Item tidak ditemukan!*\n\n` + `👉 *Format Beli:* \`${prefix}beli <nama_item> <jumlah>\`\n` + `_Contoh: \`${prefix}beli bait 5\`_\n` + `Cek katalog barang di \`${prefix}toko\``);
        }
        const item = SHOP_ITEMS[itemKey];
        const totalPrice = item.price * qty;
        if (user.money < totalPrice) {
          return ctx.reply(`❌ *Uang tidak cukup!*\n\n` + `• 💰 *Biaya:* Rp ${totalPrice.toLocaleString("id-ID")}\n` + `• 💳 *Uangmu:* Rp ${user.money.toLocaleString("id-ID")}`);
        }
        user.money -= totalPrice;
        user.inventory[item.category][itemKey] = (user.inventory[item.category][itemKey] || 0) + qty;
        db.write(global.db);
        await ctx.react("🛒");
        const successText = `✅ *PEMBELIAN BERHASIL!* 🛍️\n\n` + `• *Barang:* ${item.emoji} ${item.name} (x${qty})\n` + `• *Total Bayar:* -Rp ${totalPrice.toLocaleString("id-ID")}\n` + `• 💳 *Sisa Saldo:* Rp ${user.money.toLocaleString("id-ID")}\n\n` + `_Item telah masuk ke tas (\`${prefix}inv\`)._`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        }, {
          name: "quick_reply",
          display_text: "🏪 Toko Lainnya",
          id: `${prefix}shop`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(successText, `${botName} • Shop Transaction`, buttons, {
            title: "🛍️ PEMBELIAN SUKSES",
            quoted: msg
          });
        }
        return await ctx.reply(successText);
      }
      const grouped = {};
      for (const [key, val] of Object.entries(SHOP_ITEMS)) {
        if (!grouped[val.category]) grouped[val.category] = [];
        grouped[val.category].push({
          key: key,
          ...val
        });
      }
      const catLabels = {
        nature: "🌿 ALAM & UMPAN",
        drink: "🧃 MINUMAN & POTION",
        food: "🍱 MAKANAN",
        tools: "🔧 ALAT & PERKAKAS",
        weapon: "⚔️ SENJATA TEMPUR",
        armor: "🛡️ BAJU ZIRAH & ARMOR"
      };
      const sections = Object.entries(grouped).map(([cat, items]) => ({
        title: catLabels[cat] || cat.toUpperCase(),
        rows: items.map(item => ({
          title: `${item.emoji} ${item.name}`.slice(0, 24),
          description: `Beli: Rp ${item.price.toLocaleString("id-ID")} | Jual: Rp ${item.sell.toLocaleString("id-ID")}`,
          id: `${prefix}beli ${item.key} 1`
        }))
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🛒 Buka Katalog Toko RPG",
          sections: sections
        })
      }, {
        name: "quick_reply",
        display_text: "🎒 Cek Inventory",
        id: `${prefix}inv`
      }, {
        name: "quick_reply",
        display_text: "⚔️ Masuk Dungeon",
        id: `${prefix}adv`
      }];
      const bodyText = `╭───『 *PASAR & TOKO RPG* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ 💰 *Saldo Uang:* Rp ${user.money.toLocaleString("id-ID")}\n` + `│ 🛍️ *Total Barang:* ${Object.keys(SHOP_ITEMS).length} Item Tersedia\n` + `╰────────────────────────\n\n` + `• *Beli Instan:* Klik barang pada dropdown di bawah (1x).\n` + `• *Beli Banyak:* Ketik \`${prefix}beli <nama_item> <jumlah>\`\n` + `• *Jual Barang:* Ketik \`${prefix}jual <nama_item> <jumlah>\``;
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • RPG Marketplace`, buttons, {
          title: "🏪 PASAR & TOKO RPG",
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      let fallbackText = `╭─〔 *TOKO RPG* 〕─⬿\n│ 💰 Uangmu: Rp ${user.money.toLocaleString("id-ID")}\n│\n`;
      for (const [cat, items] of Object.entries(grouped)) {
        fallbackText += `│ ${catLabels[cat] || cat}\n`;
        for (const item of items) {
          fallbackText += `│  • ${item.key} — ${item.emoji} ${item.name}\n│    Beli: Rp ${item.price.toLocaleString("id-ID")} | Jual: Rp ${item.sell.toLocaleString("id-ID")}\n`;
        }
        fallbackText += `│\n`;
      }
      fallbackText += `│ 👉 *Beli:* \`${prefix}beli [item] [qty]\`\n│ 👉 *Jual:* \`${prefix}jual [item] [qty]\`\n╰─〔 ${botName} RPG 〕─⬿`;
      return await ctx.reply(fallbackText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[SHOP ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan pada toko: ${err.message}`);
    }
  }
};