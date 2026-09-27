import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/tools/paste/v1";

function parseCli(rawInput = "") {
  const tokens = rawInput.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^["']|["']$/g, "")) || [];
  const cli = {
    action: null,
    key: null,
    search: null,
    page: 1,
    title: "Code Snippet",
    syntax: "javascript",
    expire: null,
    body: null,
    freeArgs: []
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (["--get", "-g", "get", "read"].includes(lower)) {
      cli.action = "get";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.key = tokens[++i];
    } else if (["--delete", "--del", "-d", "delete", "del"].includes(lower)) {
      cli.action = "delete";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.key = tokens[++i];
    } else if (["--clear", "-c", "clear"].includes(lower)) {
      cli.action = "clear";
    } else if (["--list", "-l", "list"].includes(lower)) {
      cli.action = "list";
      if (tokens[i + 1] && !isNaN(tokens[i + 1])) cli.page = parseInt(tokens[++i], 10);
    } else if (["--search", "--find", "-s", "-f", "search", "find"].includes(lower)) {
      cli.action = "search";
      if (tokens[i + 1] && !tokens[i + 1].startsWith("-")) cli.search = tokens[++i];
    } else if (["--page", "-p"].includes(lower) && tokens[i + 1]) {
      cli.page = parseInt(tokens[++i], 10) || 1;
    } else if (["--title", "-t"].includes(lower) && tokens[i + 1]) {
      cli.title = tokens[++i];
    } else if (["--syntax", "--lang"].includes(lower) && tokens[i + 1]) {
      cli.syntax = tokens[++i].toLowerCase();
    } else if (["--key", "-k"].includes(lower) && tokens[i + 1]) {
      cli.key = tokens[++i];
    } else if (["--expire", "-e"].includes(lower) && tokens[i + 1]) {
      cli.expire = parseInt(tokens[++i], 10);
    } else if (["--body", "-b", "--data"].includes(lower) && tokens[i + 1]) {
      cli.body = tokens[++i];
    } else {
      cli.freeArgs.push(token);
    }
  }
  return cli;
}
async function callPasteApi(bodyPayload) {
  const response = await axios.post(API_BASE, bodyPayload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 3e4,
    validateStatus: status => status < 500
  });
  return response.data;
}
export default {
  name: "pastecode",
  aliases: ["paste", "pastebin", "hastebin", "getpaste", "pastelist", "pastesearch"],
  description: "CLI Cloud Pastebin dengan Search, Pagination & Interactive CTA",
  category: "Tools",
  limit: true,
  example: ".pastecode --list -p 2 | .pastecode --search query | .pastecode -t 'Judul' -b 'kode'",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const botName = global.bot?.name || "Bot";
      const footerText = `${botName} • Pastebin CLI Cloud`;
      let quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || "").trim();
      if (!quotedText && (ctx.isMedia || ctx.quoted?.isMedia)) {
        try {
          const downloadFn = ctx.quoted?.download || ctx.download;
          const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
          if (buffer && Buffer.isBuffer(buffer)) {
            quotedText = buffer.toString("utf-8").trim();
          }
        } catch {}
      }
      const rawInput = (ctx.args ? ctx.args.join(" ") : ctx.query || "").trim();
      const cli = parseCli(rawInput);
      if (ctx.command === "getpaste") cli.action = "get";
      if (ctx.command === "pastelist") cli.action = "list";
      if (ctx.command === "pastesearch") cli.action = "search";
      if (cli.action === "get") {
        const pasteKey = cli.key || cli.freeArgs[0];
        if (!pasteKey) {
          return ctx.reply(`❌ Masukkan key paste yang ingin dibaca!\nContoh: \`${prefix}pastecode --get AbCd123\``);
        }
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "get",
          key: pasteKey
        });
        if (!data || data.error) {
          await ctx.react("❌");
          return ctx.reply(`❌ ${data?.error || "Paste tidak ditemukan atau telah kedaluwarsa."}`);
        }
        const rawUrl = `${API_BASE}?action=get&key=${data.key}&raw=true`;
        const createdAt = data.createdAt ? new Date(data.createdAt).toLocaleString("id-ID") : "-";
        const bodyText = `📋 *PASTE DETAILS (READ)*\n\n` + `╭───『 *INFORMASI* 』\n` + `│ 📌 *Judul:* ${data.title || "Untitled"}\n` + `│ 🔑 *Key:* \`${data.key}\`\n` + `│ 🏷️ *Sintaks:* \`${data.syntax || "text"}\`\n` + `│ 📅 *Dibuat:* ${createdAt}\n` + `╰──────────────────\n\n` + `📝 *Isi Konten:*\n` + `\`\`\`${data.syntax || "text"}\n${data.content}\n\`\`\``;
        const buttons = [{
          display_text: "📋 Salin Isi Kode",
          copy_code: String(data.content || "")
        }, {
          display_text: "🌐 Buka Raw Link",
          url: rawUrl
        }, {
          display_text: "🗑️ Hapus Paste",
          id: `${prefix}pastecode --delete ${data.key}`
        }, {
          display_text: "📂 Lihat List",
          id: `${prefix}pastecode --list`
        }];
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 PASTE: ${data.title || data.key} 乂`,
          subtitle: `Syntax: ${data.syntax || "text"}`,
          quoted: quotedMsg
        });
      }
      if (cli.action === "delete") {
        const pasteKey = cli.key || cli.freeArgs[0];
        if (!pasteKey) {
          return ctx.reply(`❌ Masukkan key paste yang ingin dihapus!\nContoh: \`${prefix}pastecode --delete AbCd123\``);
        }
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "delete",
          key: pasteKey
        });
        if (!data || data.error) {
          await ctx.react("❌");
          return ctx.reply(`❌ ${data?.error || "Gagal menghapus paste."}`);
        }
        const bodyText = `🗑️ *PASTE BERHASIL DIHAPUS*\n\nPaste dengan key \`${pasteKey}\` telah dihapus secara permanen dari cloud.`;
        const buttons = [{
          display_text: "📂 Kembali ke List",
          id: `${prefix}pastecode --list`
        }];
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 DELETE SUCCESS 乂",
          quoted: quotedMsg
        });
      }
      if (cli.action === "clear") {
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "clear"
        });
        await ctx.react("✅");
        return ctx.reply(`🧹 *SEMUA PASTE DIBERSIHKAN*\n\n${data?.message || "Seluruh data pastebin telah di-reset."}`);
      }
      if (cli.action === "list" || cli.action === "search") {
        await ctx.react("⏳");
        const data = await callPasteApi({
          action: "list"
        });
        let pasteList = Array.isArray(data) ? data : [];
        if (pasteList.length === 0) {
          await ctx.react("✅");
          return ctx.reply(`📂 *DAFTAR PASTE KOSONG*\n\nBelum ada snippet kode yang tersimpan di cloud.\n\n👉 *Buat baru:* \`${prefix}pastecode -t "Judul" -b "kode"\``);
        }
        const searchQuery = cli.search || (cli.action === "search" ? cli.freeArgs.join(" ") : "");
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          pasteList = pasteList.filter(p => (p.title || "").toLowerCase().includes(q) || (p.key || "").toLowerCase().includes(q) || (p.syntax || "").toLowerCase().includes(q));
        }
        if (pasteList.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`🔍 *HASIL TIDAK DITEMUKAN*\n\nTidak ditemukan snippet dengan kata kunci: *"${searchQuery}"*`);
        }
        const itemsPerPage = 10;
        const totalItems = pasteList.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        let page = cli.page || 1;
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        const startIndex = (page - 1) * itemsPerPage;
        const currentPageItems = pasteList.slice(startIndex, startIndex + itemsPerPage);
        const pasteRows = currentPageItems.map((p, i) => ({
          header: `Item #${startIndex + i + 1}`,
          title: (p.title || "Untitled").slice(0, 24),
          description: `Key: ${p.key} | Syntax: ${p.syntax || "text"}`,
          id: `${prefix}pastecode --get ${p.key}`
        }));
        const listSections = [{
          title: `📑 HALAMAN ${page}/${totalPages} (${totalItems} Snippet)`,
          rows: pasteRows
        }];
        let bodyText = searchQuery ? `🔍 *CLI SEARCH RESULTS*\n` + `Query: *"${searchQuery}"*\n` + `Ditemukan: *${totalItems}* snippet (Hal ${page}/${totalPages})\n\n` : `📂 *CLI PASTEBIN DASHBOARD*\n` + `Total: *${totalItems}* snippet (Hal ${page}/${totalPages})\n\n`;
        bodyText += `Pilih snippet pada menu di bawah atau gunakan tombol navigasi:`;
        const buttons = [{
          title: "📂 PILIH SNIPPET UNTUK DIBACA",
          sections: listSections
        }];
        if (page > 1) {
          buttons.push({
            display_text: `⬅️ Hal ${page - 1}`,
            id: searchQuery ? `${prefix}pastecode --search "${searchQuery}" -p ${page - 1}` : `${prefix}pastecode --list -p ${page - 1}`
          });
        }
        if (page < totalPages) {
          buttons.push({
            display_text: `➡️ Hal ${page + 1}`,
            id: searchQuery ? `${prefix}pastecode --search "${searchQuery}" -p ${page + 1}` : `${prefix}pastecode --list -p ${page + 1}`
          });
        }
        await ctx.react("✅");
        return await ctx.sendCta(bodyText, footerText, buttons, {
          title: searchQuery ? "乂 CLI SEARCH 乂" : "乂 CLI LIST 乂",
          subtitle: `Page ${page} of ${totalPages}`,
          quoted: quotedMsg
        });
      }
      let content = cli.body || quotedText || cli.freeArgs.join(" ").trim();
      if (/^https?:\/\/[^\s]+$/i.test(content)) {
        try {
          const res = await axios.get(content, {
            responseType: "text",
            timeout: 15e3
          });
          content = typeof res.data === "string" ? res.data : JSON.stringify(res.data, null, 2);
        } catch {}
      }
      if (!content) {
        const helpText = `📑 *PASTEBIN CLOUD MANAGER (CLI INTERFACE)*\n\n` + `╭───『 *DAFTAR FLAGS CLI* 』\n` + `│ 🔹 *Buat Paste:* \n` + `│   👉 \`${prefix}pastecode -t "Judul" --syntax js -b "isi kode"\`\n` + `│ 🔹 *Baca Paste:* \n` + `│   👉 \`${prefix}pastecode --get <key>\`\n` + `│ 🔹 *Cari Snippet:* \n` + `│   👉 \`${prefix}pastecode --search "kata kunci" -p 1\`\n` + `│ 🔹 *Daftar & Paginasi:* \n` + `│   👉 \`${prefix}pastecode --list -p 2\`\n` + `│ 🔹 *Hapus Paste:* \n` + `│   👉 \`${prefix}pastecode --delete <key>\`\n` + `╰────────────────────────`;
        const buttons = [{
          display_text: "📂 Lihat Semua List",
          id: `${prefix}pastecode --list`
        }];
        return await ctx.sendCta(helpText, footerText, buttons, {
          title: "乂 CLI HELPER 乂",
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const data = await callPasteApi({
        action: "create",
        title: String(cli.title || "Code Snippet"),
        content: String(content),
        syntax: String(cli.syntax || "javascript"),
        ...cli.key && {
          key: String(cli.key)
        },
        ...cli.expire && {
          expireIn: parseInt(cli.expire, 10)
        }
      });
      if (!data || data.error || !data.key) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal membuat paste: ${data?.error || "Terjadi kesalahan pada server."}`);
      }
      const rawUrl = `${API_BASE}?action=get&key=${data.key}&raw=true`;
      const createdAt = new Date(data.createdAt || Date.now()).toLocaleString("id-ID");
      const bodyText = `✅ *PASTE BERHASIL DIBUAT (CLI)*\n\n` + `╭───『 *INFORMASI PASTE* 』\n` + `│ 📌 *Judul:* ${data.title}\n` + `│ 🔑 *Key:* \`${data.key}\`\n` + `│ 🏷️ *Sintaks:* \`${data.syntax}\`\n` + `│ 📅 *Dibuat:* ${createdAt}\n` + (data.expiresAt ? `│ ⏳ *Kedaluwarsa:* ${new Date(data.expiresAt).toLocaleString("id-ID")}\n` : "") + `╰──────────────────\n\n` + `🔗 *Raw Link:* \n${rawUrl}`;
      const buttons = [{
        display_text: "📋 Salin Key Paste",
        copy_code: String(data.key)
      }, {
        display_text: "📖 Baca Paste",
        id: `${prefix}pastecode --get ${data.key}`
      }, {
        display_text: "🌐 Buka Link",
        url: rawUrl
      }, {
        display_text: "🗑️ Hapus Paste",
        id: `${prefix}pastecode --delete ${data.key}`
      }];
      await ctx.react("✅");
      return await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 PASTE CREATED 乂",
        subtitle: `Key: ${data.key}`,
        quoted: quotedMsg
      });
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ PasteCode CLI Error: ${errMsg}`);
    }
  }
};