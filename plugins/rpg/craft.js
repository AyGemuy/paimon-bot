import db from "../../data/db.js";
const RECIPES = {
  sword_stone: {
    name: "Pedang Batu (Stone Sword)",
    cat: "weapon",
    stat: "+8 ATK Tempur",
    req: {
      "ores.stone": 8,
      "nature.wood": 2
    }
  },
  sword_iron: {
    name: "Pedang Besi (Iron Sword)",
    cat: "weapon",
    stat: "+18 ATK Tempur",
    req: {
      "ores.iron": 5,
      "ores.coal": 2,
      "nature.wood": 2
    }
  },
  sword_diamond: {
    name: "Pedang Berlian (Diamond Sword)",
    cat: "weapon",
    stat: "+35 ATK Tempur",
    req: {
      "ores.diamond": 3,
      "ores.gold": 2,
      "nature.wood": 3
    }
  },
  sword_light: {
    name: "Pedang Cahaya Suci (Light Sword)",
    cat: "weapon",
    stat: "+60 ATK Tempur",
    req: {
      "ores.platinum": 2,
      "ores.diamond": 5,
      "ores.gold": 5
    }
  },
  armor_leather: {
    name: "Baju Zirah Kulit (Leather Armor)",
    cat: "armor",
    stat: "+6 DEF Tempur",
    req: {
      "nature.leather": 5,
      "nature.wood": 2
    }
  },
  armor_iron: {
    name: "Baju Zirah Besi (Iron Armor)",
    cat: "armor",
    stat: "+15 DEF Tempur",
    req: {
      "ores.iron": 8,
      "nature.leather": 3
    }
  },
  armor_crystal: {
    name: "Zirah Kristal Abadi (Crystal Armor)",
    cat: "armor",
    stat: "+32 DEF Tempur",
    req: {
      "ores.diamond": 5,
      "ores.platinum": 2
    }
  },
  pickaxe_iron: {
    name: "Beliung Besi (Iron Pickaxe)",
    cat: "tools",
    stat: "+50% Hasil Tambang",
    req: {
      "ores.iron": 4,
      "nature.wood": 3
    }
  },
  pickaxe_diamond: {
    name: "Beliung Berlian (Diamond Pickaxe)",
    cat: "tools",
    stat: "+120% Hasil Tambang",
    req: {
      "ores.diamond": 3,
      "ores.gold": 1,
      "nature.wood": 3
    }
  },
  rod_wood: {
    name: "Joran Kayu Halus (Wood Rod)",
    cat: "tools",
    stat: "+40% Hasil Pancingan",
    req: {
      "nature.wood": 5,
      "nature.leather": 1
    }
  },
  grilled_fish: {
    name: "Ikan Bakar Rempah",
    cat: "food",
    stat: "Pulihkan +50 HP",
    req: {
      "fish.catfish": 2,
      "nature.spice": 1,
      "nature.wood": 1
    }
  },
  fruit_salad: {
    name: "Salad Buah Segar",
    cat: "food",
    stat: "Pulihkan +40 HP & +20 Mana",
    req: {
      "fruit.apple": 2,
      "fruit.banana": 2,
      "fruit.strawberry": 1
    }
  },
  mana_potion: {
    name: "Ramuan Mana Murni",
    cat: "drink",
    stat: "Pulihkan +30 Mana",
    req: {
      "drink.water": 1,
      "nature.spice": 2
    }
  }
};

function getNestedValue(obj, dotKey) {
  const [cat, item] = dotKey.split(".");
  return obj?.[cat]?.[item] || 0;
}

function deductNestedValue(obj, dotKey, qty) {
  const [cat, item] = dotKey.split(".");
  if (obj?.[cat]) {
    obj[cat][item] = Math.max(0, (obj[cat][item] || 0) - qty);
  }
}
export default {
  name: "craft",
  aliases: ["forge", "masak", "cooking", "nempa", "blacksmith"],
  description: "Menempa senjata, zirah, alat, dan memasak makanan via Menu List CTA",
  category: "RPG",
  register: true,
  execute: async (sock, ctx, msg) => {
    try {
      db.ensureUser(ctx.sender, ctx.pushname);
      const user = global.db.user[ctx.sender];
      const prefix = ctx.prefix || ".";
      const targetItem = (ctx.args[0] || "").toLowerCase();
      if (targetItem && RECIPES[targetItem]) {
        const recipe = RECIPES[targetItem];
        for (const [matKey, qty] of Object.entries(recipe.req)) {
          const owned = getNestedValue(user.inventory, matKey);
          if (owned < qty) {
            const matName = matKey.split(".")[1];
            return ctx.reply(`❌ Bahan tidak cukup! Kamu membutuhkan *${qty}x ${matName}* (Kamu memiliki: ${owned}).`);
          }
        }
        for (const [matKey, qty] of Object.entries(recipe.req)) {
          deductNestedValue(user.inventory, matKey, qty);
        }
        user.inventory[recipe.cat][targetItem] = (user.inventory[recipe.cat][targetItem] || 0) + 1;
        user.exp += 35;
        db.write(global.db);
        await ctx.react("🔨");
        const successText = `🎉 *PEMBUATAN BERHASIL!* ⚒️\n\n` + `Kamu berhasil membuat *${recipe.name}*!\n` + `• 🏷️ *Kategori:* [${recipe.cat.toUpperCase()}]\n` + `• ⚡ *Efek Status:* ${recipe.stat}\n` + `• ✨ *Bonus EXP:* +35\n\n` + `_Ketik \`${prefix}equip ${targetItem}\` untuk menggunakannya atau cek di \`${prefix}inv\`._`;
        const buttons = [{
          name: "quick_reply",
          display_text: "🎒 Buka Inventory",
          id: `${prefix}inv`
        }, {
          name: "quick_reply",
          display_text: "⚔️ Masuk Dungeon",
          id: `${prefix}adv`
        }];
        if (recipe.cat === "weapon" || recipe.cat === "armor") {
          buttons.unshift({
            name: "quick_reply",
            display_text: `🗡️ Pasang (${targetItem})`,
            id: `${prefix}equip ${targetItem}`
          });
        }
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(successText, `${global.bot?.name || "RPG"} • Workshop Success`, buttons, {
            title: "🔨 CRAFTING SUKSES",
            quoted: msg
          });
        }
        return await ctx.reply(successText);
      }
      const rows = Object.entries(RECIPES).map(([key, val]) => {
        const matList = Object.entries(val.req).map(([m, q]) => `${q}x ${m.split(".")[1]}`).join(", ");
        return {
          title: `🔨 ${val.name}`.slice(0, 24),
          description: `Bahan: ${matList}`,
          id: `${prefix}craft ${key}`
        };
      });
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🔨 Pilih Resep Crafting",
          sections: [{
            title: "Katalog Blacksmith & Dapur",
            rows: rows
          }]
        })
      }];
      const bodyText = `╭───『 *BLACKSMITH & ALCHEMY* 』\n` + `│ 🛠️ Buat senjata, baju zirah, alat beliung,\n` + `│ joran pancing, dan makanan pemulih dari hasil\n` + `│ tambang dan panenmu!\n` + `╰────────────────────────\n\n` + `_Pilih resep pada menu dropdown di bawah untuk langsung membuatnya:_`;
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${global.bot?.name || "RPG"} • Workshop Engine`, buttons, {
          title: "⚒️ BLACKSMITH & COOKING",
          quoted: msg
        });
      }
      let fallback = `${bodyText}\n\n`;
      fallback += Object.entries(RECIPES).map(([k, v]) => `• *${v.name}* (\`${prefix}craft ${k}\`)\n  Efek: ${v.stat}`).join("\n\n");
      return await ctx.reply(fallback);
    } catch (err) {
      console.error("[CRAFT ERROR]", err);
      ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
    }
  }
};