import axios from "axios";
import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const SETTINGS = {
  noprefix: {
    name: "No Prefix",
    desc: "Respon bot tanpa tanda prefix",
    key: "noprefix",
    scope: "global"
  },
  self: {
    name: "Self Mode",
    desc: "Hanya merespon pesan Owner bot",
    key: "self",
    scope: "global"
  },
  maintenance: {
    name: "Maintenance",
    desc: "Kunci bot untuk mode perbaikan",
    key: "maintenance",
    scope: "global"
  },
  autoread: {
    name: "Auto Read",
    desc: "Otomatis membaca (centang biru) pesan",
    key: "autoRead",
    scope: "global"
  },
  autotyping: {
    name: "Auto Typing",
    desc: "Status mengetik saat bot memproses",
    key: "autoTyping",
    scope: "global"
  },
  antibot: {
    name: "Anti Bot",
    desc: "Blokir respon terhadap bot lain / Baileys",
    key: "antibot",
    scope: "group",
    aliases: ["antibotgc", "blockbot", "nootherbot"]
  },
  antilink: {
    name: "Anti Link",
    desc: "Hapus otomatis tautan link grup WhatsApp",
    key: "antilink",
    scope: "group",
    aliases: ["antilinkgc", "linkprotect"]
  },
  antitoxic: {
    name: "Anti Toxic",
    desc: "Hapus otomatis kata-kata kasar / kotor",
    key: "antitoxic",
    scope: "group",
    aliases: ["antibadword", "antikasik", "toxic"]
  },
  mute: {
    name: "Group Mute",
    desc: "Bot hanya merespon Owner & Admin grup",
    key: "mute",
    scope: "group",
    aliases: ["mutegroup", "botmute", "silent"]
  }
};

function findKey(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (SETTINGS[q]) return q;
  for (const [key, val] of Object.entries(SETTINGS)) {
    if (val.aliases?.includes(q)) return key;
  }
  return null;
}
const getState = (ctx, item) => {
  const chatId = ctx.chat || ctx.id;
  return item.scope === "group" ? Boolean(global.db?.group?.[chatId]?.[item.key]) : Boolean(global.bot?.[item.key]);
};
const setState = (ctx, item, val) => {
  const chatId = ctx.chat || ctx.id;
  if (item.scope === "group") {
    global.db = global.db || {};
    global.db.group = global.db.group || {};
    global.db.group[chatId] = global.db.group[chatId] || {};
    global.db.group[chatId][item.key] = val;
    if (typeof db?.write === "function") db.write(global.db);
  } else {
    if (!global.bot) global.bot = {};
    global.bot[item.key] = val;
  }
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["key", "k", "fitur", "setting", "opt"].includes(key)) key = "key";
    if (["state", "s", "val", "v", "status"].includes(key)) key = "state";
    if (["list", "l", "menu", "all"].includes(key)) key = "list";
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
  name: "setbot",
  aliases: ["enable", "disable", "on", "off", "botsetting", "botsettings", "antibot", "antibotgc", "blockbot", "antilink", "antilinkgc", "linkprotect", "antitoxic", "antibadword", "antikasik", "toxic", "mute", "mutegroup", "botmute", "silent"],
  description: "Mengaktifkan atau menonaktifkan setelan bot & grup via CLI & CTA Sheet",
  category: "Owner & Group",
  example: "setbot atau on antibot atau off self atau setbot -k mute -s on",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.command || ctx.cmd || "setbot").toLowerCase();
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Bot Control Panel`;
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setbot", "enable", "disable", "on", "off", "botsetting", "botsettings"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      if (flags.help) {
        const globalKeys = Object.entries(SETTINGS).filter(([, v]) => v.scope === "global").map(([k]) => `\`${k}\``).join(", ");
        const groupKeys = Object.entries(SETTINGS).filter(([, v]) => v.scope === "group").map(([k]) => `\`${k}\``).join(", ");
        return ctx.reply(`⚙️ *BOT & GROUP SETTINGS MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Buka Control Panel (CTA UI): \`${prefix}setbot\` atau \`${prefix}setbot --list\`\n` + `  👉 Aktifkan Fitur: \`${prefix}on antibot\` atau \`${prefix}setbot -k antilink -s on\`\n` + `  👉 Matikan Fitur: \`${prefix}off self\` atau \`${prefix}setbot -k self -s off\`\n` + `  👉 Toggle Cepat: \`${prefix}mute\` / \`${prefix}antibot\` / \`${prefix}antilink\`\n\n` + `• *Daftar Fitur Global (Owner):*\n` + `  ${globalKeys}\n\n` + `• *Daftar Fitur Grup (Admin):*\n` + `  ${groupKeys}\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-k, --key <fitur>\` (Nama opsi/fitur pengaturan)\n` + `  • \`-s, --state <on/off>\` (Status aktivasi fitur)\n` + `  • \`-l, --list\` (Buka interactive control panel)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      const isMenuCall = freeTokens.length === 0 && !flags.key && ["setbot", "botsetting", "botsettings"].includes(cmd) || flags.list;
      if (isMenuCall) {
        await ctx.react("⏳");
        let avatarUrl = global.bot?.media?.avatar || "https://picsum.photos/seed/cyber/200/200";
        try {
          avatarUrl = await sock.profilePictureUrl(ctx.chat || ctx.id, "image");
        } catch {
          try {
            avatarUrl = await sock.profilePictureUrl(sock.user?.id, "image");
          } catch {}
        }
        const botOwners = (global.bot?.owner || []).map(v => String(v).replace(/\D/g, ""));
        const adm1 = botOwners[0] ? `@${botOwners[0].slice(0, 10)}` : "@System_Root";
        const adm2 = botOwners[1] ? `@${botOwners[1].slice(0, 10)}` : "@Davi_AI";
        const totalUsers = Object.keys(global.db?.user || {}).length || 1;
        let mediaOutput = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        try {
          const cardPayload = {
            sub_title: "PROTOCOL: SYSTEM_CONTROL",
            title_l: (botName.split(" ")[0] || "SYSTEM").toUpperCase().slice(0, 10),
            title_r: ".PANEL",
            version: "BOT ENGINE V2.9",
            est: "EST. 2023.01.12",
            users: `${totalUsers.toLocaleString("id-ID")}`,
            u_title: "Registered Users",
            desc_title: "System Status",
            desc: "Pusat konfigurasi dan kontrol otomatisasi bot. Atur keamanan grup dan pengaturan bot global secara realtime.",
            tag_a: global.bot?.self ? "SELF_MODE" : "PUBLIC_OK",
            tag_b: global.bot?.autoRead ? "AUTOREAD_ON" : "PRO_VIBES",
            tag_c: global.bot?.maintenance ? "MAINTENANCE" : "ONLINE_24H",
            adm_title: "Root Operators",
            adm_name: adm1,
            adm_stat: "ROOT",
            cr_name: adm2,
            cr_stat: "LEAD",
            ds_name: "@Core_Engine",
            ds_stat: "MOD",
            act_title: "System Engine",
            avg_title: "AVG_DAILY",
            avg_count: "95",
            msg_title: "Traffic",
            msg_count: "1.2K",
            file_title: "Memory",
            file_count: "84MB",
            avatar: avatarUrl
          };
          const {
            data
          } = await axios.post("https://wudysoft.my.id/api/maker/grup/v1", cardPayload, {
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
          console.warn("[SetBot Maker Card Fail, fallback banner]:", err.message);
        }
        let bodyText = `⚙️ *BOT CONTROL PANEL*\n\n` + `*🌐 Global Settings (Owner Only):*\n`;
        for (const [, item] of Object.entries(SETTINGS)) {
          if (item.scope === "global") {
            const active = getState(ctx, item);
            bodyText += `• ${item.name} : ${active ? "🟢 *[ON]*" : "🔴 *[OFF]*"}\n`;
          }
        }
        bodyText += `\n*🛡️ Group Settings (Admin Only):*\n`;
        for (const [, item] of Object.entries(SETTINGS)) {
          if (item.scope === "group") {
            const active = getState(ctx, item);
            bodyText += `• ${item.name} : ${active ? "🟢 *[ON]*" : "🔴 *[OFF]*"}\n`;
          }
        }
        bodyText += `\n_Ketuk menu tombol di bawah untuk langsung mengubah status fitur:_`;
        const globalRows = [];
        const groupRows = [];
        for (const [k, item] of Object.entries(SETTINGS)) {
          const active = getState(ctx, item);
          const nextAction = active ? "off" : "on";
          const rowData = {
            title: `${active ? "🟢" : "🔴"} ${item.name}`,
            id: `${prefix}${nextAction} ${k}`,
            description: `Status: ${active ? "Aktif (ON)" : "Nonaktif (OFF)"} • Klik untuk ubah`
          };
          if (item.scope === "global") {
            globalRows.push(rowData);
          } else {
            groupRows.push(rowData);
          }
        }
        const sections = [{
          title: `🌐 GLOBAL SETTINGS (OWNER)`,
          rows: globalRows
        }, {
          title: `🛡️ GROUP SETTINGS (ADMIN)`,
          rows: groupRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "⚙️ UBAH PENGATURAN FITUR",
            sections: sections
          })
        }];
        const options = {
          image: mediaOutput,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Settings Panel`,
              button_title: "⚙️ Buka Control Panel"
            },
            limited_time_offer: {
              text: `✦ ${botName} - System Control ✦`,
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
      let targetKey = flags.key ? findKey(flags.key) : null;
      let targetVal = null;
      const directKey = findKey(cmd);
      if (flags.state !== undefined) {
        if (["on", "enable", "1", "true", true].includes(flags.state)) targetVal = true;
        else if (["off", "disable", "0", "false", false].includes(flags.state)) targetVal = false;
      }
      if (directKey) {
        targetKey = directKey;
        const opt = (freeTokens[0] || "").toLowerCase();
        if (["on", "enable", "1", "true"].includes(opt)) targetVal = true;
        else if (["off", "disable", "0", "false"].includes(opt)) targetVal = false;
        else if (targetVal === null) targetVal = !getState(ctx, SETTINGS[targetKey]);
      } else if (["on", "enable"].includes(cmd)) {
        targetVal = true;
        targetKey = targetKey || findKey(freeTokens[0] || "");
      } else if (["off", "disable"].includes(cmd)) {
        targetVal = false;
        targetKey = targetKey || findKey(freeTokens[0] || "");
      } else {
        targetKey = targetKey || findKey(freeTokens[0] || "");
        const opt = (freeTokens[1] || "").toLowerCase();
        if (["on", "enable", "1", "true"].includes(opt)) targetVal = true;
        else if (["off", "disable", "0", "false"].includes(opt)) targetVal = false;
        else if (targetKey && targetVal === null) targetVal = !getState(ctx, SETTINGS[targetKey]);
      }
      if (!targetKey || !SETTINGS[targetKey]) {
        const listKeys = Object.keys(SETTINGS).map(k => `\`${k}\``).join(", ");
        return ctx.reply(`❌ Opsi fitur tidak ditemukan!\n\n📌 *Daftar Pilihan:* ${listKeys}\nContoh: \`${prefix}on antibot\` atau \`${prefix}setbot -k antilink -s on\``);
      }
      const item = SETTINGS[targetKey];
      if (item.scope === "global" && !ctx.isOwner) {
        return ctx.reply("❌ Pengaturan global ini hanya dapat diubah oleh *Owner Bot*.");
      }
      if (item.scope === "group") {
        if (!ctx.isGroup) {
          return ctx.reply("❌ Fitur grup ini hanya dapat diatur di dalam *Grup WhatsApp*.");
        }
        if (!ctx.isAdmin && !ctx.isOwner) {
          return ctx.reply("❌ Fitur ini hanya dapat diubah oleh *Admin Grup* atau *Owner Bot*.");
        }
      }
      setState(ctx, item, targetVal);
      await ctx.react(targetVal ? "✅" : "🛑");
      return ctx.reply(`⚙️ *PENGATURAN DIPERBARUI*\n\n` + `╭───『 *DETAIL SETTINGS* 』\n` + `│ 🔧 *Fitur:* ${item.name}\n` + `│ 📊 *Status:* ${targetVal ? "🟢 *AKTIF (ON)*" : "🔴 *NONAKTIF (OFF)*"}\n` + `│ 🎯 *Scope:* ${item.scope.toUpperCase()}\n` + `╰──────────────────\n\n` + `📝 _${item.desc}_`);
    } catch (err) {
      console.error("[SetBot Error]:", err);
      await ctx.react("❌");
      return ctx.reply(`❌ *SetBot Error:*\n\`\`\`${err.message || err}\`\`\``);
    }
  }
};