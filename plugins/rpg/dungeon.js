import db from "../../data/db.js";
global.adventureSession = global.adventureSession || new Map();
const DUNGEON_MONSTERS = [{
  name: "Goblin Thief",
  hp: 110,
  atk: 18,
  def: 6,
  exp: 40,
  money: 1200,
  ore: "coal",
  crate: "common"
}, {
  name: "Orc Berserker",
  hp: 240,
  atk: 35,
  def: 12,
  exp: 85,
  money: 2500,
  ore: "iron",
  crate: "uncommon"
}, {
  name: "Undead Knight",
  hp: 380,
  atk: 52,
  def: 22,
  exp: 170,
  money: 4500,
  ore: "gold",
  crate: "uncommon"
}, {
  name: "Lava Golem",
  hp: 600,
  atk: 72,
  def: 35,
  exp: 320,
  money: 8e3,
  ore: "diamond",
  crate: "legendary"
}, {
  name: "Ancient Wyvern",
  hp: 1e3,
  atk: 105,
  def: 55,
  exp: 650,
  money: 2e4,
  ore: "platinum",
  crate: "mythic"
}];

function getEquipmentStats(user) {
  let bonusAtk = 0;
  let bonusDef = 0;
  const w = user.equipped?.weapon;
  if (w === "sword_stone") bonusAtk += 8;
  else if (w === "sword_iron") bonusAtk += 18;
  else if (w === "sword_diamond") bonusAtk += 35;
  else if (w === "sword_light") bonusAtk += 65;
  else if (w === "sword_dark") bonusAtk += 95;
  const a = user.equipped?.armor;
  if (a === "armor_leather") bonusDef += 6;
  else if (a === "armor_iron") bonusDef += 18;
  else if (a === "armor_crystal") bonusDef += 42;
  return {
    bonusAtk: bonusAtk,
    bonusDef: bonusDef
  };
}
async function renderAdventureUI(sock, ctx, session, battleLog = "") {
  const prefix = ctx.prefix || ".";
  const user = global.db.user[session.sender];
  const {
    bonusAtk,
    bonusDef
  } = getEquipmentStats(user);
  const totalAtk = (user.atk || 10) + bonusAtk;
  const totalDef = (user.def || 5) + bonusDef;
  const playerHpRatio = Math.max(1, Math.ceil(user.hp / user.hpMax * 5));
  const monsterHpRatio = Math.max(1, Math.ceil(session.monsterHp / session.monsterMaxHp * 5));
  const text = `╭───『 *DUNGEON RAID: FLOOR ${session.floor}* 』\n` + `│ 👤 *Pemain:* ${user.name} (Lv. ${user.level})\n` + `│ • HP: \`${user.hp}/${user.hpMax}\` ${"❤️".repeat(playerHpRatio)}\n` + `│ • Mana: \`${user.mana}/${user.manaMax}\` 🔮\n` + `│ • Status: ⚔️ ${totalAtk} ATK | 🛡️ ${totalDef} DEF\n` + `├────────────────────────\n` + `│ 👹 *Musuh:* ${session.monster.name}\n` + `│ • HP: \`${session.monsterHp}/${session.monsterMaxHp}\` ${"🖤".repeat(monsterHpRatio)}\n` + `│ • ATK: ${session.monster.atk} | DEF: ${session.monster.def}\n` + `╰────────────────────────\n\n` + (battleLog ? `📜 *Laporan Pertarungan:*\n${battleLog}\n\n` : "") + `_Pilih aksi tindakan kamu di bawah untuk melanjutkan:_`;
  const buttons = [{
    name: "quick_reply",
    display_text: "🗡️ Serang Fisik",
    id: `${prefix}adv serang`
  }, {
    name: "quick_reply",
    display_text: "🔮 Skill Sihir (20 MP)",
    id: `${prefix}adv sihir`
  }, {
    name: "quick_reply",
    display_text: "🧪 Minum Potion",
    id: `${prefix}adv heal`
  }, {
    name: "quick_reply",
    display_text: "🏃 Kabur",
    id: `${prefix}adv kabur`
  }];
  if (typeof ctx.sendCta === "function") {
    return await ctx.sendCta(text, `${global.bot?.name || "RPG"} • Dungeon Raid`, buttons, {
      title: `⚔️ BATTLE: ${session.monster.name.toUpperCase()}`,
      quoted: session.lastMsg
    });
  }
  return await ctx.reply(text);
}
export default {
  name: "adventure",
  aliases: ["adv", "dungeon", "petualang"],
  description: "Menjelajahi dungeon bersesi dan bertarung dengan monster",
  category: "RPG",
  register: true,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const sender = ctx.sender;
      if (!global.adventureSession.has(sender)) return;
      const raw = (ctx.text || ctx.body || "").toLowerCase().trim();
      const prefix = ctx.prefix || ".";
      if (["serang", "attack", "sihir", "magic", "heal", "potion", "kabur", "run"].some(cmd => raw.endsWith(cmd))) {
        const action = raw.replace(/^[.!/#]?\s*(adv|adventure|dungeon)\s*/i, "").trim();
        const session = global.adventureSession.get(sender);
        const user = global.db.user[sender];
        const {
          bonusAtk,
          bonusDef
        } = getEquipmentStats(user);
        const totalAtk = (user.atk || 10) + bonusAtk;
        const totalDef = (user.def || 5) + bonusDef;
        let log = "";
        if (action === "kabur" || action === "run") {
          clearTimeout(session.timer);
          global.adventureSession.delete(sender);
          await ctx.react("🏃");
          return ctx.reply(`🏃 Kamu berhasil melarikan diri dari ${session.monster.name} dengan selamat!`);
        }
        if (action === "heal" || action === "potion") {
          if (user.inventory.drink.elixir > 0 || user.inventory.drink.herbal_tea > 0 || user.inventory.food.grilled_fish > 0 || user.inventory.food.bread > 0) {
            let healVal = 40;
            if (user.inventory.drink.elixir > 0) {
              user.inventory.drink.elixir -= 1;
              healVal = 100;
            } else if (user.inventory.drink.herbal_tea > 0) {
              user.inventory.drink.herbal_tea -= 1;
              healVal = 60;
            } else if (user.inventory.food.grilled_fish > 0) {
              user.inventory.food.grilled_fish -= 1;
              healVal = 50;
            } else {
              user.inventory.food.bread -= 1;
              healVal = 35;
            }
            user.hp = Math.min(user.hpMax, user.hp + healVal);
            log += `🧪 Kamu memulihkan *+${healVal} HP*! `;
          } else {
            return ctx.reply(`❌ Kamu tidak memiliki makanan / ramuan di tas! Buat di \`${prefix}craft\` atau istirahat di \`${prefix}rest\`.`);
          }
        }
        if (action === "sihir" || action === "magic") {
          if (user.mana < 20) {
            return ctx.reply("❌ Mana tidak mencukupi untuk mantra sihir! (Butuh 20 MP)");
          }
          user.mana -= 20;
          const magicDmg = Math.max(15, Math.floor(totalAtk * 1.7 + Math.random() * 25));
          session.monsterHp -= magicDmg;
          log += `🔮 Serangan Sihir menghasilkan *${magicDmg} DMG*! `;
        }
        if (action === "serang" || action === "attack") {
          const dmg = Math.max(8, Math.floor(totalAtk - session.monster.def * .35 + Math.random() * 12));
          session.monsterHp -= dmg;
          log += `🗡️ Tebasan pedangmu memberikan *${dmg} DMG*! `;
        }
        if (session.monsterHp <= 0) {
          clearTimeout(session.timer);
          global.adventureSession.delete(sender);
          const m = session.monster;
          user.exp += m.exp;
          user.money += m.money;
          if (m.ore) user.inventory.ores[m.ore] = (user.inventory.ores[m.ore] || 0) + 1;
          if (m.crate) user.inventory.crate[m.crate] = (user.inventory.crate[m.crate] || 0) + 1;
          if (Math.random() < .5) user.inventory.nature.leather = (user.inventory.nature.leather || 0) + 1;
          db.write(global.db);
          await ctx.react("🏆");
          const winText = `🎉 *VICTORY! DUNGEON CLEARED!* 🎉\n\n` + `Kamu berhasil menumbangkan *${m.name}*!\n\n` + `🎁 *Hadiah Diperoleh:*\n` + `• 💵 Uang: +Rp ${m.money.toLocaleString("id-ID")}\n` + `• ✨ EXP: +${m.exp}\n` + `• 💎 Hasil Tambang: +1 ${m.ore.toUpperCase()}\n` + `• 📦 Peti Hadiah: +1 ${m.crate.toUpperCase()} CRATE\n` + `• 🥩 Bahan: +1 Kulit Hewan (Leather)`;
          const winButtons = [{
            name: "quick_reply",
            display_text: "⚔️ Bertualang Lagi",
            id: `${prefix}adv`
          }, {
            name: "quick_reply",
            display_text: "⛺ Berkemah & Pulih",
            id: `${prefix}rest`
          }, {
            name: "quick_reply",
            display_text: "🎒 Cek Inventory",
            id: `${prefix}inv`
          }];
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(winText, `${global.bot?.name || "RPG"} • Victory Reward`, winButtons, {
              title: "🏆 RAID SELESAI",
              quoted: msg
            });
          }
          return await ctx.reply(winText);
        }
        const enemyDmg = Math.max(5, Math.floor(session.monster.atk - totalDef * .45 + Math.random() * 10));
        user.hp = Math.max(0, user.hp - enemyDmg);
        log += `\n👹 ${session.monster.name} menyerang balik sebesar *${enemyDmg} DMG*!`;
        if (user.hp <= 0) {
          clearTimeout(session.timer);
          global.adventureSession.delete(sender);
          user.hp = Math.floor(user.hpMax * .25);
          const penaltyExp = Math.min(user.exp, 60);
          user.exp -= penaltyExp;
          db.write(global.db);
          await ctx.react("☠️");
          return ctx.reply(`☠️ *KAMU GUGUR DI DALAM DUNGEON!*\n\n` + `${session.monster.name} berhasil mengalahkanmu.\n` + `• Penalti EXP: -${penaltyExp}\n` + `• Darah tersisa 25%. Segera berkemah dengan \`${prefix}rest\`!`);
        }
        db.write(global.db);
        session.lastMsg = msg;
        await renderAdventureUI(sock, ctx, session, log);
        return true;
      }
    } catch (err) {
      console.error("[Adventure Error]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      if (global.adventureSession.has(ctx.sender)) {
        const session = global.adventureSession.get(ctx.sender);
        return await renderAdventureUI(sock, ctx, session, "Pertarunganmu masih aktif!");
      }
      if (user.hp < 30) {
        return ctx.reply(`❤️ *DARAH TERLALU RENDAH (${user.hp}/${user.hpMax})*\n\n` + `Pulihkan HP kamu terlebih dahulu sebelum masuk dungeon:\n` + `👉 Ketik \`${prefix}rest\` untuk tidur di perkemahan.`);
      }
      const now = Date.now();
      const COOLDOWN = 3 * 60 * 1e3;
      if (user.cooldown?.adventure && now - user.cooldown.adventure < COOLDOWN) {
        const sisa = COOLDOWN - (now - user.cooldown.adventure);
        const m = Math.floor(sisa / 6e4);
        const s = Math.floor(sisa % 6e4 / 1e3);
        return ctx.reply(`⏳ Kamu masih memulihkan stamina!\n🕐 Cooldown: *${m}m ${s}d*.`);
      }
      const floorIdx = Math.min(DUNGEON_MONSTERS.length - 1, Math.floor((user.level - 1) / 3));
      const monster = DUNGEON_MONSTERS[floorIdx];
      const sessionObj = {
        sender: ctx.sender,
        floor: floorIdx + 1,
        monster: monster,
        monsterHp: monster.hp,
        monsterMaxHp: monster.hp,
        lastMsg: msg,
        timer: setTimeout(() => {
          if (global.adventureSession.has(ctx.sender)) {
            global.adventureSession.delete(ctx.sender);
            ctx.reply(`⏰ Sesi dungeon berakhir! ${monster.name} kabur ke dalam kegelapan.`);
          }
        }, 12e4)
      };
      global.adventureSession.set(ctx.sender, sessionObj);
      user.cooldown.adventure = now;
      db.write(global.db);
      await ctx.react("⚔️");
      await renderAdventureUI(sock, ctx, sessionObj, `Kamu bertemu dengan monster liar ${monster.name}!`);
    } catch (err) {
      console.error("[Adventure Exec Error]:", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};