import axios from "axios";
import {
  makeJid
} from "../../core/tools.js";
import db from "../../data/db.js";
export default [{
  name: "limit",
  aliases: ["ceklimit", "checklimit", "rank"],
  description: "Cek sisa limit dan kartu rank RPG kamu",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const chatId = ctx.id || ctx.from;
      const sender = ctx.sender;
      db.ensureUser(sender, ctx.pushname || sender.split("@")[0]);
      const user = global.db.user[sender] || {};
      const isPremium = user.premium?.status === true;
      const isOwner = user.ownerAcces === true;
      const userName = user.name || ctx.pushname || sender.split("@")[0];
      let expiredText = "";
      if (isPremium && user.premium.expiredAt !== Number.MAX_SAFE_INTEGER) {
        const remaining = user.premium.expiredAt - Date.now();
        if (remaining > 0) {
          const d = Math.floor(remaining / 864e5);
          const h = Math.floor(remaining % 864e5 / 36e5);
          expiredText = `\n│ ⏳ Expired: ${d} Hari ${h} Jam`;
        }
      }
      const allUsers = Object.entries(global.db?.user || {}).map(([jid, data]) => ({
        jid: jid,
        level: data.level || 1,
        exp: data.exp || 0
      })).sort((a, b) => b.level - a.level || b.exp - a.exp);
      const userRank = Math.max(1, allUsers.findIndex(u => u.jid === sender) + 1);
      const userLevel = user.level || 1;
      const currentXp = user.exp || 0;
      const requiredXp = user.requiredExp || userLevel * 500;
      const userStatus = isOwner ? "dnd" : isPremium ? "idle" : "online";
      const borderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "00b4d8";
      let avatarUrl = global.bot?.media.avatar;
      try {
        avatarUrl = await sock.profilePictureUrl(sender, "image");
      } catch {}
      let rankCardBuffer = null;
      try {
        const {
          data
        } = await axios.post("https://wudysoft.my.id/api/canvas/canvafy/rank", {
          username: userName.slice(0, 16),
          avatar: avatarUrl,
          status: userStatus,
          level: userLevel,
          rank: userRank,
          currentXp: currentXp,
          requiredXp: requiredXp,
          borderColor: borderColor
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 15e3
        });
        if (data) rankCardBuffer = Buffer.from(data);
      } catch (err) {
        console.error("Gagal mengambil Canvafy rank card:", err.message);
      }
      const captionText = `╭───〔 *USER & LIMIT INFO* 〕───⬿\n` + `│ 👤 *Nama:* ${userName}\n` + `│ 🏆 *Rank:* #${userRank} (Lv. ${userLevel})\n` + `│ ✨ *EXP:* ${currentXp.toLocaleString("id-ID")} / ${requiredXp.toLocaleString("id-ID")}\n` + `│ 💳 *Limit:* ${isOwner ? "Unlimited (Owner) 👑" : isPremium ? "Unlimited (Premium) ⭐" : `${user.limit ?? 0} / ${global.bot?.defaultLimit || 20}`}\n` + `│ 🏷️ *Status:* ${isOwner ? "Owner 👑" : isPremium ? "Premium 💎" : "Free User 👤"}${expiredText}\n` + `│\n` + `│ 💡 *Tips:* Ketik *${ctx.prefix || "."}levelup* jika EXP sudah cukup!\n` + `╰─────────────────────────⬿`;
      if (rankCardBuffer) {
        await sock.sendMessage(chatId, {
          image: rankCardBuffer,
          caption: captionText,
          mentions: [sender]
        }, {
          quoted: msg
        });
      } else {
        await ctx.reply(captionText);
      }
      await ctx.react?.("✅");
    } catch (e) {
      await ctx.react?.("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "levelup",
  aliases: ["up", "naiklevel", "lvlup"],
  description: "Naikkan level karakter RPG dengan EXP yang kamu kumpulkan",
  category: "RPG",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react?.("⏳");
      const chatId = ctx.id || ctx.from;
      const sender = ctx.sender;
      db.ensureUser(sender, ctx.pushname || sender.split("@")[0]);
      const user = global.db.user[sender];
      const isOwner = user.ownerAcces === true;
      const isPremium = user.premium?.status === true;
      const userName = user.name || ctx.pushname || sender.split("@")[0];
      const currentLevel = user.level || 1;
      const currentExp = user.exp || 0;
      const requiredExp = currentLevel * 500;
      if (currentExp < requiredExp) {
        await ctx.react?.("❌");
        return ctx.reply(`╭───〔 *LEVEL UP GAGAL* 〕───⬿\n` + `│ 👤 *Nama:* ${userName}\n` + `│ 🎖️ *Level Sekarang:* Lv. ${currentLevel}\n` + `│ ✨ *EXP Kamu:* ${currentExp.toLocaleString("id-ID")} XP\n` + `│ 🎯 *Target EXP:* ${requiredExp.toLocaleString("id-ID")} XP\n` + `│\n` + `│ ⚠️ Kamu masih butuh *${(requiredExp - currentExp).toLocaleString("id-ID")}* EXP lagi untuk Level Up!\n` + `╰────────────────────────⬿`);
      }
      const nextLevel = currentLevel + 1;
      const expRemaining = currentExp - requiredExp;
      const bonusMoney = nextLevel * 5e3;
      const bonusLimit = 5;
      user.level = nextLevel;
      user.exp = expRemaining;
      user.money = (user.money || 0) + bonusMoney;
      user.limit = (user.limit || 0) + bonusLimit;
      user.hpMax = (user.hpMax || 100) + 10;
      user.hp = user.hpMax;
      user.atk = (user.atk || 10) + 3;
      user.def = (user.def || 5) + 2;
      db.write(global.db);
      let avatarUrl = global.bot?.media.avatar;
      try {
        avatarUrl = await sock.profilePictureUrl(sender, "image");
      } catch {}
      const borderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "00b4d8";
      const avatarBorderColor = isOwner ? "ff0055" : isPremium ? "ffd700" : "ffffff";
      let levelUpBuffer = null;
      try {
        const {
          data
        } = await axios.post("https://wudysoft.my.id/api/canvas/canvafy/levelup", {
          avatar: avatarUrl,
          background: global.bot.media.banner1,
          username: userName.slice(0, 16),
          borderColor: borderColor,
          avatarBorderColor: avatarBorderColor,
          overlayOpacity: .7,
          currentLevel: currentLevel,
          nextLevel: nextLevel
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 15e3
        });
        if (data) levelUpBuffer = Buffer.from(data);
      } catch (err) {
        console.error("Gagal mengambil Canvafy levelup card:", err.message);
      }
      const levelUpText = `🎉 *SELAMAT! KAMU BERHASIL LEVEL UP* 🎉\n\n` + `╭───〔 *LEVEL UPGRADE* 〕───⬿\n` + `│ 👤 *Player:* ${userName}\n` + `│ 🎖️ *Level Baru:* Lv. ${currentLevel} ➔ *Lv. ${nextLevel}*\n` + `│ ✨ *Sisa EXP:* ${expRemaining.toLocaleString("id-ID")} XP\n` + `│\n` + `│ 🎁 *Hadiah Level Up:*\n` + `│ 💰 +Rp ${bonusMoney.toLocaleString("id-ID")}\n` + `│ 🎫 +${bonusLimit} Limit Tambahan\n` + `│ ❤️ Max HP meningkat ke ${user.hpMax} (Full Refill)\n` + `│ ⚔️ ATK: +3 | 🛡️ DEF: +2\n` + `╰─────────────────────────⬿`;
      if (levelUpBuffer) {
        await sock.sendMessage(chatId, {
          image: levelUpBuffer,
          caption: levelUpText,
          mentions: [sender]
        }, {
          quoted: msg
        });
      } else {
        await ctx.reply(levelUpText);
      }
      await ctx.react?.("🎉");
    } catch (e) {
      await ctx.react?.("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "addlimit",
  aliases: ["tambahlimit", "addlmt"],
  description: "Tambah limit user (Owner)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args || ctx.args.length < 2) {
        return ctx.reply(`⚡ Format: ${ctx.prefix}addlimit [nomor] [jumlah]`);
      }
      const jid = makeJid(ctx.args[0]);
      const amount = parseInt(ctx.args[1], 10);
      if (isNaN(amount) || amount <= 0) return ctx.reply("❌ Jumlah tidak valid!");
      db.ensureUser(jid, jid.split("@")[0]);
      global.db.user[jid].limit = (global.db.user[jid].limit ?? 0) + amount;
      db.write(global.db);
      ctx.reply(`✅ Berhasil menambah *${amount}* limit ke *${jid.split("@")[0]}*\nTotal limit sekarang: *${global.db.user[jid].limit}*`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}, {
  name: "setlimit",
  aliases: ["setlmt"],
  description: "Set limit user ke nilai tertentu (Owner)",
  category: "Owner",
  owner: true,
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args || ctx.args.length < 2) {
        return ctx.reply(`⚡ Format: ${ctx.prefix}setlimit [nomor] [jumlah]`);
      }
      const jid = makeJid(ctx.args[0]);
      const amount = parseInt(ctx.args[1], 10);
      if (isNaN(amount) || amount < 0) return ctx.reply("❌ Jumlah tidak valid!");
      db.ensureUser(jid, jid.split("@")[0]);
      global.db.user[jid].limit = amount;
      db.write(global.db);
      ctx.reply(`✅ Limit *${jid.split("@")[0]}* berhasil di-set ke *${amount}*`);
    } catch (e) {
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
}];