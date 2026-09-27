import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const GROUP_FEATURES = {
  welcome: {
    name: "Welcome Message",
    desc: "Kirim pesan sambutan otomatis saat ada member baru bergabung",
    key: "welcome",
    aliases: ["sambut", "sambutan", "wel"]
  },
  leave: {
    name: "Leave Message",
    desc: "Kirim pesan perpisahan saat ada member yang keluar / di-kick",
    key: "leave",
    aliases: ["goodbye", "keluar", "out"]
  },
  antidelete: {
    name: "Anti Delete",
    desc: "Kirim ulang pesan teks / media yang ditarik atau dihapus member",
    key: "antidelete",
    aliases: ["antitarik", "antidel", "deleted"]
  },
  nsfw: {
    name: "NSFW (+18 Mode)",
    desc: "Izinkan akses fitur, pencarian, dan media dewasa (+18) di grup",
    key: "nsfw",
    aliases: ["dewasa", "porn", "hentai"]
  },
  antilink: {
    name: "Anti Link WhatsApp",
    desc: "Hapus otomatis pesan member yang mengirim tautan link grup",
    key: "antilink",
    aliases: ["antilinkgc", "linkprotect", "link"]
  },
  mute: {
    name: "Group Mute (Silent)",
    desc: "Bot hanya merespon perintah dari Admin & Owner di grup ini",
    key: "mute",
    aliases: ["botmute", "silent", "mutegc"]
  }
};

function findFeatureKey(query = "") {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  if (GROUP_FEATURES[q]) return q;
  for (const [key, val] of Object.entries(GROUP_FEATURES)) {
    if (val.aliases?.includes(q)) return key;
  }
  return null;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["key", "k", "fitur", "setting", "feature", "f"].includes(key)) key = "key";
    if (["state", "s", "val", "v", "status", "opt"].includes(key)) key = "state";
    if (["list", "l", "menu", "all", "panel"].includes(key)) key = "list";
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
  name: "setgroup",
  aliases: ["groupsetting", "gcset", "gcsetting", "groupconfig", "welcome", "leave", "antidelete", "nsfw"],
  description: "Kelola setelan fitur grup (Welcome, Leave, AntiDelete, NSFW, AntiLink, Mute) via CTA Sheet",
  category: "Group",
  admin: true,
  group: true,
  example: "setgroup atau welcome on atau leave off atau antidelete on atau nsfw off",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isGroup) {
        return ctx.reply("❌ Perintah ini hanya dapat dijalankan di dalam *Grup WhatsApp*.");
      }
      if (!ctx.isAdmin && !ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diatur oleh *Admin Grup* atau *Owner Bot*.");
      }
      const prefix = ctx.prefix || ".";
      const cmd = (ctx.command || ctx.cmd || "setgroup").toLowerCase();
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Group Security & Automation`;
      const chatId = ctx.chat || ctx.id;
      if (typeof db.ensureGroup === "function") {
        db.ensureGroup(chatId);
      } else {
        if (!global.db) global.db = {};
        if (!global.db.group) global.db.group = {};
        if (!global.db.group[chatId]) {
          global.db.group[chatId] = {
            from: chatId,
            config: {},
            bans: false,
            mute: false,
            welcome: false,
            leave: false,
            antilink: false,
            antidelete: false,
            nsfw: false
          };
        }
      }
      const groupData = global.db.group[chatId];
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["setgroup", "groupsetting", "gcset", "gcsetting", "groupconfig", "welcome", "leave", "antidelete", "nsfw"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const freeTokens = cleanPrompt.split(/\s+/).filter(Boolean);
      if (flags.help) {
        const allKeys = Object.keys(GROUP_FEATURES).map(k => `\`${k}\``).join(", ");
        return ctx.reply(`🛡️ *GROUP CONFIGURATION MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Buka Control Panel (CTA UI): \`${prefix}setgroup\` atau \`${prefix}gcset --list\`\n` + `  👉 Aktifkan Fitur: \`${prefix}welcome on\` atau \`${prefix}antidelete on\`\n` + `  👉 Matikan Fitur: \`${prefix}nsfw off\` atau \`${prefix}leave off\`\n` + `  👉 Toggle Cepat: Ketik \`${prefix}welcome\` / \`${prefix}antidelete\` langsung\n\n` + `• *Daftar Fitur Grup:*\n` + `  ${allKeys}\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-k, --key <fitur>\` (Nama opsi/fitur grup)\n` + `  • \`-s, --state <on/off>\` (Status aktivasi fitur)\n` + `  • \`-l, --list\` (Buka interactive control panel)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      const isDirectAlias = ["welcome", "leave", "antidelete", "nsfw"].includes(cmd);
      const isMenuCall = freeTokens.length === 0 && !flags.key && !isDirectAlias || flags.list;
      if (isMenuCall) {
        await ctx.react("⏳");
        let groupMetadata = {};
        try {
          groupMetadata = await sock.groupMetadata(chatId);
        } catch {}
        let groupPic = "https://picsum.photos/seed/cyber/200/200";
        try {
          groupPic = await sock.profilePictureUrl(chatId, "image");
        } catch {}
        const groupName = groupMetadata.subject || ctx.groupName || "COMMUNITY";
        const nameParts = groupName.trim().split(/\s+/);
        const title_l = (nameParts[0] || "GROUP").slice(0, 10).toUpperCase();
        const title_r = (nameParts.slice(1).join(" ") || ".HQ").slice(0, 12).toUpperCase();
        let estDate = "EST. 2023.01.12";
        if (groupMetadata.creation) {
          const d = new Date(groupMetadata.creation * 1e3);
          estDate = `EST. ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
        }
        const admins = (groupMetadata.participants || []).filter(p => p.admin);
        const adm1 = admins[0] ? `@${admins[0].id.split("@")[0].slice(0, 10)}` : "@Davi_AI";
        const adm2 = admins[1] ? `@${admins[1].id.split("@")[0].slice(0, 10)}` : "@Kreator_X";
        const adm3 = admins[2] ? `@${admins[2].id.split("@")[0].slice(0, 10)}` : "@Z_Design";
        let mediaOutput = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        try {
          const groupPayload = {
            sub_title: "PROTOCOL: ENCRYPTED_COMM",
            title_l: title_l,
            title_r: title_r,
            version: "WHATSAPP V2.9",
            est: estDate,
            users: `${(groupMetadata.participants || []).length || 1}`,
            u_title: "Active Entities",
            desc_title: "Core mission",
            desc: (groupMetadata.desc || "Platform akselerasi visual dan pertukaran data kreatif. Dilarang spam, hargai privasi, dan gunakan kanal feedback untuk kolaborasi.").slice(0, 160),
            tag_a: groupData.antilink ? "ANTI_LINK" : "NO_ADS",
            tag_b: groupData.nsfw ? "NSFW_ON" : "PRO_VIBES",
            tag_c: groupData.welcome ? "WELCOME_ON" : "CREATIVE_ONLY",
            adm_title: "Security Admins",
            adm_name: adm1,
            adm_stat: "LEAD",
            cr_name: adm2,
            cr_stat: "MOD",
            ds_name: adm3,
            ds_stat: "MOD",
            act_title: "Activity Load",
            avg_title: "AVG_DAILY",
            avg_count: "72",
            msg_title: "Pesan",
            msg_count: "842",
            file_title: "Files",
            file_count: "124",
            avatar: groupPic
          };
          const {
            data
          } = await axios.post("https://wudysoft.my.id/api/maker/grup/v1", groupPayload, {
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
          console.warn("[Group Card Maker Fail, fallback banner]:", err.message);
        }
        let bodyText = `🛡️ *GROUP CONTROL PANEL*\n\n` + `*Status Fitur Grup Saat Ini:*\n`;
        for (const [, item] of Object.entries(GROUP_FEATURES)) {
          const isActive = Boolean(groupData[item.key]);
          bodyText += `• *${item.name}:* ${isActive ? "🟢 *[AKTIF]*" : "🔴 *[NONAKTIF]*"}\n`;
        }
        bodyText += `\n_Ketuk tombol menu di bawah untuk langsung menyalakan/mematikan fitur grup:_`;
        const actionRows = Object.entries(GROUP_FEATURES).map(([k, item]) => {
          const isActive = Boolean(groupData[item.key]);
          const nextAction = isActive ? "off" : "on";
          return {
            title: `${isActive ? "🟢" : "🔴"} ${item.name}`,
            id: `${prefix}${k} ${nextAction}`,
            description: `Status: ${isActive ? "ON" : "OFF"} • Klik untuk ${isActive ? "Matikan" : "Nyalakan"}`
          };
        });
        const listSections = [{
          title: `🛡️ PENGATURAN FITUR OTOMATISASI`,
          rows: actionRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `⚙️ BUKA PANEL FITUR GRUP`,
            sections: listSections
          })
        }];
        const options = {
          image: mediaOutput,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Group Security`,
              button_title: "🛡️ Buka Pengaturan Grup"
            },
            limited_time_offer: {
              text: `✦ ${botName} - Group Automation ✦`,
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
      let targetKey = flags.key ? findFeatureKey(flags.key) : null;
      let targetVal = null;
      const directKey = findFeatureKey(cmd);
      if (flags.state !== undefined) {
        if (["on", "enable", "1", "true", true].includes(flags.state)) targetVal = true;
        else if (["off", "disable", "0", "false", false].includes(flags.state)) targetVal = false;
      }
      if (directKey) {
        targetKey = directKey;
        const opt = (freeTokens[0] || "").toLowerCase();
        if (["on", "enable", "1", "true"].includes(opt)) targetVal = true;
        else if (["off", "disable", "0", "false"].includes(opt)) targetVal = false;
        else if (targetVal === null) targetVal = !Boolean(groupData[targetKey]);
      } else {
        targetKey = targetKey || findFeatureKey(freeTokens[0] || "");
        const opt = (freeTokens[1] || "").toLowerCase();
        if (["on", "enable", "1", "true"].includes(opt)) targetVal = true;
        else if (["off", "disable", "0", "false"].includes(opt)) targetVal = false;
        else if (targetKey && targetVal === null) targetVal = !Boolean(groupData[targetKey]);
      }
      if (!targetKey || !GROUP_FEATURES[targetKey]) {
        const listKeys = Object.keys(GROUP_FEATURES).map(k => `\`${k}\``).join(", ");
        return ctx.reply(`❌ Fitur tidak ditemukan!\n\n📌 *Daftar Pilihan:* ${listKeys}\nContoh: \`${prefix}welcome on\` atau \`${prefix}antidelete off\``);
      }
      const item = GROUP_FEATURES[targetKey];
      groupData[item.key] = targetVal;
      if (typeof db.write === "function") {
        db.write(global.db);
      }
      await ctx.react(targetVal ? "✅" : "🛑");
      return ctx.reply(`⚙️ *PENGATURAN GRUP DIPERBARUI*\n\n` + `╭───『 *DETAIL STATUS* 』\n` + `│ 🛡️ *Fitur:* ${item.name}\n` + `│ 📊 *Status Baru:* ${targetVal ? "🟢 *AKTIF (ON)*" : "🔴 *NONAKTIF (OFF)*"}\n` + `│ 👥 *Grup:* ${ctx.groupName || chatId.split("@")[0]}\n` + `╰──────────────────\n\n` + `📝 _${item.desc}_`);
    } catch (err) {
      console.error("[SetGroup Error]:", err);
      await ctx.react("❌");
      return ctx.reply(`❌ *SetGroup Error:*\n\`\`\`${err.message || err}\`\`\``);
    }
  }
};