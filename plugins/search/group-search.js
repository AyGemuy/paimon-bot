import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/search/group-wa/v9";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["limit", "size", "count", "l"].includes(lowerKey)) key = "limit";
    if (["query", "q", "search"].includes(lowerKey)) key = "query";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
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
  name: "gcsearch",
  aliases: ["carigrup", "searchgc", "groupsearch", "grupwa", "carigc"],
  description: "Cari tautan/link grup WhatsApp berdasarkan kata kunci",
  category: "Search",
  limit: true,
  example: "gcsearch jb atau gcsearch anime --limit 10",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["gcsearch", "carigrup", "searchgc", "groupsearch", "grupwa", "carigc"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const searchQuery = flags.query || cleanPrompt;
      const limit = Number(flags.limit) || 5;
      if (!searchQuery) {
        return ctx.reply(`🔍 *WHATSAPP GROUP SEARCH*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari grup: \`${prefix}gcsearch jb\`\n` + `  👉 Atur limit hasil: \`${prefix}gcsearch anime --limit 10\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--limit <jumlah>\` (Batas jumlah hasil, default: \`5\`)\n` + `  • \`--query <kata_kunci>\` (Kata kunci pencarian grup)`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        query: searchQuery,
        limit: limit
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const groupList = data?.list || data?.data || data?.results || [];
      if (!groupList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan grup WhatsApp untuk kata kunci: *"${searchQuery}"*`);
      }
      const groupRows = groupList.map((g, i) => {
        const title = (g.title || `Grup ${i + 1}`).trim();
        const link = g.join_link || g.invite_link || "";
        const category = g.details?.category ? g.details.category.replace(/_/g, " ") : "Umum";
        return {
          title: `${i + 1}. ${title}`.slice(0, 24),
          description: `Kategori: ${category} • Periksa grup`,
          id: `${prefix}cekgc ${link}`
        };
      });
      const topGroup = groupList[0];
      const previewThumb = topGroup?.image || global.bot?.media?.banner1 || "https://files.catbox.moe/nurea0.jpg";
      const categoryTop = topGroup?.details?.category ? topGroup.details.category.replace(/_/g, " ") : "-";
      const descTop = (topGroup?.description || "Tidak ada deskripsi.").slice(0, 100);
      const bodyText = `🔍 *WHATSAPP GROUP SEARCH*\n\n` + `• *Kata Kunci:* \`${searchQuery}\`\n` + `• *Total Ditemukan:* ${data.total || groupList.length} Grup\n` + `• *Ditampilkan:* ${groupList.length} Grup (Limit: ${limit})\n\n` + `📌 *Grup Teratas:*\n` + `• *Nama:* ${topGroup.title}\n` + `• *Kategori:* ${categoryTop}\n` + `• *Deskripsi:* _${descTop}..._\n\n` + `_Pilih grup pada menu di bawah untuk memeriksa detail atau bergabung!_`;
      const footerText = `${botName} • Group Finder`;
      const buttons = [{
        name: "single_select",
        title: `👥 Pilih & Cek Grup WA (${groupList.length})`,
        sections: [{
          title: `Hasil: ${searchQuery}`,
          rows: groupRows
        }]
      }];
      const options = {
        image: previewThumb,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Group Search`,
            button_title: "Lihat Grup"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Group WA ✦`,
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
        let fallbackMsg = `🔍 *HASIL PENCARIAN GRUP WA*\n\n`;
        fallbackMsg += groupList.map((g, i) => `• *${i + 1}. ${g.title}*\n  Link: ${g.join_link || g.invite_link || "-"}`).join("\n\n");
        await ctx.reply(fallbackMsg);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Group Search Error: ${errorMessage}`);
    }
  }
};