import db from "../../data/db.js";
const CRATE_REWARDS = {
  common: {
    moneyMin: 1500,
    moneyMax: 3500,
    expMin: 20,
    expMax: 45,
    bait: 2
  },
  uncommon: {
    moneyMin: 3500,
    moneyMax: 7500,
    expMin: 50,
    expMax: 90,
    bait: 4
  },
  legendary: {
    moneyMin: 1e4,
    moneyMax: 25e3,
    expMin: 150,
    expMax: 300,
    bait: 8
  },
  mythic: {
    moneyMin: 35e3,
    moneyMax: 7e4,
    expMin: 500,
    expMax: 900,
    bait: 15
  },
  secret: {
    moneyMin: 1e5,
    moneyMax: 25e4,
    expMin: 1500,
    expMax: 3e3,
    bait: 30
  }
};
export default {
  name: "inventory",
  aliases: ["inv", "tas", "profile", "equip", "open", "use"],
  description: "Melihat tas inventaris, memasang perlengkapan, dan membuka peti hadiah",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const action = (ctx.cmd || "").toLowerCase();
      const target = (ctx.args[0] || "").toLowerCase();
      if (action === "equip" || target === "equip") {
        const itemKey = (action === "equip" ? ctx.args[0] : ctx.args[1] || "").toLowerCase();
        if (!itemKey) return ctx.reply(`👉 *Format:* \`${prefix}equip <nama_item>\`\n_Contoh: \`${prefix}equip sword_iron\`_`);
        if ((user.inventory.weapon[itemKey] || 0) > 0) {
          user.equipped.weapon = itemKey;
          db.write(global.db);
          return ctx.reply(`🗡️ Senjata *${itemKey.toUpperCase()}* berhasil dipasang ke slot aktif!`);
        } else if ((user.inventory.armor[itemKey] || 0) > 0) {
          user.equipped.armor = itemKey;
          db.write(global.db);
          return ctx.reply(`🛡️ Baju Zirah *${itemKey.toUpperCase()}* berhasil dipakai ke slot pertahanan!`);
        } else {
          return ctx.reply(`❌ Kamu tidak memiliki item *${itemKey}* di dalam tas!`);
        }
      }
      if (action === "open") {
        const crateType = target || "common";
        if (!CRATE_REWARDS[crateType]) {
          return ctx.reply(`❌ Jenis crate tidak valid! Pilihan: \`common\`, \`uncommon\`, \`legendary\`, \`mythic\`, \`secret\`.`);
        }
        if ((user.inventory.crate[crateType] || 0) <= 0) {
          return ctx.reply(`❌ Kamu tidak memiliki *${crateType.toUpperCase()} CRATE*!`);
        }
        user.inventory.crate[crateType] -= 1;
        const cfg = CRATE_REWARDS[crateType];
        const rewardMoney = Math.floor(Math.random() * (cfg.moneyMax - cfg.moneyMin + 1)) + cfg.moneyMin;
        const rewardExp = Math.floor(Math.random() * (cfg.expMax - cfg.expMin + 1)) + cfg.expMin;
        user.money += rewardMoney;
        user.exp += rewardExp;
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + cfg.bait;
        db.write(global.db);
        await ctx.react("🎁");
        const openText = `🎁 *MEMBUKA ${crateType.toUpperCase()} CRATE* 🎁\n\n` + `• 💰 *Uang:* \`+Rp ${rewardMoney.toLocaleString("id-ID")}\`\n` + `• 📈 *EXP:* \`+${rewardExp}\`\n` + `• 🪱 *Umpan Pancing:* \`+${cfg.bait} Bait\`\n\n` + `_Sisa ${crateType} crate: ${user.inventory.crate[crateType]} buah._`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🎁 Buka Crate Lagi",
          id: `${prefix}open ${crateType}`
        }, {
          name: "quick_reply",
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(openText, `${global.bot?.name || "RPG"} • Crate Rewards`, buttons, {
            title: "🎁 CRATE UNBOXING",
            quoted: msg
          });
        }
        return await ctx.reply(openText);
      }
      const inv = user.inventory;
      const weaponBonus = {
        sword_stone: 8,
        sword_iron: 18,
        sword_diamond: 35,
        sword_light: 60,
        sword_dark: 85
      };
      const armorBonus = {
        armor_leather: 6,
        armor_iron: 15,
        armor_crystal: 32
      };
      const totalAtk = user.atk + (weaponBonus[user.equipped?.weapon] || 0);
      const totalDef = user.def + (armorBonus[user.equipped?.armor] || 0);
      const bodyText = `╭───『 *STATUS KARAKTER RPG* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ ⭐ *Level:* Lv. ${user.level} (EXP: ${user.exp}/${user.level * 100})\n` + `│ ❤️ *HP:* \`${user.hp}/${user.hpMax}\`\n` + `│ 🔮 *Mana:* \`${user.mana}/${user.manaMax}\`\n` + `│ ⚔️ *Total ATK:* ${totalAtk} | 🛡️ *Total DEF:* ${totalDef}\n` + `│ 💰 *Uang:* Rp ${user.money.toLocaleString("id-ID")}\n` + `│ 🗡️ *Senjata Aktif:* ${user.equipped.weapon || "Tangan Kosong"}\n` + `│ 🛡️ *Zirah Aktif:* ${user.equipped.armor || "Pakaian Biasa"}\n` + `├────────────────────────\n` + `│ ⛏️ *Hasil Tambang (Ores):*\n` + `│ • Batu: ${inv.ores.stone} | Besi: ${inv.ores.iron} | Emas: ${inv.ores.gold} | Diamond: ${inv.ores.diamond} | Platinum: ${inv.ores.platinum}\n` + `│\n` + `│ 🐟 *Hasil Tangkapan Ikan:*\n` + `│ • Teri: ${inv.fish.anchovy} | Lele: ${inv.fish.catfish} | Tuna: ${inv.fish.tuna} | Salmon: ${inv.fish.salmon} | Pedang: ${inv.fish.swordfish}\n` + `│\n` + `│ 📦 *Peti Hadiah (Crates):*\n` + `│ • Common: ${inv.crate.common} | Uncommon: ${inv.crate.uncommon} | Legendary: ${inv.crate.legendary} | Mythic: ${inv.crate.mythic}\n` + `│\n` + `│ 🪱 *Umpan Pancing:* ${inv.nature.bait} buah\n` + `╰────────────────────────\n\n` + `_Pilih menu aksi di bawah untuk melanjutkan petualangan:_`;
      const buttons = [{
        name: "quick_reply",
        display_text: "⚔️ Masuk Dungeon",
        id: `${prefix}adv`
      }, {
        name: "quick_reply",
        display_text: "⛏️ Pergi Menambang",
        id: `${prefix}mine`
      }, {
        name: "quick_reply",
        display_text: "🎣 Pergi Mancing",
        id: `${prefix}fish`
      }, {
        name: "quick_reply",
        display_text: "🔨 Buka Blacksmith",
        id: `${prefix}craft`
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${global.bot?.name || "RPG"} • Character Sheet`, buttons, {
          title: `🎒 INVENTORY: ${user.name.toUpperCase()}`,
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      return await ctx.reply(bodyText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[INVENTORY ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};