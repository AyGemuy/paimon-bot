import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "grouplist",
  aliases: ["listgroup", "listgrup", "listgc", "gclist"],
  description: "Menampilkan daftar seluruh grup yang diikuti bot dengan menu CTA selector ke groupinfo",
  category: "Group",
  example: ".grouplist",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let allGroups = {};
      try {
        if (typeof sock.groupFetchAllParticipating === "function") {
          allGroups = await sock.groupFetchAllParticipating();
        }
      } catch (err) {
        console.error("[GROUPLIST] Gagal memuat daftar grup:", err);
      }
      const seenGroupJids = new Set();
      const groupRows = [];
      const isCurrentGroup = ctx.isGroup || ctx.id?.endsWith("@g.us");
      const groupEntries = allGroups instanceof Map ? Array.from(allGroups.entries()) : Object.entries(allGroups || {});
      let currentGroupMeta = null;
      if (isCurrentGroup) {
        if (allGroups instanceof Map) {
          currentGroupMeta = allGroups.get(ctx.id);
        } else {
          currentGroupMeta = allGroups[ctx.id];
        }
        seenGroupJids.add(ctx.id);
        const currentName = currentGroupMeta?.subject || "Grup Saat Ini";
        const memberCount = currentGroupMeta?.participants?.length || currentGroupMeta?.size || 0;
        groupRows.push({
          title: `📍 ${currentName.slice(0, 40)}`,
          description: `Grup Ini • ${memberCount} Anggota`,
          id: `${prefix}groupinfo ${ctx.id}`
        });
      }
      for (const [jid, meta] of groupEntries) {
        if (!jid.endsWith("@g.us") || seenGroupJids.has(jid)) continue;
        seenGroupJids.add(jid);
        const groupName = (meta?.subject || "WhatsApp Group").trim();
        const memberCount = meta?.participants?.length || meta?.size || 0;
        groupRows.push({
          title: `👥 ${groupName.slice(0, 40)}`,
          description: `Anggota: ${memberCount} Member | 🆔 ${jid.split("@")[0]}`,
          id: `${prefix}groupinfo ${jid}`
        });
      }
      if (groupRows.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Bot belum terdaftar di grup manapun.");
      }
      const limitedRows = groupRows.slice(0, 25);
      const totalGroupCount = groupEntries.length;
      const bodyText = `╭───『 *DAFTAR GRUP BOT* 』\n` + `│ 🤖 *Bot:* ${botName}\n` + `│ 📊 *Total Grup:* ${totalGroupCount} Grup\n` + `╰────────────────────────\n\n` + `Silakan pilih grup pada tombol menu interaktif di bawah untuk melihat detail informasi lengkapnya.`;
      const footerText = `${botName} • Group Management`;
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const buttons = [{
        name: "single_select",
        title: `📋 PILIH GRUP (${limitedRows.length})`,
        sections: [{
          title: `${botName} • Daftar Grup`,
          rows: limitedRows
        }]
      }];
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Daftar Grup`,
            button_title: "📋 Pilih Grup"
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
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallbackText = `${bodyText}\n\n*DAFTAR GRUP:*\n`;
        groupRows.forEach((g, idx) => {
          fallbackText += `${idx + 1}. *${g.title}*\n   👉 \`${g.id}\`\n\n`;
        });
        await ctx.reply(fallbackText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[GROUPLIST Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil daftar grup: ${error?.message || error}`);
    }
  }
};