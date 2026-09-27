import axios from "axios";
import {
  simpleQuoted,
  metaQuoted
} from "../../lib/quoted.js";
import {
  resizeImage
} from "../../core/serialize.js";
export default {
  name: "allmenu",
  aliases: ["all", "fitur", "helpall"],
  description: "Menampilkan semua command atau kategori spesifik via Interactive List CTA UI dengan Custom ID Card",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const categories = global.loader?.getCommandsByCategory?.() || {};
      const catName = (ctx.args?.[0] || ctx.query || "").trim().toLowerCase();
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx.prefix || ".";
      const ownerNumber = Array.isArray(global.bot?.owner) ? global.bot.owner[0] : global.bot?.owner || "628xxx";
      const quotedMsg = typeof metaQuoted === "function" ? metaQuoted(ctx) : typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const userData = global.db?.user?.[ctx.sender];
      const userName = ctx.pushname || ctx.sender.split("@")[0];
      const userNumber = ctx.sender.split("@")[0];
      const isOwner = userData?.ownerAcces === true || (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === userNumber);
      const isPremium = userData?.premium?.status === true || isOwner;
      const userLevel = userData?.level || 1;
      const totalCommands = Object.values(categories).flat().length;
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
          info_pre: "✦ CATALOG ENGINE ✦",
          info_badge: `${totalCommands} CMDS`,
          name: userName.slice(0, 20).toUpperCase(),
          badge_line: catName ? `CAT: ${catName.toUpperCase()}` : `${botName} CATALOG`,
          role: isOwner ? "SYSTEM ADMINISTRATOR" : isPremium ? "PREMIUM CITIZEN" : "STANDARD CITIZEN",
          email: `${userNumber}@whatsapp.net`,
          phone: `+${userNumber}`,
          pin: `TOTAL: ${Object.keys(categories).length} CATS`,
          valid: isOwner || isPremium ? "VALID: LIFETIME" : "VALID: 3025",
          clearance: isOwner ? "CLEARANCE: ROOT" : `CLEARANCE: NEB-${userLevel}`,
          mag: isOwner || isPremium ? "LIMIT: INF" : `LIMIT: ${userData?.limit ?? 20}`
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
        console.warn("[Allmenu ID Card Fail, fallback to default banner]:", err.message);
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
      if (catName) {
        const matched = Object.keys(categories).find(k => k.toLowerCase() === catName);
        if (matched) {
          const cmds = categories[matched] || [];
          const commandRows = cmds.map(cmd => {
            const badges = [cmd.limit ? "[LIMIT]" : "", cmd.owner ? "[OWNER]" : "", cmd.premium ? "[PREM]" : ""].filter(Boolean).join(" ");
            return {
              title: `${prefix}${cmd.name} ${badges}`.trim(),
              id: `${prefix}${cmd.name}`,
              description: cmd.description || "Ketuk untuk menjalankan command ini"
            };
          });
          const cmdListText = cmds.map(c => `│ ➔ \`${prefix}${c.name}\``).join("\n");
          const bodyText = `╭───『 *KATEGORI: ${matched.toUpperCase()}* 』\n` + `│ 📂 *Total Perintah:* ${cmds.length} Fitur\n` + `│ 🏷️ *Prefix:* \`${prefix}\`\n` + `├────────────────────────\n` + `${cmdListText}\n` + `╰────────────────────────\n\n` + `_Pilih perintah dari dropdown di bawah untuk langsung menjalankannya!_`;
          const footerText = `${botName} • Kategori ${matched} ✦ ${cmds.length} Perintah`;
          const buttons = [{
            name: "cta_copy",
            display_text: botName,
            copy_code: `Butuh bantuan? Hubungi owner: ${ownerNumber}`
          }, {
            name: "single_select",
            title: `📜 PILIH FITUR (${cmds.length})`,
            sections: [{
              title: `${botName} • ${matched.toUpperCase()}`,
              rows: commandRows
            }]
          }, {
            name: "quick_reply",
            display_text: "📂 Semua Katalog",
            id: `${prefix}allmenu`
          }, {
            name: "quick_reply",
            display_text: "🏠 Menu Utama",
            id: `${prefix}menu`
          }, {
            name: "cta_copy",
            display_text: "🌀",
            copy_code: `Love You - @${botName}`
          }];
          const options = {
            location: {
              degreesLatitude: 0,
              degreesLongitude: 0,
              name: `✦ ${botName} • ${matched.toUpperCase()} ✦`,
              address: `👤 ${userName} • ${userNumber}`,
              jpegThumbnail: finalThumbnail || undefined
            },
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: [1],
                list_title: `${botName} • Kategori ${matched.toUpperCase()}`,
                button_title: "Click Me"
              },
              limited_time_offer: {
                text: `✦ ${botName} - ${matched.toUpperCase()} ✦`,
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
          return await ctx.react("✅");
        }
      }
      const sortedEntries = Object.entries(categories).sort();
      let catalogText = "";
      for (const [cat, cmds] of sortedEntries) {
        if (cmds.length === 0) continue;
        const cmdTags = cmds.map(c => `\`${prefix}${c.name || c}\``).join(", ");
        catalogText += `╭───『 *${cat.toUpperCase()}* (${cmds.length}) 』\n${cmdTags}\n╰────────────────────────\n\n`;
      }
      const bodyText = `Halo, *${userName}* 👋\n` + `Berikut adalah seluruh daftar katalog perintah yang tersedia:\n\n` + `╭───『 *CATALOG STATS* 』\n` + `│ 🤖 *Bot Name:* ${botName}\n` + `│ 📂 *Total Kategori:* ${sortedEntries.length} Kategori\n` + `│ 📊 *Total Fitur:* ${totalCommands} Perintah\n` + `│ 🏷️ *Prefix:* \`${prefix}\`\n` + `╰────────────────────────\n\n` + catalogText.trim();
      const footerText = `${botName} • All Features Catalog ✦ ${totalCommands} Commands`;
      const catalogSections = [{
        title: `${botName} • DAFTAR KATALOG KATEGORI`,
        rows: sortedEntries.map(([cat, cmds]) => ({
          title: `📁 ${cat.toUpperCase()}`,
          description: `Terdapat ${cmds.length} perintah dalam kategori ini`,
          id: `${prefix}allmenu ${cat}`
        }))
      }];
      const buttons = [{
        name: "cta_copy",
        display_text: botName,
        copy_code: `Butuh bantuan? Hubungi owner: ${ownerNumber}`
      }, {
        name: "single_select",
        title: `📑 BUKA KATALOG KATEGORI (${sortedEntries.length})`,
        sections: catalogSections
      }, {
        name: "quick_reply",
        display_text: "🏠 Menu Utama",
        id: `${prefix}menu`
      }, {
        name: "cta_copy",
        display_text: "🌀",
        copy_code: `Love You - @${botName}`
      }];
      const options = {
        location: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: `✦ ${botName} Complete Catalog ✦`,
          address: `👤 ${userName} • Total ${totalCommands} Fitur`,
          jpegThumbnail: finalThumbnail || undefined
        },
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Katalog Semua Fitur`,
            button_title: "Click Me"
          },
          limited_time_offer: {
            text: `✦ ${botName} - All Command List ✦`,
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
      console.error("[ALLMENU ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memuat daftar perintah: ${e.message}`);
    }
  }
};