import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  makeJid
} from "../../core/tools.js";
import db from "../../data/db.js";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["delete", "del", "d", "remove", "rm", "u", "user"].includes(key)) key = "delete";
    if (["search", "s", "find", "q"].includes(key)) key = "search";
    if (["list", "l", "all", "a", "menu"].includes(key)) key = "list";
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
  name: "delowner",
  aliases: ["hapusowner", "deleteowner", "delown", "rmowner"],
  description: "Hapus nomor dari daftar owner bot via CLI & CTA Bottom Sheet",
  category: "Owner",
  owner: true,
  example: "delowner -l atau delowner 628xxx atau delowner -d 628xxx atau delowner -s 628",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["delowner", "hapusowner", "deleteowner", "delown", "rmowner"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Owner Access Manager`;
      const mainAuthorNum = String(global.bot?.author?.number || "").replace(/\D/g, "");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const hasQuotedTarget = Boolean(ctx.quoted?.sender);
      const hasAction = Boolean(flags.delete || flags.search || flags.list || flags.all || cleanPrompt || hasQuotedTarget);
      if (!hasAction || flags.help) {
        return ctx.reply(`📦 *DELETE OWNER MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Buka Menu Hapus Owner (CTA UI): \`${prefix}delowner --list\` atau \`${prefix}delowner -l\`\n` + `  👉 Hapus Nomor Langsung: \`${prefix}delowner 628xxx\` atau \`${prefix}delowner -d 628xxx\`\n` + `  👉 Hapus via Reply Pesan: Reply pesan user target lalu ketik \`${prefix}delowner\`\n` + `  👉 Filter/Cari Nomor Owner: \`${prefix}delowner -s 628\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-l, --list\` (Buka menu interaktif daftar owner yang dapat dihapus)\n` + `  • \`-d, --delete <nomor>\` (Hapus nomor tertentu dari database owner)\n` + `  • \`-s, --search <nomor>\` (Cari nomor owner tertentu)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      let targetRaw = null;
      if (typeof flags.delete === "string") {
        targetRaw = flags.delete.replace(/\D/g, "");
      } else if (cleanPrompt && !flags.list && !flags.search) {
        targetRaw = cleanPrompt.replace(/\D/g, "");
      } else if (hasQuotedTarget && !flags.list && !flags.search) {
        targetRaw = ctx.quoted.sender.replace(/\D/g, "");
      }
      if (targetRaw && targetRaw.length >= 5) {
        const noJid = targetRaw;
        const targetJid = typeof makeJid === "function" ? makeJid(noJid) : `${noJid}@s.whatsapp.net`;
        if (noJid === mainAuthorNum) {
          return ctx.reply("❌ Tidak dapat menghapus Owner Utama / Developer bot!");
        }
        const isCurrentOwner = (global.bot?.owner || []).some(o => String(o).replace(/\D/g, "") === noJid) || Boolean(global.db?.user?.[targetJid]?.ownerAcces);
        if (!isCurrentOwner) {
          return ctx.reply(`❌ Nomor *+${noJid}* tidak ditemukan di dalam database owner.`);
        }
        await ctx.react("⏳");
        if (Array.isArray(global.bot?.owner)) {
          global.bot.owner = global.bot.owner.filter(v => String(v).replace(/\D/g, "") !== noJid && v !== targetJid);
        }
        if (global.db?.user?.[targetJid]) {
          global.db.user[targetJid].ownerAcces = false;
        }
        if (typeof db?.write === "function") {
          db.write(global.db);
        }
        const successText = `🗑️ *OWNER BERHASIL DIHAPUS*\n\n` + `╭───『 *DETAIL OWNER* 』\n` + `│ 👤 *Nomor:* +${noJid}\n` + `│ 🆔 *JID:* \`${targetJid}\`\n` + `│ 🔒 *Status Akses:* Dicabut (User Biasa)\n` + `╰──────────────────\n\n` + `_Akses owner pada nomor tersebut telah resmi dinonaktifkan._`;
        await ctx.reply(successText);
        await ctx.react("✅");
        return;
      }
      const allOwners = Array.isArray(global.bot?.owner) ? [...new Set(global.bot.owner.map(o => String(o).replace(/\D/g, "")).filter(Boolean))] : [];
      let deletableOwners = allOwners.filter(num => num !== mainAuthorNum);
      const searchQuery = (typeof flags.search === "string" ? flags.search : cleanPrompt).replace(/\D/g, "");
      const isSearch = Boolean(searchQuery && !flags.list);
      if (isSearch) {
        deletableOwners = deletableOwners.filter(num => num.includes(searchQuery));
      }
      if (deletableOwners.length === 0) {
        await ctx.react("❌");
        if (isSearch) {
          return ctx.reply(`🔍 *OWNER TIDAK DITEMUKAN*\n\nTidak ditemukan nomor owner yang cocok dengan keyword: *"${searchQuery}"*`);
        }
        return ctx.reply(`📂 *TIDAK ADA OWNER TAMBAHAN*\n\n` + `Saat ini hanya ada *Owner Utama (+${mainAuthorNum})* yang tidak dapat dihapus.\n\n` + `Ketik \`${prefix}listowner\` untuk melihat info owner.`);
      }
      await ctx.react("⏳");
      const listSections = [{
        title: `${botName} • Cabut Akses Owner`,
        rows: deletableOwners.map(num => ({
          title: `🗑️ +${num}`,
          id: `${prefix}delowner -d ${num}`,
          description: `Cabut status owner (+${num})`
        }))
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🗑️ PILIH OWNER DIHAPUS (${deletableOwners.length})`,
          sections: listSections
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = isSearch ? `🔍 *HAPUS OWNER (PENCARIAN)*\n\n` + `• *Kata Kunci:* \`${searchQuery}\`\n` + `• *Ditemukan:* ${deletableOwners.length} nomor\n\n` + `⚠️ _Pilih nomor di bawah untuk langsung mencabut akses owner:_` : `🗑️ *DELETE OWNER MANAGER*\n\n` + `• *Owner Utama:* +${mainAuthorNum} _(Permanen)_\n` + `• *Owner Tambahan:* ${deletableOwners.length} nomor terdaftar\n\n` + `⚠️ _Pilih nomor di bawah untuk langsung mencabut akses owner:_`;
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Pilih Owner Dihapus`,
            button_title: "🗑️ Buka Menu Hapus"
          },
          limited_time_offer: {
            text: `✦ ${botName} - DelOwner Manager ✦`,
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
        deletableOwners.forEach((num, idx) => {
          listText += `${idx + 1}. \`${prefix}delowner -d ${num}\`\n`;
        });
        await ctx.reply(listText);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[DelOwner Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ *DelOwner Error:*\n\`\`\`${error?.message || error}\`\`\``);
    }
  }
};