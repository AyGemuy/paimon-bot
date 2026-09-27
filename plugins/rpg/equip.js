import db from "../../data/db.js";
const WEAPON_DATA = {
  sword_stone: {
    name: "Pedang Batu",
    atk: 8,
    emoji: "🗡️"
  },
  sword_iron: {
    name: "Pedang Besi",
    atk: 18,
    emoji: "⚔️"
  },
  sword_diamond: {
    name: "Pedang Berlian",
    atk: 35,
    emoji: "💠"
  },
  sword_light: {
    name: "Pedang Cahaya Suci",
    atk: 60,
    emoji: "☀️"
  },
  sword_dark: {
    name: "Pedang Kegelapan",
    atk: 85,
    emoji: "🌑"
  }
};
const ARMOR_DATA = {
  armor_leather: {
    name: "Zirah Kulit",
    def: 6,
    emoji: "🟤"
  },
  armor_iron: {
    name: "Zirah Besi",
    def: 15,
    emoji: "🔩"
  },
  armor_crystal: {
    name: "Zirah Kristal Abadi",
    def: 32,
    emoji: "💎"
  }
};
export default {
  name: "equip",
  aliases: ["pasang", "unequip", "lepas", "equipment", "pakai"],
  description: "Memasang dan melepas senjata atau baju zirah untuk meningkatkan ATK/DEF",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.cmd || "").toLowerCase();
      const botName = global.bot?.name || "Wudysoft Bot";
      if (!user.equipped) {
        user.equipped = {
          weapon: null,
          armor: null
        };
      }
      if (cmd === "unequip" || cmd === "lepas") {
        const slot = (ctx.args[0] || "").toLowerCase();
        if (slot === "weapon" || slot === "senjata" || slot === "pedang") {
          if (!user.equipped.weapon) return ctx.reply(`⚠️ Kamu sedang tidak memasang senjata apapun.`);
          const oldWpn = user.equipped.weapon;
          user.equipped.weapon = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`🔓 Senjata *${WEAPON_DATA[oldWpn]?.name || oldWpn}* berhasil dilepas.`);
        }
        if (slot === "armor" || slot === "zirah" || slot === "baju") {
          if (!user.equipped.armor) return ctx.reply(`⚠️ Kamu sedang tidak memakai baju zirah apapun.`);
          const oldArm = user.equipped.armor;
          user.equipped.armor = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`🔓 Baju Zirah *${ARMOR_DATA[oldArm]?.name || oldArm}* berhasil dilepas.`);
        }
        if (slot === "all" || slot === "semua") {
          user.equipped.weapon = null;
          user.equipped.armor = null;
          db.write(global.db);
          await ctx.react("🔓");
          return ctx.reply(`🔓 Seluruh senjata dan baju zirah telah dilepas.`);
        }
        return ctx.reply(`❓ *Cara Melepas Perlengkapan:*\n\n` + `• Lepas Senjata: \`${prefix}lepas weapon\`\n` + `• Lepas Zirah: \`${prefix}lepas armor\`\n` + `• Lepas Semua: \`${prefix}lepas all\``);
      }
      const itemKey = (ctx.args[0] || "").toLowerCase().replace(/\s+/g, "_");
      if (itemKey) {
        if (WEAPON_DATA[itemKey]) {
          const wpn = WEAPON_DATA[itemKey];
          if ((user.inventory.weapon[itemKey] || 0) <= 0) {
            return ctx.reply(`❌ Kamu tidak memiliki *${wpn.name}* di dalam tas!\nTempa senjata di \`${prefix}craft\`.`);
          }
          user.equipped.weapon = itemKey;
          db.write(global.db);
          await ctx.react("⚔️");
          const equipText = `⚔️ *SENJATA BERHASIL DIPASANG!*\n\n` + `• *Senjata:* ${wpn.emoji} ${wpn.name}\n` + `• ⚡ *Bonus Status:* \`+${wpn.atk} ATK Tempur\`\n` + `• 🗡️ *Total ATK Sekarang:* \`${user.atk + wpn.atk} ATK\`\n\n` + `_Senjata siap digunakan untuk bertarung di \`${prefix}adv\`!_`;
          const buttons = [{
            name: "quick_reply",
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}adv`
          }, {
            name: "quick_reply",
            display_text: "🎒 Cek Inventory",
            id: `${prefix}inv`
          }];
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(equipText, `${botName} • Equipment System`, buttons, {
              title: "⚔️ SENJATA AKTIF",
              quoted: msg
            });
          }
          return await ctx.reply(equipText);
        }
        if (ARMOR_DATA[itemKey]) {
          const arm = ARMOR_DATA[itemKey];
          if ((user.inventory.armor[itemKey] || 0) <= 0) {
            return ctx.reply(`❌ Kamu tidak memiliki *${arm.name}* di dalam tas!\nTempa zirah di \`${prefix}craft\`.`);
          }
          user.equipped.armor = itemKey;
          db.write(global.db);
          await ctx.react("🛡️");
          const equipText = `🛡️ *BAJU ZIRAH BERHASIL DIPASANG!*\n\n` + `• *Zirah:* ${arm.emoji} ${arm.name}\n` + `• 🛡️ *Bonus Pertahanan:* \`+${arm.def} DEF Tempur\`\n` + `• 🛡️ *Total DEF Sekarang:* \`${user.def + arm.def} DEF\`\n\n` + `_Pertahananmu meningkat untuk menahan serangan monster!_`;
          const buttons = [{
            name: "quick_reply",
            display_text: "⚔️ Masuk Dungeon",
            id: `${prefix}adv`
          }, {
            name: "quick_reply",
            display_text: "🎒 Cek Inventory",
            id: `${prefix}inv`
          }];
          if (typeof ctx.sendCta === "function") {
            return await ctx.sendCta(equipText, `${botName} • Equipment System`, buttons, {
              title: "🛡️ ARMOR AKTIF",
              quoted: msg
            });
          }
          return await ctx.reply(equipText);
        }
        return ctx.reply(`❌ Item *"${itemKey}"* bukan senjata atau armor yang valid!`);
      }
      const curWpnKey = user.equipped.weapon;
      const curArmKey = user.equipped.armor;
      const curWpn = curWpnKey && WEAPON_DATA[curWpnKey] ? WEAPON_DATA[curWpnKey] : null;
      const curArm = curArmKey && ARMOR_DATA[curArmKey] ? ARMOR_DATA[curArmKey] : null;
      const totalAtk = user.atk + (curWpn?.atk || 0);
      const totalDef = user.def + (curArm?.def || 0);
      const ownedWeapons = Object.keys(WEAPON_DATA).filter(k => (user.inventory.weapon[k] || 0) > 0);
      const ownedArmors = Object.keys(ARMOR_DATA).filter(k => (user.inventory.armor[k] || 0) > 0);
      const availableRows = [];
      for (const wKey of ownedWeapons) {
        const item = WEAPON_DATA[wKey];
        const isEquipped = curWpnKey === wKey;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${isEquipped ? "[DIPAKAI]" : ""}`.slice(0, 24),
          description: `+${item.atk} ATK (${user.inventory.weapon[wKey]} buah)`,
          id: `${prefix}equip ${wKey}`
        });
      }
      for (const aKey of ownedArmors) {
        const item = ARMOR_DATA[aKey];
        const isEquipped = curArmKey === aKey;
        availableRows.push({
          title: `${item.emoji} ${item.name} ${isEquipped ? "[DIPAKAI]" : ""}`.slice(0, 24),
          description: `+${item.def} DEF (${user.inventory.armor[aKey]} buah)`,
          id: `${prefix}equip ${aKey}`
        });
      }
      const bodyText = `╭───『 *STATUS PERLENGKAPAN TEMPUR* 』\n` + `│ 👤 *Pemain:* @${ctx.sender.split("@")[0]}\n` + `│ ⚔️ *Total ATK:* \`${totalAtk} ATK\` (Dasar: ${user.atk} + Senjata: ${curWpn?.atk || 0})\n` + `│ 🛡️ *Total DEF:* \`${totalDef} DEF\` (Dasar: ${user.def} + Zirah: ${curArm?.def || 0})\n` + `├────────────────────────\n` + `│ 🗡️ *Slot Senjata:* ${curWpn ? `${curWpn.emoji} ${curWpn.name} (+${curWpn.atk} ATK)` : "Tangan Kosong"}\n` + `│ 🛡️ *Slot Zirah:* ${curArm ? `${curArm.emoji} ${curArm.name} (+${curArm.def} DEF)` : "Pakaian Biasa"}\n` + `╰────────────────────────\n\n` + `_Pilih perlengkapan dari tas di bawah untuk langsung memakainya:_`;
      const buttons = [];
      if (availableRows.length > 0) {
        buttons.push({
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚔️ Pasang Perlengkapan dari Tas",
            sections: [{
              title: `Perlengkapan Milikmu (${availableRows.length})`,
              rows: availableRows
            }]
          })
        });
      }
      buttons.push({
        name: "quick_reply",
        display_text: "⚔️ Masuk Dungeon",
        id: `${prefix}adv`
      }, {
        name: "quick_reply",
        display_text: "🔓 Lepas Senjata",
        id: `${prefix}lepas weapon`
      }, {
        name: "quick_reply",
        display_text: "🔓 Lepas Zirah",
        id: `${prefix}lepas armor`
      });
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • Equipment Management`, buttons, {
          title: "🛡️ RPG EQUIPMENT SHEET",
          mentions: [ctx.sender],
          quoted: msg
        });
      }
      let fallbackText = bodyText + `\n\n👉 *Pasang:* \`${prefix}equip <nama_item>\`\n👉 *Lepas:* \`${prefix}lepas weapon/armor\``;
      return await ctx.reply(fallbackText, {
        mentions: [ctx.sender]
      });
    } catch (err) {
      console.error("[EQUIP ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};