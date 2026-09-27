import {
  simpleQuoted
} from "../../lib/quoted.js";
const STATS_MAP = {
  level: {
    icon: "🎖️",
    label: "Level",
    unit: "Lv."
  },
  money: {
    icon: "💰",
    label: "Money",
    unit: "Rp"
  },
  mcoin: {
    icon: "🪙",
    label: "M-Coin",
    unit: "MC"
  },
  exp: {
    icon: "✨",
    label: "EXP",
    unit: "XP"
  },
  atk: {
    icon: "⚔️",
    label: "Attack",
    unit: "ATK"
  },
  def: {
    icon: "🛡️",
    label: "Defense",
    unit: "DEF"
  },
  hp: {
    icon: "❤️",
    label: "HP",
    unit: "HP"
  },
  hpmax: {
    icon: "💖",
    label: "Max HP",
    unit: "Max HP",
    key: "hpMax"
  },
  mana: {
    icon: "🧪",
    label: "Mana",
    unit: "MP"
  },
  manamax: {
    icon: "🔷",
    label: "Max Mana",
    unit: "Max MP",
    key: "manaMax"
  },
  limit: {
    icon: "🎫",
    label: "Limit",
    unit: "Tiket"
  }
};
const ALIAS_MAP = {
  saldo: "money",
  koin: "money",
  xp: "exp",
  lvl: "level",
  darah: "hp",
  mp: "mana",
  maxhp: "hpmax",
  maxmana: "manamax",
  damage: "atk",
  defense: "def"
};
export default {
  name: "leaderboard",
  aliases: ["lb", "top", "ranking", "topplayer"],
  description: "Papan peringkat lengkap seluruh status RPG dengan CTA Sheet & Pagination",
  category: "RPG",
  example: ".lb atau .lb money atau .lb atk -p 2",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WhatsApp Bot";
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawInput = (ctx.args?.join(" ") || ctx.text || "").trim();
      const pageMatch = rawInput.match(/(?:--page|-p)\s+(\d+)/i);
      let page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const cleanArgs = rawInput.replace(/(?:--page|-p)\s+\d+/gi, "").trim().split(/\s+/).filter(Boolean);
      let inputCategory = (cleanArgs[0] || "level").toLowerCase();
      if (ALIAS_MAP[inputCategory]) inputCategory = ALIAS_MAP[inputCategory];
      if (!STATS_MAP[inputCategory]) inputCategory = "level";
      const currentStat = STATS_MAP[inputCategory];
      const targetDbKey = currentStat.key || inputCategory;
      const usersData = global.db?.user || global.db?.data?.user || {};
      const allUsers = Object.entries(usersData).filter(([, u]) => u && typeof u === "object");
      if (allUsers.length === 0) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Belum ada data pemain di database!");
      }
      const sorted = allUsers.filter(([, u]) => typeof u[targetDbKey] === "number").sort((a, b) => (Number(b[1][targetDbKey]) || 0) - (Number(a[1][targetDbKey]) || 0));
      const itemsPerPage = 10;
      const totalPages = Math.ceil(sorted.length / itemsPerPage) || 1;
      if (page < 1) page = 1;
      if (page > totalPages) page = totalPages;
      const startIndex = (page - 1) * itemsPerPage;
      const currentPageItems = sorted.slice(startIndex, startIndex + itemsPerPage);
      const medals = ["🥇", "🥈", "🥉"];
      const playerRows = currentPageItems.map(([jid, u], index) => {
        const realRank = startIndex + index + 1;
        const rankBadge = medals[realRank - 1] || `#${realRank}`;
        const phone = jid.split("@")[0];
        const name = String(u.name || phone).slice(0, 20);
        const statValue = (Number(u[targetDbKey]) || 0).toLocaleString("id-ID");
        return {
          title: `${rankBadge} ${name}`,
          id: `${prefix}me @${phone}`,
          description: `${currentStat.icon} ${currentStat.label}: ${statValue} ${currentStat.unit} | Lv. ${u.level || 1}`
        };
      });
      const categoryRows = Object.entries(STATS_MAP).map(([catKey, info]) => ({
        title: `${info.icon} Top ${info.label}`,
        id: `${prefix}lb ${catKey}`,
        description: `Lihat peringkat pemain dengan ${info.label} tertinggi`
      }));
      const listSections = [{
        title: `🏆 TOP ${currentStat.label.toUpperCase()} (Hal ${page}/${totalPages})`,
        rows: playerRows
      }, {
        title: "🔄 PILIH STATISTIK LAINNYA",
        rows: categoryRows
      }];
      const myRank = sorted.findIndex(([jid]) => jid === ctx.sender) + 1;
      const myData = usersData[ctx.sender] || {};
      const myVal = (Number(myData[targetDbKey]) || 0).toLocaleString("id-ID");
      const bodyText = `🏆 *RPG LEADERBOARD SYSTEM* 🏆\n\n` + `• *Statistik:* ${currentStat.icon} \`${currentStat.label.toUpperCase()}\`\n` + `• *Halaman:* ${page} dari ${totalPages}\n` + `• *Total Pemain:* ${sorted.length} Player\n` + `• *Peringkat Kamu:* #${myRank > 0 ? myRank : "N/A"} (${myVal} ${currentStat.unit})\n\n` + `_Buka menu sheet di bawah untuk melihat list pemain atau mengganti statistik. Ketuk pemain untuk cek detail profilnya._`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 DAFTAR PERINGKAT (${currentStat.label.toUpperCase()})`,
          sections: listSections
        })
      }];
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${prefix}lb ${inputCategory} -p ${page - 1}`
          })
        });
      }
      if (page < totalPages) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${prefix}lb ${inputCategory} -p ${page + 1}`
          })
        });
      }
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • RPG Leaderboard`,
            button_title: `Lihat Top ${currentStat.label}`
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • RPG System`, buttons, options);
      } else {
        await sock.sendMessage(ctx.id || ctx.chat, {
          image: {
            url: bannerImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react?.("✅");
    } catch (error) {
      console.error("[Leaderboard Error]:", error?.message || error);
      await ctx.react?.("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${error.message}`);
    }
  }
};