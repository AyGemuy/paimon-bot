import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_API = "https://wudysoft.my.id/api/anime/waifu";

function parseFlags(input) {
  const flags = {};
  let version = "v1";
  const vMatch = input.match(/--v(\d+)/i);
  if (vMatch) {
    version = `v${vMatch[1]}`;
    input = input.replace(/--v\d+/gi, "").trim();
  }
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
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
    version: version,
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "waifu",
  aliases: ["animegirl", "waifupic", "waifus"],
  description: "Anime Waifu Image Generator & Explorer (Mendukung V1 - V7 via POST Body Override)",
  category: "Anime",
  example: "waifu atau waifu --v1 --pageSize 10 atau waifu --v6 --mode sfw --type hug atau waifu --v7",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("waifu") || firstWord.endsWith("waifupic") || firstWord.endsWith("waifus")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      await ctx.react("⏳");
      const {
        version,
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let bodyPayload = {};
      const endpointUrl = `${BASE_API}/${version}`;
      if (version === "v1") {
        bodyPayload = {
          action: flags.action || "images",
          isNsfw: flags.isNsfw ?? false,
          orderBy: flags.orderBy || "Random",
          pageSize: flags.pageSize || 10,
          ...flags
        };
      } else if (version === "v6") {
        bodyPayload = {
          mode: flags.mode || "sfw",
          type: flags.type || cleanPrompt || "waifu",
          ...flags
        };
      } else {
        bodyPayload = {
          ...cleanPrompt ? {
            query: cleanPrompt
          } : {},
          ...flags
        };
      }
      const {
        data
      } = await axios.post(endpointUrl, bodyPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || data.status === false && !Array.isArray(data.result)) {
        throw new Error(data?.message || "Gagal memuat data waifu dari server.");
      }
      let bannerImage = null;
      let bodyText = "";
      let buttons = [];
      const downloadRows = [];
      if (version === "v1") {
        const items = data.data?.items || data.items || [];
        if (items.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada gambar waifu yang ditemukan.");
        }
        const firstItem = items[0];
        bannerImage = firstItem.url;
        const totalCount = data.data?.totalCount || items.length;
        const firstTags = firstItem.tags?.map(t => t.name).join(", ") || "Waifu";
        const firstArtist = firstItem.artists?.[0]?.name || "Unknown Artist";
        bodyText = `🌸 *WAIFU GALLERY EXPLORER (${version.toUpperCase()})*\n\n` + `╭───『 *PREVIEW UTAMA (#1)* 』\n` + `│ 🏷️ *Tags:* ${firstTags}\n` + `│ 👤 *Artist:* ${firstArtist}\n` + `│ 📐 *Dimensi:* ${firstItem.width}x${firstItem.height}\n` + `│ 📁 *Ukuran File:* ${(firstItem.byteSize / 1024 / 1024).toFixed(2)} MB\n` + `│ ❤️ *Favorites:* ${firstItem.favorites || 0}\n` + `╰────────────────────────\n\n` + `📊 *Total Koleksi Tersedia:* ${totalCount} Gambar\n` + `_Pilih gambar lainnya pada daftar dropdown di bawah ini untuk melihat koleksi lainnya._`;
        items.forEach((item, index) => {
          const itemTags = item.tags?.map(t => t.name).join(", ") || "Anime Waifu";
          downloadRows.push({
            title: `[#${index + 1}] Waifu ${itemTags.slice(0, 20)}`,
            description: `Resolusi: ${item.width}x${item.height} • ID: ${item.id}`,
            id: `${prefix}waifu --v1 --id ${item.id}`
          });
        });
        buttons.push({
          name: "single_select",
          title: `📜 DAFTAR KOLEKSI WAIFU (${items.length})`,
          sections: [{
            title: `${botName} • Koleksi Gambar Waifu`,
            rows: downloadRows
          }]
        });
        if (firstItem.source) {
          buttons.push({
            name: "cta_url",
            display_text: "🌐 Sumber Asli",
            url: firstItem.source
          });
        }
        buttons.push({
          name: "cta_copy",
          display_text: "🔗 Salin URL Gambar #1",
          copy_code: firstItem.url
        });
        buttons.push({
          name: "quick_reply",
          display_text: "🔄 Random Lagi",
          id: `${prefix}waifu --v1`
        });
      } else if (version === "v6") {
        if (Array.isArray(data.result)) {
          const modeList = data.result.map(m => `• \`${m}\``).join("\n");
          bodyText = `🌸 *WAIFU V6 CATEGORIES*\n\n` + `Berikut pilihan yang tersedia untuk mode \`${data.mode || "kategori"}\`:\n\n` + `${modeList}\n\n` + `👉 *Contoh Pakai:* \`${prefix}waifu --v6 --mode ${data.mode || "sfw"} --type ${data.result[0]}\``;
          return ctx.reply(bodyText);
        }
        bannerImage = data.result;
        bodyText = `🌸 *WAIFU V6 GENERATED*\n\n` + `🎭 *Mode:* \`${data.mode || bodyPayload.mode}\`\n` + `🏷️ *Tipe:* \`${data.type || bodyPayload.type}\``;
        buttons.push({
          name: "cta_copy",
          display_text: "🔗 Salin URL Gambar",
          copy_code: bannerImage
        }, {
          name: "quick_reply",
          display_text: "🔄 Lagi (Tipe Sama)",
          id: `${prefix}waifu --v6 --mode ${data.mode || "sfw"} --type ${data.type || "waifu"}`
        });
      } else if (version === "v7") {
        const char = data.result || {};
        bannerImage = char.image_url;
        const animeName = char.anime?.name || "-";
        const mangaName = char.manga?.name || "-";
        const role = char.anime?.role || char.manga?.role || "Main";
        bodyText = `🌸 *WAIFU CHARACTER INFO (V7)*\n\n` + `╭───『 *DETAIL KARAKTER* 』\n` + `│ 👤 *Nama:* ${char.title || "Unknown"}\n` + `│ 🆔 *MAL ID:* ${char.mal_id || "-"}\n` + `│ 🎭 *Role:* ${role}\n` + `│ 📺 *Anime:* ${animeName}\n` + `│ 📖 *Manga:* ${mangaName}\n` + `╰────────────────────────`;
        if (char.anime?.url) {
          buttons.push({
            name: "cta_url",
            display_text: "📺 Detail di MyAnimeList",
            url: char.anime.url
          });
        }
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Nama Karakter",
          copy_code: char.title || ""
        }, {
          name: "quick_reply",
          display_text: "🔄 Random Karakter Lain",
          id: `${prefix}waifu --v7`
        });
      } else {
        bannerImage = data.result || data.url || data.image || (typeof data === "string" ? data : null);
        bodyText = `🌸 *WAIFU RANDOM (${version.toUpperCase()})*\n\n` + `✨ *Versi:* \`${version.toUpperCase()}\``;
        buttons.push({
          name: "cta_copy",
          display_text: "🔗 Salin Link Gambar",
          copy_code: bannerImage || ""
        }, {
          name: "quick_reply",
          display_text: "🔄 Random Lagi",
          id: `${prefix}waifu --${version}`
        });
      }
      const footerText = `${botName} • Waifu Collection ✦ ${version.toUpperCase()}`;
      const options = {
        image: bannerImage,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1, 99],
            list_title: `${botName} • Waifu ${version.toUpperCase()}`,
            button_title: "Lihat Koleksi"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Anime Waifu Collection ✦`,
            url: bannerImage || "https://wudysoft.my.id",
            copy_code: bannerImage || "",
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function" && bannerImage) {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else if (bannerImage) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: bannerImage
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[WAIFU ERROR]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Waifu Error: ${errMsg}`);
    }
  }
};