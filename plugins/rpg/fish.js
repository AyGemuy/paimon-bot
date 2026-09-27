import db from "../../data/db.js";
const FISH_TABLE = [{
  key: "fish.anchovy",
  name: "Ikan Teri",
  emoji: "🐟",
  chance: .55,
  exp: 6
}, {
  key: "fish.shrimp",
  name: "Udang Segar",
  emoji: "🦐",
  chance: .45,
  exp: 9
}, {
  key: "fish.catfish",
  name: "Ikan Lele",
  emoji: "🐟",
  chance: .4,
  exp: 12
}, {
  key: "fish.carp",
  name: "Ikan Mas",
  emoji: "🐡",
  chance: .3,
  exp: 15
}, {
  key: "fish.squid",
  name: "Cumi-Cumi",
  emoji: "🦑",
  chance: .22,
  exp: 20
}, {
  key: "fish.tuna",
  name: "Ikan Tuna",
  emoji: "🐠",
  chance: .18,
  exp: 25
}, {
  key: "fish.salmon",
  name: "Ikan Salmon",
  emoji: "🐟",
  chance: .15,
  exp: 30
}, {
  key: "fish.clownfish",
  name: "Ikan Badut",
  emoji: "🐠",
  chance: .1,
  exp: 35
}, {
  key: "fish.swordfish",
  name: "Ikan Pedang",
  emoji: "🗡️",
  chance: .06,
  exp: 50
}, {
  key: "fish.pufferfish",
  name: "Ikan Buntal",
  emoji: "🐡",
  chance: .04,
  exp: 70
}, {
  key: "crate.uncommon",
  name: "Peti Harta Karun Laut",
  emoji: "🎁",
  chance: .08,
  exp: 20
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
  name: "fish",
  aliases: ["mancing", "fishing", "pancing"],
  description: "Memancing ikan di sungai atau laut menggunakan umpan",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const now = Date.now();
      const COOLDOWN_TIME = 10 * 60 * 1e3;
      if (user.cooldown?.fish && now - user.cooldown.fish < COOLDOWN_TIME) {
        const sisa = COOLDOWN_TIME - (now - user.cooldown.fish);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        const cdText = `⏳ *IKAN SEDANG KABUR!*\n\nSungai masih tenang, tunggu beberapa saat lagi.\n• *Sisa Cooldown:* \`${m} menit ${s} detik\``;
        const cdButtons = [{
          name: "quick_reply",
          display_text: "⛏️ Pergi Menambang",
          id: `${prefix}mine`
        }, {
          name: "quick_reply",
          display_text: "🎒 Cek Inventory",
          id: `${prefix}inv`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(cdText, `${global.bot?.name || "RPG"} • Fishing Cooldown`, cdButtons, {
            title: "⏳ COOLDOWN MEMANCING",
            quoted: msg
          });
        }
        return await ctx.reply(cdText);
      }
      if ((user.inventory.nature.bait || 0) <= 0) {
        const noBaitText = `🪱 *KAMU TIDAK MEMILIKI UMPAN!*\n\nBeli umpan di toko (\`${prefix}shop\`) atau buka Crate untuk mendapatkan umpan.`;
        const noBaitButtons = [{
          name: "quick_reply",
          display_text: "🏪 Beli di Toko",
          id: `${prefix}shop`
        }, {
          name: "quick_reply",
          display_text: "📦 Buka Crate",
          id: `${prefix}open common`
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(noBaitText, `${global.bot?.name || "RPG"} • No Bait`, noBaitButtons, {
            title: "🪱 UMPAN KOSONG",
            quoted: msg
          });
        }
        return await ctx.reply(noBaitText);
      }
      const hasPremRod = (user.inventory.tools.rod_premium || 0) > 0;
      const hasWoodRod = (user.inventory.tools.rod_wood || 0) > 0;
      const rodMultiplier = hasPremRod ? 2 : hasWoodRod ? 1.4 : 1;
      const rodLabel = hasPremRod ? "Joran Premium 🌟 (+100%)" : hasWoodRod ? "Joran Kayu 🎣 (+40%)" : "Tangan Kosong 🖐️";
      user.inventory.nature.bait -= 1;
      await ctx.react("🎣");
      const catches = [];
      let totalExp = 0;
      for (const fish of FISH_TABLE) {
        if (Math.random() < fish.chance * rodMultiplier) {
          addInventoryNested(user.inventory, fish.key, 1);
          totalExp += fish.exp;
          catches.push(`${fish.emoji} ${fish.name}`);
        }
      }
      user.exp += totalExp;
      user.cooldown.fish = now;
      const lvlResult = checkLevelUp(user);
      db.write(global.db);
      let bodyText = `🎣 *HASIL TANGKAPAN MEMANCING* 🌊\n\n` + `👤 *Pemancing:* @${ctx.sender.split("@")[0]}\n` + `🎣 *Alat:* ${rodLabel}\n` + `🪱 *Sisa Umpan:* \`${user.inventory.nature.bait} buah\`\n\n` + `╭───『 *TANGKAPAN IKAN* 』\n` + (catches.length ? `│ ${catches.join("\n│ ")}\n` : "│ Ikan memakan umpan lalu kabur...\n") + `╰────────────────────────\n\n` + `📈 *Total EXP:* \`+${totalExp}\`\n` + `📊 *EXP Progress:* \`${user.exp}/${user.level * 100}\` (Lv. ${user.level})`;
      if (lvlResult.isLevelUp) {
        bodyText += `\n\n🎉 *LEVEL UP!* Selamat level kamu naik ke *Lv. ${lvlResult.newLevel}*!\n_❤️ HP & 🔮 Mana telah dipulihkan penuh!_`;
      }
      const buttons = [{
        name: "quick_reply",
        display_text: "🍳 Masak Ikan Bakar",
        id: `${prefix}craft grilled_fish`
      }, {
        name: "quick_reply",
        display_text: "🎣 Mancing Lagi",
        id: `${prefix}fish`
      }, {
        name: "quick_reply",
        display_text: "🎒 Buka Inventory",
        id: `${prefix}inv`
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${global.bot?.name || "RPG"} • Fishing System`, buttons, {
          title: "🌊 SUNGAI & LAUT SELESAI",
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      return await ctx.reply(bodyText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[FISH ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan saat memancing: ${err.message}`);
    }
  }
};