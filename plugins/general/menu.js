import axios from "axios";
import {
  runtime
} from "../../core/tools.js";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  resizeImage
} from "../../core/serialize.js";
export default {
  name: "menu",
  aliases: ["main", "help", "list"],
  description: "Menampilkan menu utama bot via Interactive List CTA UI dengan Custom ID Card",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const categories = global.loader?.getCommandsByCategory?.() || {};
      const categoryNames = Object.keys(categories).sort();
      const totalFitur = Object.values(categories).flat().length;
      const userData = global.db?.user?.[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const version = global.bot?.versions || "v2.0.0";
      const botUptime = runtime(process.uptime());
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const userNumber = ctx.sender.split("@")[0];
      const isOwner = userData?.ownerAcces === true || (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === userNumber);
      const isPremium = userData?.premium?.status === true || isOwner;
      const userStatus = isOwner ? "BOT OWNER 👑" : isPremium ? "PREMIUM ⭐" : "FREE USER 👤";
      const userLimit = isOwner || isPremium ? "Unlimited ♾️" : userData?.limit ?? 20;
      const userLevel = userData?.level || 1;
      const ownerNumber = Array.isArray(global.bot?.owner) ? global.bot.owner[0] : global.bot?.owner || "628xxx";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let profilePic = global.bot?.media?.avatar || "https://i.pravatar.cc/400?img=58";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      let mediaOutput = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      try {
        const idCardPayload = {
          header: "NEBULA MECHA",
          tooltip: isOwner ? "CLEARANCE: ROOT" : isPremium ? "CLEARANCE: VIP" : "CLEARANCE: ALPHA",
          avatar: profilePic,
          badge: isOwner ? "OWNER 👑" : isPremium ? "PREMIUM ⭐" : `LEVEL ${userLevel} 🎮`,
          info_pre: "✦ BOT ENGINE ✦",
          info_badge: `${totalFitur} CMDS`,
          name: userName.slice(0, 20).toUpperCase(),
          badge_line: `${botName} ${version}`,
          role: isOwner ? "ROOT SYSTEM ADMIN" : isPremium ? "VIP RESEARCHER" : "STANDARD CITIZEN",
          email: `${userNumber}@whatsapp.net`,
          phone: `+${userNumber}`,
          pin: `UPTIME: ${botUptime.slice(0, 15)}`,
          valid: isOwner || isPremium ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: ROOT" : `CLEARANCE: NEB-${userLevel}`,
          mag: isOwner || isPremium ? "LIMIT: INF" : `LIMIT: ${userLimit}`
        };
        const {
          data
        } = await axios.post("https://wudysoft.my.id/api/maker/id/v1", idCardPayload, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 15e3
        });
        if (data) {
          mediaOutput = Buffer.from(data);
        }
      } catch (err) {
        console.warn("[Menu ID Card Maker Fail, fallback to default banner]:", err.message);
      }
      let finalThumbnail = await resizeImage(mediaOutput, 300, 300, "image/jpeg").catch(() => null);
      if (!finalThumbnail && typeof mediaOutput === "string") {
        try {
          const res = await axios.get(mediaOutput, {
            responseType: "arraybuffer",
            timeout: 1e4
          });
          finalThumbnail = await resizeImage(Buffer.from(res.data), 300, 300, "image/jpeg");
        } catch {}
      }
      const bodyText = `Halo, *${userName}* 👋\n` + `Selamat datang di *${botName}*!\n\n` + `╭───『 *USER INFO* 』\n` + `│ 👤 *Status:* ${userStatus}\n` + `│ 🎫 *Sisa Limit:* ${userLimit}\n` + `│ 🎖️ *Level RPG:* Lv. ${userLevel}\n` + `╰──────────────────\n\n` + `╭───『 *BOT STATS* 』\n` + `│ 🤖 *Bot Name:* ${botName} (${version})\n` + `│ ⏱️ *Aktif Selama:* ${botUptime}\n` + `│ 📂 *Total Kategori:* ${categoryNames.length} Kategori\n` + `│ 📊 *Total Fitur:* ${totalFitur} Perintah\n` + `╰──────────────────\n\n` + `_Tap salah satu tombol kategori di bawah untuk melihat daftar command!_`;
      const footerText = `${botName} • Automation Engine ✦ ${totalFitur} Command`;
      const buttons = [];
      buttons.push({
        name: "cta_copy",
        display_text: botName,
        copy_code: `Butuh bantuan? Hubungi owner: ${ownerNumber}`
      });
      for (const cat of categoryNames) {
        const cmdList = categories[cat] || [];
        if (cmdList.length === 0) continue;
        const uniqueCmds = [...new Set(cmdList.map(c => c.name || c))];
        buttons.push({
          name: "single_select",
          title: `📁 ${cat} (${uniqueCmds.length})`,
          sections: [{
            title: `${botName} • ${cat}`,
            rows: uniqueCmds.map(cmdName => ({
              title: `${prefix}${cmdName}`,
              description: `Ketuk untuk menjalankan command ini`,
              id: `${prefix}${cmdName}`
            }))
          }]
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "🌀",
        copy_code: `Love You - @${botName}`
      });
      const options = {
        location: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: `✦ ${botName} ${version} ✦`,
          address: `👤 ${userName} • ${userStatus}`,
          jpegThumbnail: finalThumbnail || undefined
        },
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Kategori`,
            button_title: "Click Me"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Main Menu ✦`,
            url: "",
            copy_code: "",
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      await ctx.sendCta(bodyText, footerText, buttons, options);
      await ctx.react("✅");
    } catch (e) {
      console.error("[MENU ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal menampilkan menu: ${e.message}`);
    }
  }
};