import {
  makeJid,
  ensureUser
} from "../../core/tools.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";

function parseDuration(durationStr = "") {
  const d = String(durationStr).toLowerCase().trim();
  if (["permanen", "permanent", "unlimited", "forever", "inf"].includes(d)) {
    return {
      ms: Number.MAX_SAFE_INTEGER,
      label: "Permanen (Selamanya)"
    };
  }
  const match = d.match(/^(\d+)\s*(j|jam|h|hari|d|day|days|m|minggu|w|week|weeks|b|bulan|mon|month|months)$/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mul = {
    j: 36e5,
    jam: 36e5,
    h: 864e5,
    hari: 864e5,
    d: 864e5,
    day: 864e5,
    days: 864e5,
    m: 6048e5,
    minggu: 6048e5,
    w: 6048e5,
    week: 6048e5,
    weeks: 6048e5,
    b: 2592e6,
    bulan: 2592e6,
    mon: 2592e6,
    month: 2592e6,
    months: 2592e6
  };
  const ms = num * (mul[unit] || 0);
  let unitLabel = "Hari";
  if (["j", "jam"].includes(unit)) unitLabel = "Jam";
  else if (["m", "minggu", "w", "week", "weeks"].includes(unit)) unitLabel = "Minggu";
  else if (["b", "bulan", "mon", "month", "months"].includes(unit)) unitLabel = "Bulan";
  return {
    ms: ms,
    label: `${num} ${unitLabel}`
  };
}

function formatDate(timestamp) {
  if (timestamp === Number.MAX_SAFE_INTEGER || !timestamp) return "Permanen";
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short"
  }) + " WIB";
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["user", "u", "target", "nomor", "num"].includes(key)) key = "user";
    if (["duration", "d", "time", "durasi", "t"].includes(key)) key = "duration";
    if (["action", "a", "act"].includes(key)) key = "action";
    if (["list", "l", "menu"].includes(key)) key = "list";
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
  name: "setpremium",
  aliases: ["addprem", "delprem", "premiumset", "setprem", "prem"],
  description: "Atur status dan durasi user premium via CLI & Interactive CTA Sheet",
  category: "Owner",
  owner: true,
  example: "setprem 628xxx 30hari atau setprem -u 628xxx -d 1bulan atau setprem --del 628xxx",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setpremium", "addprem", "delprem", "premiumset", "setprem", "prem"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Premium Subscription Manager`;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      let targetNumber = flags.user || (freeTokens[0] && /\d{5,}/.test(freeTokens[0]) ? freeTokens[0] : null);
      if (!targetNumber && ctx.quoted?.sender) {
        targetNumber = ctx.quoted.sender.replace(/\D/g, "");
      }
      let durationInput = flags.duration || (freeTokens[1] && !["add", "min", "del", "remove"].includes(freeTokens[1].toLowerCase()) ? freeTokens[1] : null);
      if (!durationInput && freeTokens[0] && !/\d{5,}/.test(freeTokens[0])) {
        durationInput = freeTokens[0];
      }
      let actionInput = flags.action || (freeTokens[2] || freeTokens[1] || "").toLowerCase();
      if (["min", "del", "remove", "hapus"].some(a => rawText.toLowerCase().includes(a))) {
        actionInput = "remove";
      }
      const hasAction = Boolean(targetNumber || durationInput || flags.list);
      if (!hasAction || flags.help) {
        return ctx.reply(`⚡ *PREMIUM SUBSCRIPTION MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Tambah Durasi: \`${prefix}setprem 628xxx 30hari\`\n` + `  👉 Menu Preset Pilihan (CTA Sheet): \`${prefix}setprem 628xxx\`\n` + `  👉 Cabut Status Premium: \`${prefix}setprem 628xxx min\` atau \`${prefix}delprem 628xxx\`\n` + `  👉 Via Reply: Balas chat user lalu ketik \`${prefix}setprem 1bulan\`\n\n` + `• *Opsi Satuan Durasi:*\n` + `  • \`1jam\`, \`3hari\`, \`1minggu\`, \`1bulan\`, \`permanen\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-u, --user <nomor>\` (Nomor WhatsApp target)\n` + `  • \`-d, --duration <waktu>\` (Durasi premium yang diberikan)\n` + `  • \`-a, --action <add/del>\` (Aksi penambahan atau pencabutan)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      const cleanNum = String(targetNumber).replace(/\D/g, "");
      if (!cleanNum || cleanNum.length < 5) {
        return ctx.reply("❌ Nomor target tidak valid. Pastikan menyertakan kode negara (contoh: 628xxx).");
      }
      const targetJid = typeof makeJid === "function" ? makeJid(cleanNum) : `${cleanNum}@s.whatsapp.net`;
      if (typeof ensureUser === "function") {
        ensureUser(targetJid, cleanNum);
      }
      if (!durationInput && actionInput !== "remove") {
        await ctx.react("⏳");
        const userDb = global.db?.user?.[targetJid] || {};
        const isPrem = Boolean(userDb.premium?.status && (userDb.premium.expiredAt > Date.now() || userDb.premium.expiredAt === Number.MAX_SAFE_INTEGER));
        const currentExp = isPrem ? formatDate(userDb.premium.expiredAt) : "Tidak Aktif";
        const listSections = [{
          title: `⚡ PAKET DURASI CEPAT`,
          rows: [{
            title: `⏱️ 1 Hari Trial`,
            id: `${prefix}setprem -u ${cleanNum} -d 1hari -a add`,
            description: `Aktifkan akses premium selama 24 jam`
          }, {
            title: `📅 7 Hari (1 Minggu)`,
            id: `${prefix}setprem -u ${cleanNum} -d 7hari -a add`,
            description: `Aktifkan akses premium selama 7 hari`
          }, {
            title: `🌟 30 Hari (1 Bulan)`,
            id: `${prefix}setprem -u ${cleanNum} -d 30hari -a add`,
            description: `Aktifkan akses premium selama 30 hari penuh`
          }, {
            title: `👑 Akses Permanen`,
            id: `${prefix}setprem -u ${cleanNum} -d permanen -a add`,
            description: `Akses premium tanpa batas waktu (Forever)`
          }]
        }, {
          title: `🗑️ MANAJEMEN AKSES`,
          rows: [{
            title: `❌ Cabut Status Premium`,
            id: `${prefix}setprem -u ${cleanNum} -a remove`,
            description: `Nonaktifkan status premium nomor ini sekarang`
          }]
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🌟 PILIH DURASI PREMIUM`,
            sections: listSections
          })
        }];
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const bodyText = `⚡ *PREMIUM USER CONFIGURATION*\n\n` + `• *Target User:* +${cleanNum}\n` + `• *Status Saat Ini:* ${isPrem ? "Aktif ✅" : "Non-Aktif ❌"}\n` + `• *Masa Berlaku:* \`${currentExp}\`\n\n` + `_Pilih durasi paket pada menu tombol di bawah ini untuk mengonfirmasi:_`;
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Atur Premium`,
              button_title: "🌟 Buka Pilihan Durasi"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Premium Manager ✦`,
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
          await ctx.reply(bodyText);
        }
        await ctx.react("✅");
        return;
      }
      await ctx.react("⏳");
      if (!global.db.user[targetJid]) {
        global.db.user[targetJid] = {};
      }
      if (!global.db.user[targetJid].premium) {
        global.db.user[targetJid].premium = {
          status: false,
          expiredAt: 0
        };
      }
      const userPremium = global.db.user[targetJid].premium;
      const now = Date.now();
      if (actionInput === "remove" || actionInput === "del" || actionInput === "min") {
        userPremium.status = false;
        userPremium.expiredAt = 0;
        if (typeof db?.write === "function") {
          db.write(global.db);
        }
        const removeText = `🗑️ *PREMIUM STATUS DINONAKTIFKAN*\n\n` + `╭───『 *INFORMASI USER* 』\n` + `│ 👤 *User:* +${cleanNum}\n` + `│ 🆔 *JID:* \`${targetJid}\`\n` + `│ 🔒 *Status:* Regular User (Free)\n` + `╰──────────────────\n\n` + `_Akses fitur premium pada nomor ini telah resmi dihentikan._`;
        await ctx.reply(removeText);
        await ctx.react("✅");
        return;
      }
      const parsed = parseDuration(durationInput);
      if (!parsed) {
        await ctx.react("❌");
        return ctx.reply(`❌ Format durasi *"${durationInput}"* tidak valid!\nContoh yang valid: \`1jam\`, \`3hari\`, \`1minggu\`, \`1bulan\`, \`permanen\`.`);
      }
      if (parsed.ms === Number.MAX_SAFE_INTEGER) {
        userPremium.expiredAt = Number.MAX_SAFE_INTEGER;
      } else {
        const baseTime = userPremium.status && userPremium.expiredAt > now ? userPremium.expiredAt : now;
        userPremium.expiredAt = baseTime + parsed.ms;
      }
      userPremium.status = true;
      if (typeof db?.write === "function") {
        db.write(global.db);
      }
      const successText = `🎉 *PREMIUM BERHASIL DIAKTIFKAN*\n\n` + `╭───『 *DETAIL SUBSCRIPTION* 』\n` + `│ 👤 *User:* +${cleanNum}\n` + `│ ⏳ *Durasi Tambahan:* ${parsed.label}\n` + `│ 📅 *Expired:* \`${formatDate(userPremium.expiredAt)}\`\n` + `│ ✨ *Status:* Aktif (VIP Member)\n` + `╰──────────────────\n\n` + `_Pengguna ini sekarang dapat menikmati seluruh akses fitur premium._`;
      await ctx.reply(successText);
      await ctx.react("✅");
    } catch (e) {
      console.error("[SetPremium Error]:", e?.message || e);
      await ctx.react("❌");
      ctx.reply(`❌ *SetPremium Error:*\n\`\`\`${e?.message || e}\`\`\``);
    }
  }
};