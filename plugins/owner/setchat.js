import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["action", "a", "act"].includes(key)) key = "action";
    if (["target", "t", "jid", "id", "chat"].includes(key)) key = "target";
    if (["list", "l", "all", "daftar"].includes(key)) key = "list";
    if (["ban", "b"].includes(key)) {
      key = "action";
      val = "ban";
    }
    if (["unban", "un", "u"].includes(key)) {
      key = "action";
      val = "unban";
    }
    if (["search", "s", "find"].includes(key)) key = "search";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "setchat",
  aliases: ["banchat", "unbanchat", "groupban", "bangroup", "unbangroup", "chatban"],
  description: "Atur status ban/unban chat atau grup bot via CLI & CTA Bottom Sheet",
  category: "Owner",
  owner: true,
  example: "setchat ban atau setchat unban atau setchat --list atau setchat -a ban -t 123456@g.us",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setchat", "banchat", "unbanchat", "groupban", "bangroup", "unbangroup", "chatban"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Chat Access & Ban Manager`;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      let action = flags.action || null;
      if (!action && freeTokens[0]) {
        const first = freeTokens[0].toLowerCase();
        if (["ban", "unban", "list"].includes(first)) {
          action = first;
        }
      }
      let targetJid = flags.target || null;
      if (!targetJid) {
        const potentialJid = freeTokens.find(t => t.includes("@g.us") || /\d{10,}/.test(t) && t !== action);
        if (potentialJid) {
          targetJid = potentialJid.includes("@") ? potentialJid : `${potentialJid}@g.us`;
        } else if (ctx.id?.endsWith("@g.us")) {
          targetJid = ctx.id;
        }
      }
      const hasAction = Boolean(action || flags.list || flags.search || targetJid && targetJid !== ctx.id);
      if (!hasAction && !flags.list && flags.help) {
        return ctx.reply(`🚫 *CHAT & GROUP BAN MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Ban Grup Saat Ini: \`${prefix}setchat ban\`\n` + `  👉 Unban Grup Saat Ini: \`${prefix}setchat unban\`\n` + `  👉 Buka Menu & List Grup Ter-ban (CTA): \`${prefix}setchat --list\` atau \`${prefix}setchat -l\`\n` + `  👉 Ban Target Grup Tertentu: \`${prefix}setchat -a ban -t 1234567890@g.us\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-a, --action <ban/unban>\` (Status aksi yang ditentukan)\n` + `  • \`-t, --target <jid>\` (Target ID chat/grup WhatsApp)\n` + `  • \`-l, --list\` (Buka menu interaktif daftar grup yang diban)\n` + `  • \`-s, --search <query>\` (Cari ID grup dalam database ban)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      if (!global.db.group) global.db.group = {};
      if (flags.list || action === "list" || !action && targetJid) {
        await ctx.react("⏳");
        const bannedEntries = Object.entries(global.db.group).filter(([, d]) => d?.bans === true);
        const bannedJids = bannedEntries.map(([jid]) => jid);
        const currentChatBanned = targetJid && global.db.group[targetJid]?.bans === true;
        const actionRows = [];
        if (targetJid) {
          if (currentChatBanned) {
            actionRows.push({
              title: `✅ Unban Chat Ini (${targetJid.split("@")[0].slice(0, 15)})`,
              id: `${prefix}setchat -a unban -t ${targetJid}`,
              description: `Aktifkan kembali bot pada chat/grup ini`
            });
          } else {
            actionRows.push({
              title: `🚫 Ban Chat Ini (${targetJid.split("@")[0].slice(0, 15)})`,
              id: `${prefix}setchat -a ban -t ${targetJid}`,
              description: `Nonaktifkan respon bot pada chat/grup ini`
            });
          }
        }
        const bannedRows = bannedJids.slice(0, 15).map(jid => ({
          title: `🔓 Unban: ${jid.split("@")[0]}`.slice(0, 24),
          id: `${prefix}setchat -a unban -t ${jid}`,
          description: `ID: ${jid}`
        }));
        const listSections = [];
        if (actionRows.length > 0) {
          listSections.push({
            title: `⚡ AKSI CEPAT (CHAT SAAT INI)`,
            rows: actionRows
          });
        }
        if (bannedRows.length > 0) {
          listSections.push({
            title: `🚫 DAFTAR CHAT TER-BAN (${bannedJids.length})`,
            rows: bannedRows
          });
        } else if (!actionRows.length) {
          listSections.push({
            title: `📋 INFO STATUS`,
            rows: [{
              title: `✨ Tidak Ada Chat Diban`,
              id: `${prefix}setchat --help`,
              description: `Semua grup dan chat berjalan normal`
            }]
          });
        }
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🚫 KELOLA BAN GROUP (${bannedJids.length} Terban)`,
            sections: listSections
          })
        }];
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `🚫 *CHAT ACCESS & BAN MANAGER*\n\n` + `• *Target Chat:* \`${targetJid || "Tidak ada"}\`\n` + `• *Status Chat Ini:* ${currentChatBanned ? "Ter-Ban 🚫" : "Normal / Aktif ✅"}\n` + `• *Total Chat Ter-Ban:* ${bannedJids.length} chat/grup\n\n` + `_Pilih tindakan pada tombol menu interaktif di bawah untuk mengatur ban:_`;
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Chat Ban Manager`,
              button_title: "🚫 Buka Pengaturan Ban"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Group Access Control ✦`,
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
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let listText = bodyText + "\n\n";
          if (bannedJids.length) {
            listText += "*Daftar Ter-ban:*\n" + bannedJids.map((j, i) => `${i + 1}. \`${j}\``).join("\n");
          }
          await ctx.reply(listText);
        }
        await ctx.react("✅");
        return;
      }
      if (!targetJid) {
        return ctx.reply("❌ Target JID/Grup tidak ditemukan. Harap masukkan ID grup atau gunakan command di dalam grup.");
      }
      await ctx.react("⏳");
      if (typeof db.ensureGroup === "function") {
        db.ensureGroup(targetJid);
      } else if (!global.db.group[targetJid]) {
        global.db.group[targetJid] = {
          from: targetJid,
          config: {},
          bans: false
        };
      }
      if (action === "ban") {
        global.db.group[targetJid].bans = true;
        if (typeof db?.write === "function") db.write(global.db);
        const banText = `🚫 *CHAT BERHASIL DIBAN*\n\n` + `╭───『 *DETAIL BAN* 』\n` + `│ 🆔 *Target JID:* \`${targetJid}\`\n` + `│ 🔒 *Status Bot:* Dinonaktifkan (Mute)\n` + `│ 👑 *Oleh:* Owner Bot\n` + `╰──────────────────\n\n` + `_Bot tidak akan merespon perintah apapun di chat/grup ini._`;
        await ctx.reply(banText);
        await ctx.react("✅");
        return;
      } else if (action === "unban") {
        global.db.group[targetJid].bans = false;
        if (typeof db?.write === "function") db.write(global.db);
        const unbanText = `✅ *CHAT BERHASIL DIUNBAN*\n\n` + `╭───『 *DETAIL UNBAN* 』\n` + `│ 🆔 *Target JID:* \`${targetJid}\`\n` + `│ 🔓 *Status Bot:* Aktif Kembali (Normal)\n` + `│ 👑 *Oleh:* Owner Bot\n` + `╰──────────────────\n\n` + `_Bot kini dapat digunakan kembali dengan normal pada chat/grup ini._`;
        await ctx.reply(unbanText);
        await ctx.react("✅");
        return;
      } else {
        return ctx.reply(`❌ Aksi tidak dikenali: *"${action}"*. Gunakan \`ban\` atau \`unban\`.`);
      }
    } catch (e) {
      console.error("[SetChat Error]:", e?.message || e);
      await ctx.react("❌");
      ctx.reply(`❌ *SetChat Error:*\n\`\`\`${e?.message || e}\`\`\``);
    }
  }
};