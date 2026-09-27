import fs from "fs";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatSize = bytes => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

function getAllPlugins(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getAllPlugins(fullPath, baseDir));
    } else if (/\.(js|mjs|cjs)$/i.test(file)) {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      const parts = relativePath.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
      results.push({
        name: file.replace(/\.(js|mjs|cjs)$/i, ""),
        filename: file,
        relativePath: relativePath,
        fullPath: fullPath,
        folder: folder.toUpperCase(),
        size: stat.size
      });
    }
  }
  return results;
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["get", "g", "file", "f"].includes(key)) key = "get";
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
  name: "getplugin",
  aliases: ["gp", "ambilplugin", "plugin", "sp"],
  description: "Ambil file source code plugin dalam bentuk dokumen JS via CLI & CTA Sheet",
  category: "Owner",
  owner: true,
  example: "getplugin -l atau getplugin toimg atau getplugin -g toimg.js atau getplugin -s sticker",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.isOwner) {
        return ctx.reply("❌ Perintah ini hanya dapat diakses oleh Owner bot.");
      }
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["getplugin", "gp", "ambilplugin", "plugin", "sp"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const footerText = `${botName} • Plugin File Manager`;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const hasAction = Boolean(flags.get || flags.search || flags.list || flags.all || cleanPrompt);
      if (!hasAction || flags.help) {
        return ctx.reply(`📦 *PLUGIN SOURCE CODE MANAGER (CLI)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Buka Menu / Folder Plugin: \`${prefix}getplugin --list\` atau \`${prefix}getplugin -l\`\n` + `  👉 Unduh Plugin Langsung: \`${prefix}getplugin <nama/path>\` atau \`${prefix}getplugin -g <nama>\`\n` + `  👉 Cari Plugin Tertentu: \`${prefix}getplugin -s <query>\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`-l, --list\` (Buka menu interaktif CTA seluruh plugin)\n` + `  • \`-g, --get <nama/path>\` (Unduh file dokumen .js plugin)\n` + `  • \`-s, --search <kata kunci>\` (Filter/cari plugin sesuai nama)\n` + `  • \`-h, --help\` (Menampilkan panduan bantuan ini)`);
      }
      const pluginsDir = path.join(process.cwd(), "plugins");
      if (!fs.existsSync(pluginsDir)) {
        return ctx.reply("❌ Folder `plugins` tidak ditemukan di direktori root bot.");
      }
      const allPlugins = getAllPlugins(pluginsDir);
      if (allPlugins.length === 0) {
        return ctx.reply("📂 Tidak ada file plugin (`.js`) yang ditemukan di dalam folder `plugins`.");
      }
      let targetPlugin = null;
      const queryGet = typeof flags.get === "string" ? flags.get : cleanPrompt;
      if (queryGet && !flags.list && !flags.search) {
        const q = queryGet.toLowerCase().replace(/\\/g, "/");
        targetPlugin = allPlugins.find(p => p.relativePath.toLowerCase() === q || p.relativePath.toLowerCase() === `${q}.js` || p.filename.toLowerCase() === q || p.name.toLowerCase() === q);
      }
      if (targetPlugin) {
        await ctx.react("⏳");
        const fileBuffer = fs.readFileSync(targetPlugin.fullPath);
        await sock.sendMessage(ctx.id, {
          document: fileBuffer,
          mimetype: "application/javascript",
          fileName: targetPlugin.filename,
          caption: `📦 *PLUGIN SOURCE CODE*\n\n` + `│ 📄 *File:* \`${targetPlugin.filename}\`\n` + `│ 📂 *Path:* \`plugins/${targetPlugin.relativePath}\`\n` + `│ 📊 *Ukuran:* ${formatSize(targetPlugin.size)}\n\n` + `_${botName} • Automation Engine_`
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      await ctx.react("⏳");
      const searchQuery = (typeof flags.search === "string" ? flags.search : cleanPrompt).trim();
      const isSearch = Boolean(searchQuery && !flags.list);
      let filteredList = allPlugins;
      if (isSearch) {
        const q = searchQuery.toLowerCase();
        filteredList = allPlugins.filter(p => p.name.toLowerCase().includes(q) || p.relativePath.toLowerCase().includes(q));
      }
      if (filteredList.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`🔍 *PLUGIN TIDAK DITEMUKAN*\n\n` + `Tidak ditemukan plugin dengan kata kunci: *"${searchQuery}"*\n\n` + `Ketik \`${prefix}getplugin -l\` untuk melihat semua plugin yang ada.`);
      }
      const folders = [...new Set(filteredList.map(p => p.folder))].sort();
      const listSections = folders.map(folder => {
        const folderPlugins = filteredList.filter(p => p.folder === folder);
        return {
          title: `📁 FOLDER: ${folder} (${folderPlugins.length})`,
          rows: folderPlugins.map(p => ({
            title: `📄 ${p.filename}`.slice(0, 24),
            id: `${prefix}getplugin -g ${p.relativePath}`,
            description: `Path: plugins/${p.relativePath} • (${formatSize(p.size)})`
          }))
        };
      });
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `📂 PILIH & UNDUH PLUGIN (${filteredList.length})`,
          sections: listSections
        })
      }];
      const bannerImage = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const bodyText = isSearch ? `🔍 *HASIL PENCARIAN PLUGIN*\n\n` + `• *Kata Kunci:* \`${searchQuery}\`\n` + `• *Ditemukan:* ${filteredList.length} file\n` + `• *Total Folder:* ${folders.length} folder\n\n` + `_Pilih salah satu file plugin pada menu di bawah untuk mengunduh:_` : `📂 *PLUGIN FILE MANAGER*\n\n` + `• *Total Plugins:* ${allPlugins.length} file\n` + `• *Total Folder:* ${folders.length} folder\n\n` + `_Pilih folder dan file plugin pada menu interaktif di bawah untuk mengunduh:_`;
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Plugin Manager`,
            button_title: "📂 Buka Daftar Plugin"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Plugin Source Code ✦`,
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
        filteredList.slice(0, 30).forEach((p, idx) => {
          listText += `${idx + 1}. \`${prefix}getplugin -g ${p.relativePath}\`\n`;
        });
        if (filteredList.length > 30) {
          listText += `\n_...dan ${filteredList.length - 30} plugin lainnya._`;
        }
        await ctx.reply(listText);
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[GetPlugin Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ *GetPlugin Error:*\n\`\`\`${error?.message || error}\`\`\``);
    }
  }
};