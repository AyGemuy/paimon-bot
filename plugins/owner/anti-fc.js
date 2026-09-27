import {
  simpleQuoted
} from "../../lib/quoted.js";
const INVISIBLE_PAYLOAD = "‎".repeat(10) + "​" + "⠀".repeat(5);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export default {
  name: "fixbug",
  aliases: ["antibug", "fixfc", "clearchatbug", "fixcrash"],
  description: "Mengatasi force close / lag di grup WhatsApp dengan penghapusan pesan msgStore & penimbunan pesan kosong",
  category: "Group",
  example: ".fixbug (atau .fixbug --to=xxx@g.us --count=10)",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const targetMatch = rawQuery.match(/--to=([0-9\-_]+@g\.us)/i);
      const countMatch = rawQuery.match(/--count=(\d+)/i);
      const targetJid = targetMatch ? targetMatch[1] : null;
      const count = countMatch ? parseInt(countMatch[1]) : null;
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      if (!targetJid) {
        await ctx.react("⏳");
        let allGroups = {};
        try {
          if (typeof sock.groupFetchAllParticipating === "function") {
            allGroups = await sock.groupFetchAllParticipating();
          }
        } catch (err) {
          console.error("[FIXBUG] Gagal memuat daftar grup:", err);
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
          groupRows.push({
            title: `📍 ${currentName.slice(0, 40)}`,
            description: `Bersihkan bug khusus di grup ini`,
            id: `${prefix}fixbug --to=${ctx.id}`
          });
        }
        for (const [jid, meta] of groupEntries) {
          if (!jid.endsWith("@g.us") || seenGroupJids.has(jid)) continue;
          seenGroupJids.add(jid);
          groupRows.push({
            title: `👥 ${(meta?.subject || "WhatsApp Group").slice(0, 40)}`,
            description: `Anggota: ${meta?.participants?.length || meta?.size || 0} Member`,
            id: `${prefix}fixbug --to=${jid}`
          });
        }
        if (groupRows.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Bot belum terdaftar di grup manapun.");
        }
        const limitedRows = groupRows.slice(0, 20);
        const bodyText = `🛡️ *ANTI BUG / FIX FORCE CLOSE (FC)*\n\n` + `Silakan pilih grup target yang mengalami pesan bug/crash di bawah:\n` + `_(Pesan bug di msgStore akan dihapus jika bot admin & ditimbun pesan kosong)_`;
        const footerText = `${botName} • Group Bug Cleaner`;
        const buttons = [{
          name: "single_select",
          title: `🎯 PILIH TARGET GRUP (${limitedRows.length})`,
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
              list_title: `${botName} • Pilih Target Grup`,
              button_title: "🎯 Pilih Grup Tujuan"
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
          await ctx.reply(bodyText, {
            quoted: quotedMsg
          });
        }
        return await ctx.react("✅");
      }
      let isBotAdmin = false;
      let groupMeta = null;
      try {
        groupMeta = await sock.groupMetadata(targetJid);
      } catch {
        groupMeta = {
          subject: "Grup Target",
          participants: []
        };
      }
      if (ctx.id === targetJid) {
        isBotAdmin = Boolean(ctx.isBotAdmin);
      } else {
        const botNumber = (sock.user?.id || "").split(":")[0] + "@s.whatsapp.net";
        const botData = groupMeta?.participants?.find(p => p.id === botNumber || p.jid === botNumber);
        isBotAdmin = botData?.admin === "admin" || botData?.admin === "superadmin";
      }
      const store = global.msgStore || sock.msgStore || ctx.msgStore;
      const groupSavedMessages = [];
      if (store) {
        const allStoredMsgs = store instanceof Map ? Array.from(store.values()) : Object.values(store);
        for (const item of allStoredMsgs) {
          const chatJid = item.chat || item.from || item.id || item.key?.remoteJid;
          if (chatJid === targetJid && item.key) {
            groupSavedMessages.push(item.key);
          }
        }
      }
      if (!count || isNaN(count) || count <= 0) {
        const groupName = groupMeta?.subject || "WhatsApp Group";
        const memberCount = groupMeta?.participants ? groupMeta.participants.length : groupMeta?.size || 0;
        const totalStoreMsgs = groupSavedMessages.length;
        const bodyText = `╭───『 *DETAIL INFO GRUP* 』\n` + `│ 🏷️ *Nama Grup:* ${groupName}\n` + `│ 🆔 *ID Grup:* \`${targetJid}\`\n` + `│ 👥 *Total Member:* ${memberCount} Anggota\n` + `│ 🛡️ *Status Bot:* ${isBotAdmin ? "✅ Admin (Bisa Hapus Pesan)" : "❌ Bukan Admin (Hanya Timbun)"}\n` + `│ 📦 *Pesan di msgStore:* ${totalStoreMsgs} Pesan\n` + `╰────────────────────────\n\n` + `Pilih dosis pembersihan bug di bawah ini.\n` + `_Bot akan menghapus ${isBotAdmin ? "X pesan terakhir di store &" : ""} mengirim X pesan kosong._`;
        const footerText = `${botName} • Dosis Anti-Bug`;
        const counts = [5, 10, 15, 20, 30, 50];
        const doseRows = counts.map(num => ({
          title: `⚡ Dosis ${num} Pesan`,
          description: isBotAdmin ? `Hapus ${Math.min(num, totalStoreMsgs)} pesan store & kirim ${num} blank` : `Kirim ${num} pesan kosong penimbun`,
          id: `${prefix}fixbug --to=${targetJid} --count=${num}`
        }));
        const buttons = [{
          name: "single_select",
          title: `⚡ PILIH DOSIS PEMBERSIHAN (${doseRows.length})`,
          sections: [{
            title: `${botName} • Dosis Fix FC`,
            rows: doseRows
          }]
        }];
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Pilih Dosis`,
              button_title: "⚡ Pilih Dosis Pesan"
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
          await ctx.reply(`${bodyText}\n\nKetik: \`${prefix}fixbug --to=${targetJid} --count=10\``, {
            quoted: quotedMsg
          });
        }
        return await ctx.react("✅");
      }
      await ctx.react("🚀");
      await ctx.reply(`⏳ *Memulai pembersihan bug...*\n` + `• Target: *${groupMeta?.subject || targetJid}*\n` + `• Status: *${isBotAdmin ? "🛡️ Admin (Hapus Pesan Aktif)" : "👤 Member (Timbun Saja)"}*\n` + `• Total Aksi: *${count}* Pesan`);
      let deletedCount = 0;
      if (isBotAdmin && groupSavedMessages.length > 0) {
        const targetKeysToDelete = groupSavedMessages.slice(-count);
        for (const key of targetKeysToDelete) {
          try {
            await sock.sendMessage(targetJid, {
              delete: key
            });
            deletedCount++;
            await sleep(250);
          } catch (err) {
            console.error("[FIXBUG Delete Error]:", err.message);
          }
        }
      }
      let sentCount = 0;
      for (let i = 1; i <= count; i++) {
        try {
          await sock.sendMessage(targetJid, {
            text: INVISIBLE_PAYLOAD
          });
          sentCount++;
          await sleep(300);
        } catch (e) {
          console.error(`[FIXBUG Payload Error ke-${i}]:`, e.message);
        }
      }
      await ctx.react("✅");
      const resultReport = `✅ *PROSES FIX BUG SELESAI!*\n\n` + `╭───『 *LAPORAN HASIL* 』\n` + `│ 🎯 *Target:* ${groupMeta?.subject || targetJid}\n` + `│ 🛡️ *Status Bot:* ${isBotAdmin ? "Admin Grup" : "Bukan Admin"}\n` + `│ 🗑️ *Pesan Dihapus:* ${deletedCount} / ${count} Pesan\n` + `│ ✉️ *Pesan Ditimbun:* ${sentCount} / ${count} Pesan Kosong\n` + `╰────────────────────────\n\n` + `_Pesan bug telah dihapus dan ditimbun. Chat grup kini aman dibuka kembali._`;
      return ctx.reply(resultReport, {
        quoted: quotedMsg
      });
    } catch (error) {
      console.error("[FIXBUG Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal memproses Fix Bug: ${error?.message || error}`);
    }
  }
};