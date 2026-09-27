import axios from "axios";
import {
  makeJid
} from "../../core/tools.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function createProgressBar(current, max, length = 8) {
  const safeCurrent = Math.max(0, current);
  const safeMax = Math.max(1, max);
  const percentage = Math.min(100, Math.round(safeCurrent / safeMax * 100));
  const filled = Math.round(percentage / 100 * length);
  const empty = length - filled;
  const bar = "█".repeat(filled) + "░".repeat(Math.max(0, empty));
  return `${bar} ${percentage}% (${safeCurrent}/${safeMax})`;
}
export default {
  name: "userinfo",
  aliases: ["profil", "profile", "info", "me"],
  description: "Lihat informasi profil user via Interactive ID Card Maker & CTA Sheet",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      let targetJid = ctx.sender;
      if (ctx.args && ctx.args[0]) {
        const cleanSender = ctx.sender.replace(/\D/g, "");
        const owners = (global.bot?.owner || []).map(v => String(v).replace(/\D/g, ""));
        const isOwner = owners.includes(cleanSender) || global.db?.user?.[ctx.sender]?.ownerAcces === true;
        if (!isOwner) {
          return ctx.reply("❌ Kamu tidak memiliki izin untuk melihat profil user lain!");
        }
        targetJid = ctx.mentionedJid?.[0] || makeJid(ctx.args[0]);
      }
      await ctx.react("⏳");
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(targetJid, targetJid.split("@")[0]);
      }
      const user = global.db?.user?.[targetJid] || {};
      const isPremium = user.premium?.status === true;
      const isOwner = user.ownerAcces === true;
      const now = Date.now();
      let premiumText = "Free User 👤";
      if (isOwner) {
        premiumText = "BOT OWNER 👑";
      } else if (isPremium) {
        if (user.premium.expiredAt === Number.MAX_SAFE_INTEGER) {
          premiumText = "PREMIUM LIFETIME ⭐";
        } else {
          const remaining = user.premium.expiredAt - now;
          if (remaining > 0) {
            const d = Math.floor(remaining / 864e5);
            const h = Math.floor(remaining % 864e5 / 36e5);
            premiumText = `PREMIUM (${d}h ${h}j tersisa) ⭐`;
          } else {
            premiumText = "EXPIRED ⚠️";
          }
        }
      }
      const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Baru saja";
      const hpCurrent = user.hp ?? 100;
      const hpMax = user.hpMax ?? 100;
      const manaCurrent = user.mana ?? 50;
      const manaMax = user.manaMax ?? 50;
      const userName = user.name || ctx.pushname || targetJid.split("@")[0];
      const targetNumber = targetJid.split("@")[0];
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(targetJid, "image");
      } catch {}
      let mediaOutput = profilePic;
      try {
        const idCardPayload = {
          header: "NEBULA MECHA",
          tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
          avatar: profilePic,
          badge: `SECURITY LVL ${user.level || 1}`,
          info_pre: "✦ RPG PLAYER ID ✦",
          info_badge: isOwner ? "BOT OWNER" : isPremium ? "MECHA PRO" : "STANDARD",
          name: userName.slice(0, 20).toUpperCase(),
          badge_line: isOwner ? "SYSTEM OPERATOR" : `LEVEL ${user.level || 1} ADVENTURER`,
          role: isOwner ? "ROOT SYSTEM ADMIN" : isPremium ? "ORION RESEARCH · VIP" : "PLAYER DIVISION",
          email: `${targetNumber}@whatsapp.net`,
          phone: `+${targetNumber}`,
          pin: `EXP: ${(user.exp || 0).toLocaleString("id-ID")}`,
          valid: isOwner || isPremium && user.premium?.expiredAt === Number.MAX_SAFE_INTEGER ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: NEB-ROOT" : `CLEARANCE: NEB-${user.level || 1}`,
          mag: `RP ${(user.money || 0).toLocaleString("id-ID")}`
        };
        const {
          data
        } = await axios.post("https://wudysoft.my.id/api/maker/id/v1", idCardPayload, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 2e4
        });
        if (data) {
          mediaOutput = Buffer.from(data);
        }
      } catch (err) {
        console.warn("[Userinfo ID Card Fail, using Avatar fallback]:", err.message);
      }
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const bodyText = `╭───『 *USER PROFILE* 』\n` + `│ 👤 *Nama:* ${userName}\n` + `│ 📱 *Kontak:* @${targetNumber}\n` + `│ 🏷️ *Status:* ${premiumText}\n` + `│ 📅 *Terdaftar:* ${createdDate}\n` + `╰──────────────────\n\n` + `╭───『 *RPG ATTRIBUTES* 』\n` + `│ ❤️ *HP:*  ${createProgressBar(hpCurrent, hpMax)}\n` + `│ 💧 *MANA:* ${createProgressBar(manaCurrent, manaMax)}\n` + `│ 🎖️ *Level:* Lv. ${user.level || 1}\n` + `│ ✨ *EXP:* ${(user.exp || 0).toLocaleString("id-ID")} XP\n` + `│ ⚔️ *ATK:* ${user.atk || 10}  |  🛡️ *DEF:* ${user.def || 5}\n` + `╰──────────────────\n\n` + `╭───『 *INVENTORY & SISA* 』\n` + `│ 🎫 *Sisa Limit:* ${isOwner || isPremium ? "Unlimited ♾️" : user.limit ?? 0}\n` + `│ 💰 *Saldo:* Rp ${(user.money || 0).toLocaleString("id-ID")}\n` + `╰──────────────────\n\n` + `_Ketuk tombol di bawah untuk membuka menu aksi RPG dan karakter:_`;
      const footerText = `${botName} • Player RPG System`;
      const actionRows = [{
        title: "🎁 KLAIM DAILY REWARD",
        id: `${prefix}daily`,
        description: "Ambil bonus limit, EXP, dan koin harian"
      }, {
        title: "🎒 BUKA INVENTORY",
        id: `${prefix}inventory`,
        description: "Lihat koleksi item, senjata, dan potion"
      }, {
        title: "🏆 LEADERBOARD RANKING",
        id: `${prefix}leaderboard`,
        description: "Cek peringkat pemain level & saldo tertinggi"
      }, {
        title: "🛒 TOKO / SHOP ITEM",
        id: `${prefix}shop`,
        description: "Beli potion, upgrade senjata, dan tambah limit"
      }];
      const buttons = [{
        name: "cta_copy",
        display_text: "📋 Salin User JID",
        copy_code: targetJid
      }, {
        name: "single_select",
        title: "⚡ MENU AKSI KARAKTER",
        sections: [{
          title: `${botName} • Quick RPG Actions`,
          rows: actionRows
        }]
      }];
      const options = {
        image: mediaOutput,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Menu Karakter`,
            button_title: "⚡ Aksi Karakter"
          }
        },
        contextInfo: {
          mentionedJid: [targetJid],
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: Buffer.isBuffer(mediaOutput) ? mediaOutput : {
            url: mediaOutput
          },
          caption: bodyText,
          mentions: [targetJid]
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[USERINFO ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat profil: ${e.message}`);
    }
  }
};