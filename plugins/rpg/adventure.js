import db from "../../data/db.js";
const MONSTERS = [{
  name: "Slime Rawa",
  emoji: "🟢",
  minLv: 1,
  hp: 45,
  atk: 10,
  def: 2,
  expMin: 20,
  expMax: 35,
  moneyMin: 300,
  moneyMax: 600
}, {
  name: "Goblin Liar",
  emoji: "👺",
  minLv: 2,
  hp: 70,
  atk: 16,
  def: 5,
  expMin: 35,
  expMax: 60,
  moneyMin: 600,
  moneyMax: 1200
}, {
  name: "Serigala Bayangan",
  emoji: "🐺",
  minLv: 4,
  hp: 110,
  atk: 24,
  def: 9,
  expMin: 65,
  expMax: 110,
  moneyMin: 1200,
  moneyMax: 2200
}, {
  name: "Orc Berserker",
  emoji: "👹",
  minLv: 7,
  hp: 170,
  atk: 35,
  def: 15,
  expMin: 120,
  expMax: 190,
  moneyMin: 2200,
  moneyMax: 3800
}, {
  name: "Troll Batu Purba",
  emoji: "🧌",
  minLv: 11,
  hp: 250,
  atk: 48,
  def: 22,
  expMin: 200,
  expMax: 320,
  moneyMin: 4e3,
  moneyMax: 6500
}, {
  name: "Vampire Lord",
  emoji: "🧛",
  minLv: 16,
  hp: 380,
  atk: 68,
  def: 30,
  expMin: 350,
  expMax: 520,
  moneyMin: 7e3,
  moneyMax: 12e3
}, {
  name: "Naga Merah Inferno",
  emoji: "🐉",
  minLv: 22,
  hp: 550,
  atk: 95,
  def: 45,
  expMin: 600,
  expMax: 900,
  moneyMin: 14e3,
  moneyMax: 24e3
}, {
  name: "Iblis Kuno Abyss",
  emoji: "😈",
  minLv: 30,
  hp: 800,
  atk: 135,
  def: 65,
  expMin: 1100,
  expMax: 1700,
  moneyMin: 3e4,
  moneyMax: 55e3
}];
const LOOT_TABLE = [{
  key: "nature.wood",
  name: "Kayu Oak",
  emoji: "🪵",
  chance: .5,
  qty: [1, 3]
}, {
  key: "nature.leather",
  name: "Kulit Monster",
  emoji: "🟤",
  chance: .4,
  qty: [1, 2]
}, {
  key: "nature.spice",
  name: "Rempah Herbal",
  emoji: "🌶️",
  chance: .25,
  qty: [1, 2]
}, {
  key: "ores.iron",
  name: "Bijih Besi",
  emoji: "⛓️",
  chance: .2,
  qty: [1, 2]
}, {
  key: "ores.diamond",
  name: "Diamond",
  emoji: "💎",
  chance: .05,
  qty: [1, 1]
}, {
  key: "crate.common",
  name: "Common Crate",
  emoji: "📦",
  chance: .3,
  qty: [1, 1]
}, {
  key: "crate.uncommon",
  name: "Uncommon Crate",
  emoji: "🎁",
  chance: .12,
  qty: [1, 1]
}, {
  key: "crate.legendary",
  name: "Legendary Crate",
  emoji: "🏆",
  chance: .03,
  qty: [1, 1]
}, {
  key: "crate.mythic",
  name: "Mythic Crate",
  emoji: "👑",
  chance: .01,
  qty: [1, 1]
}];

function addInventoryNested(inv, dotKey, qty) {
  const [cat, item] = dotKey.split(".");
  if (inv && inv[cat]) {
    inv[cat][item] = (inv[cat][item] || 0) + qty;
  }
}

function checkLevelUp(user) {
  let isLevelUp = false;
  let oldLevel = user.level;
  let expRequired = user.level * 100;
  while (user.exp >= expRequired) {
    user.exp -= expRequired;
    user.level += 1;
    user.hpMax += 15;
    user.manaMax += 10;
    user.atk += 4;
    user.def += 2;
    user.hp = user.hpMax;
    user.mana = user.manaMax;
    isLevelUp = true;
    expRequired = user.level * 100;
  }
  return {
    isLevelUp: isLevelUp,
    oldLevel: oldLevel,
    newLevel: user.level
  };
}
export default {
  name: "adventure",
  aliases: ["adv", "hunt", "berburu", "petualang"],
  description: "Berpetualang dan bertarung melawan monster untuk mendapatkan EXP, Uang & Crate",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const now = Date.now();
      const COOLDOWN_TIME = 20 * 60 * 1e3;
      if (user.cooldown?.adventure && now - user.cooldown.adventure < COOLDOWN_TIME) {
        const sisa = COOLDOWN_TIME - (now - user.cooldown.adventure);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdBody = `⏳ *STAMINA HABIS!*\n\nKamu masih kelelahan sehabis petualangan sebelumnya.\n• *Sisa Cooldown:* \`${m} menit ${s} detik\`\n\n_💡 Gunakan waktu ini untuk memulihkan HP atau mengecek inventory._`;
        const cdButtons = [{
          name: "quick_reply",
          display_text: "🛌 Istirahat (.rest)",
          id: `${prefix}rest`
        }, {
          name: "quick_reply",
          display_text: "🎒 Tas / Inventory",
          id: `${prefix}inv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(cdBody, `${global.bot?.name || "RPG"} • Cooldown`, cdButtons, {
            title: "⏳ RPG ADVENTURE COOLDOWN",
            quoted: msg
          });
        }
        return await ctx.reply(cdBody);
      }
      if (user.hp <= 0) {
        const deadBody = `💀 *KAMU TIDAK SADARKAN DIRI!* (HP: 0/${user.hpMax})\n\nKamu tidak memiliki tenaga untuk bertualang. Pulihkan HP terlebih dahulu!`;
        const deadButtons = [{
          name: "quick_reply",
          display_text: "🛌 Tidur & Pulihkan (.rest)",
          id: `${prefix}rest`
        }, {
          name: "quick_reply",
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(deadBody, `${global.bot?.name || "RPG"} • Health Deficit`, deadButtons, {
            title: "💀 HEALTH DEPLETED",
            quoted: msg
          });
        }
        return await ctx.reply(deadBody);
      }
      const availableMonsters = MONSTERS.filter(m => m.minLv <= user.level);
      const monster = availableMonsters[Math.floor(Math.random() * availableMonsters.length)] || MONSTERS[0];
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
      let playerHp = user.hp;
      let monsterHp = monster.hp;
      const combatLogs = [];
      let round = 0;
      while (playerHp > 0 && monsterHp > 0 && round < 8) {
        round++;
        const isCrit = Math.random() < .2;
        let baseDmg = Math.max(3, totalAtk - monster.def + Math.floor(Math.random() * 6));
        if (isCrit) baseDmg = Math.floor(baseDmg * 1.6);
        monsterHp -= baseDmg;
        let monsterDmg = 0;
        if (monsterHp > 0) {
          monsterDmg = Math.max(1, monster.atk - totalDef + Math.floor(Math.random() * 5));
          playerHp -= monsterDmg;
        }
        combatLogs.push(`*R${round}* ⚔️ Dmg: \`-${baseDmg}\`${isCrit ? " 💥*CRIT!*" : ""} │ ${monster.emoji} Counter: \`-${monsterHp > 0 ? monsterDmg : 0}\``);
      }
      const isWon = monsterHp <= 0;
      user.hp = Math.max(0, playerHp);
      user.cooldown.adventure = now;
      if (isWon) {
        const expGained = Math.floor(Math.random() * (monster.expMax - monster.expMin + 1)) + monster.expMin;
        const moneyGained = Math.floor(Math.random() * (monster.moneyMax - monster.moneyMin + 1)) + monster.moneyMin;
        user.exp += expGained;
        user.money += moneyGained;
        const droppedLoot = [];
        for (const item of LOOT_TABLE) {
          if (Math.random() < item.chance) {
            const qty = Math.floor(Math.random() * (item.qty[1] - item.qty[0] + 1)) + item.qty[0];
            addInventoryNested(user.inventory, item.key, qty);
            droppedLoot.push(`${item.emoji} ${item.name} *(x${qty})*`);
          }
        }
        const lvlResult = checkLevelUp(user);
        db.write(global.db);
        let bodyText = `⚔️ *PERTARUNGAN SELESAI — MENANG!* 🏆\n\n` + `👤 *Petualang:* @${ctx.sender.split("@")[0]}\n` + `👾 *Musuh:* ${monster.emoji} *${monster.name}*\n\n` + `╭───『 *LOG PERTEMPURAN* 』\n` + `│ ${combatLogs.join("\n│ ")}\n` + `╰────────────────────\n\n` + `🎁 *REWARD PETUALANGAN:*\n` + ` • 📈 *EXP:* \`+${expGained.toLocaleString("id-ID")}\`\n` + ` • 💰 *Uang:* \`+Rp ${moneyGained.toLocaleString("id-ID")}\`\n` + (droppedLoot.length ? ` • 📦 *Loot Drop:* ${droppedLoot.join(", ")}\n` : "") + `\n❤️ *HP Tersisa:* \`${user.hp}/${user.hpMax}\` HP\n` + `📊 *EXP Progress:* \`${user.exp}/${user.level * 100}\` (Lv. ${user.level})`;
        if (lvlResult.isLevelUp) {
          bodyText += `\n\n🎉 *LEVEL UP!* Selamat level kamu naik dari *${lvlResult.oldLevel}* ➔ *${lvlResult.newLevel}*!\n_❤️ HP & 🔮 Mana telah dipulihkan penuh!_`;
        }
        const buttons = [{
          name: "quick_reply",
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        }, {
          name: "quick_reply",
          display_text: "📦 Buka Crate",
          id: `${prefix}open common`
        }, {
          name: "quick_reply",
          display_text: "⚔️ Hunt Lagi",
          id: `${prefix}adv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, `${global.bot?.name || "RPG"} • Adventure Won`, buttons, {
            title: `🏆 VICTORY: ${monster.name.toUpperCase()}`,
            mentions: [ctx.sender],
            quoted: msg
          });
        }
        return await ctx.reply(bodyText, {
          mentions: [ctx.sender]
        });
      } else {
        db.write(global.db);
        let bodyText = `💀 *PETUALANGAN GAGAL — KAMU KALAH!* 🩸\n\n` + `👤 *Petualang:* @${ctx.sender.split("@")[0]}\n` + `👾 *Musuh:* ${monster.emoji} *${monster.name}*\n\n` + `╭───『 *LOG PERTEMPURAN* 』\n` + `│ ${combatLogs.join("\n│ ")}\n` + `╰────────────────────\n\n` + `❤️ *HP Tersisa:* \`${user.hp}/${user.hpMax}\` (Habis)\n` + `💡 *Tips:* Gunakan armor/senjata lebih kuat atau istirahatlah (*.rest*) untuk memulihkan darah!`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🛌 Istirahat (.rest)",
          id: `${prefix}rest`
        }, {
          name: "quick_reply",
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, `${global.bot?.name || "RPG"} • Defeat`, buttons, {
            title: `💀 DEFEATED BY ${monster.name.toUpperCase()}`,
            mentions: [ctx.sender],
            quoted: msg
          });
        }
        return await ctx.reply(bodyText, {
          mentions: [ctx.sender]
        });
      }
    } catch (err) {
      console.error("[RPG ADVENTURE ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan pada sistem RPG: ${err.message}`);
    }
  }
};