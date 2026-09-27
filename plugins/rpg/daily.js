import db from "../../data/db.js";

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
  name: "daily",
  aliases: ["hadiahHarian", "claimdaily", "claim", "harian"],
  description: "Klaim hadiah harian (Uang, EXP, Potion, Umpan & Crate) via Rich Interactive UI",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const botName = global.bot?.name || "Wudysoft Bot";
      const prefix = ctx.prefix || ".";
      const now = Date.now();
      const COOLDOWN_DAILY = 24 * 60 * 60 * 1e3;
      user.cooldown = user.cooldown || {};
      user.inventory = user.inventory || {};
      user.inventory.drink = user.inventory.drink || {
        water: 0,
        mana_potion: 0
      };
      user.inventory.nature = user.inventory.nature || {
        bait: 0
      };
      user.inventory.crate = user.inventory.crate || {
        common: 0,
        uncommon: 0
      };
      user.money = Number(user.money) || 0;
      user.exp = Number(user.exp) || 0;
      if (user.cooldown.daily && now - user.cooldown.daily < COOLDOWN_DAILY) {
        const sisa = COOLDOWN_DAILY - (now - user.cooldown.daily);
        const h = Math.floor(sisa / 36e5);
        const m = Math.floor(sisa % 36e5 / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `⏳ *HADIAH HARIAN BELUM TERSEDIA!*\n\n` + `Kamu sudah mengambil jatah hadiah harian sebelumnya.\n` + `• 🕐 *Waktu Tersisa:* \`${h} jam ${m} menit ${s} detik\`\n\n` + `_💡 Sambil menunggu, kamu bisa bertualang atau menambang di bawah ini!_`;
        const cdButtons = [{
          name: "quick_reply",
          display_text: "⚔️ Masuk Dungeon",
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
          return await ctx.sendCta(cdText, `${botName} • Daily Cooldown`, cdButtons, {
            title: "⏳ COOLDOWN HADIAH HARIAN",
            quoted: msg
          });
        }
        return await ctx.reply(cdText);
      }
      await ctx.react("🎁");
      const isPremium = Boolean(user.premium?.status);
      const mult = isPremium ? 2 : 1;
      const moneyGained = Math.floor((5e3 + Math.floor(Math.random() * 1e4)) * mult);
      const expGained = Math.floor((25 + Math.floor(Math.random() * 35)) * mult);
      const bonusItems = [];
      const roll = Math.random();
      if (roll < .3) {
        user.inventory.drink.water = (user.inventory.drink.water || 0) + 2;
        bonusItems.push("💧 Air Mineral *(x2)*");
      } else if (roll < .55) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 4;
        bonusItems.push("🪱 Umpan Cacing *(x4)*");
      } else if (roll < .7) {
        user.inventory.drink.mana_potion = (user.inventory.drink.mana_potion || 0) + 1;
        bonusItems.push("🔵 Mana Potion *(x1)*");
      } else if (roll < .85) {
        user.inventory.crate.common = (user.inventory.crate.common || 0) + 1;
        bonusItems.push("📦 Common Crate *(x1)*");
      } else {
        user.inventory.crate.uncommon = (user.inventory.crate.uncommon || 0) + 1;
        bonusItems.push("🎁 Uncommon Crate *(x1)*");
      }
      if (isPremium) {
        user.inventory.nature.bait = (user.inventory.nature.bait || 0) + 3;
        bonusItems.push("⭐ Bonus VIP: +3x Umpan");
      }
      user.money += moneyGained;
      user.exp += expGained;
      user.cooldown.daily = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      let bodyText = `╭───『 *KLAIM HADIAH HARIAN* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ 🏷️ *Status:* ${isPremium ? "VIP / PREMIUM ⭐" : "STANDARD CITIZEN"}\n` + `├────────────────────────\n` + `│ 💰 *Uang Diperoleh:* \`+Rp ${moneyGained.toLocaleString("id-ID")}\`\n` + `│ 📈 *EXP Diperoleh:* \`+${expGained}\`\n` + `│ 🎁 *Bonus Hadiah:* ${bonusItems.join(", ")}\n` + `├────────────────────────\n` + `│ 💳 *Total Saldo:* Rp ${user.money.toLocaleString("id-ID")}\n` + `│ 📊 *Level Sekarang:* Lv. ${user.level} (\`${user.exp}/${user.level * 100}\` EXP)\n` + `╰────────────────────────`;
      if (lvlResult.isLevelUp) {
        bodyText += `\n\n🎉 *LEVEL UP!* Selamat level kamu naik dari *Lv. ${lvlResult.oldLevel}* ➔ *Lv. ${lvlResult.newLevel}*!\n_❤️ HP & 🔮 Mana telah dipulihkan penuh!_`;
      }
      bodyText += `\n\n_Hadiah harian berikutnya tersedia dalam 24 jam ke depan._`;
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
        display_text: "🎒 Buka Inventory",
        id: `${prefix}inv`
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • Daily Rewards`, buttons, {
          title: "🎁 DAILY REWARD CLAIMED",
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      return await ctx.reply(bodyText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[DAILY ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat klaim harian: ${err.message}`);
    }
  }
};