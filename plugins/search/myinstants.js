import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/sound/myinstants";
const formatNumber = num => typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["play", "detail", "get", "id", "d", "p", "slug", "url"].includes(lowerKey)) key = "id";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["trending", "t"].includes(lowerKey)) key = "trending";
    if (["recent", "new", "n", "latest"].includes(lowerKey)) key = "recent";
    if (["categories", "cats", "listcat"].includes(lowerKey)) key = "categories";
    if (["category", "cat", "c"].includes(lowerKey)) key = "category";
    if (["country", "code"].includes(lowerKey)) key = "country";
    if (["page", "pg"].includes(lowerKey)) key = "page";
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
  name: "myinstants",
  aliases: ["instants", "myinstant", "mi"],
  description: "Cari dan putar sound meme/efek suara instan dari MyInstants",
  category: "Fun",
  limit: true,
  example: "myinstants bruh atau myinstants --trending atau myinstants --id tuturu_1",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["myinstants", "instants", "myinstant", "mi"].some(alias => firstWord.endsWith(alias))) {
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
      const soundId = flags.id || null;
      if (soundId) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.get(API_URL, {
          params: {
            action: "detail",
            url: soundId
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            Accept: "application/json"
          },
          timeout: 3e4
        });
        const sound = res?.result || res?.data || res;
        const soundAudio = sound.sound_url;
        if (!sound || !soundAudio) {
          await ctx.react("❌");
          return ctx.reply("❌ Efek suara MyInstants tidak ditemukan atau audio tidak tersedia.");
        }
        const title = sound.title || "Sound Effect";
        const category = sound.category || "General";
        const views = formatNumber(sound.views);
        const likes = formatNumber(sound.likes);
        const tags = Array.isArray(sound.tags) && sound.tags.length ? sound.tags.slice(0, 5).join(", ") : "-";
        const uploader = sound.uploader?.name || "Anonymous";
        const desc = sound.description || "Tidak ada deskripsi.";
        const caption = `🔊 *MYINSTANTS DETAIL*\n\n` + `• *Judul:* ${title}\n` + `• *Kategori:* ${category}\n` + `• *Uploader:* ${uploader}\n` + `• *Dilihat:* ${views} kali\n` + `• *Disukai:* ${likes} orang\n` + `• *Tags:* ${tags}\n` + `• *Slug/ID:* \`${sound.slug || sound.id}\`\n\n` + `📝 *Deskripsi:*\n_${desc}_\n\n` + `_Memutar audio..._`;
        await sock.sendMessage(ctx.id, {
          text: caption
        }, {
          quoted: quotedMsg
        });
        await sock.sendMessage(ctx.id, {
          audio: {
            url: soundAudio
          },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          ptt: false
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (flags.categories) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.get(API_URL, {
          params: {
            action: "categories"
          },
          timeout: 3e4
        });
        const catList = res?.categories || res?.result?.categories || [];
        if (!catList.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar kategori MyInstants.");
        }
        const catRows = catList.map(c => ({
          title: c.name.slice(0, 24),
          description: `Kategori ${c.name} (${c.slug})`,
          id: `${prefix}myinstants --category ${c.slug}`
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📂 Pilih Kategori",
            sections: [{
              title: "KATEGORI MYINSTANTS",
              rows: catRows
            }]
          })
        }];
        await ctx.sendCta(`📂 *DAFTAR KATEGORI MYINSTANTS*\n\nTersedia *${catList.length}* kategori efek suara. Pilih kategori di bawah:`, `${botName} • MyInstants Categories`, buttons, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (!rawText && !flags.trending && !flags.recent && !flags.category) {
        return ctx.reply(`🔊 *MYINSTANTS MEME & SFX PLAYER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari suara: \`${prefix}myinstants bruh\`\n` + `  👉 Putar suara: \`${prefix}myinstants --id <slug_suara>\`\n\n` + `• *Kategori & Filter Cepat:*\n` + `  👉 \`${prefix}myinstants --trending\` (Trending Indonesia)\n` + `  👉 \`${prefix}myinstants --recent\` (Suara rilis terbaru)\n` + `  👉 \`${prefix}myinstants --categories\` (Daftar semua kategori)\n` + `  👉 \`${prefix}myinstants --category games\` (Filter kategori)\n\n` + `• *Opsi Flags:*\n` + `  • \`--page <nomor>\` (Navigasi halaman, default: \`1\`)\n` + `  • \`--country <kode>\` (Trending negara, default: \`id\`)`);
      }
      await ctx.react("⏳");
      let actionType = "trending";
      let queryParam = {};
      const page = Number(flags.page) || 1;
      const country = (flags.country || "id").toLowerCase();
      if (flags.recent) {
        actionType = "recent";
      } else if (flags.category) {
        actionType = "category";
        queryParam.category = flags.category;
      } else if (flags.search || cleanPrompt) {
        actionType = "search";
        queryParam.query = flags.search || cleanPrompt;
      } else {
        actionType = "trending";
        queryParam.country = country;
      }
      const {
        data: res
      } = await axios.get(API_URL, {
        params: {
          action: actionType,
          page: page,
          ...queryParam
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Accept: "application/json"
        },
        timeout: 3e4
      });
      const soundList = res?.sounds || res?.result?.sounds || [];
      if (!soundList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan suara MyInstants untuk: *"${queryParam.query || queryParam.category || actionType}"*`);
      }
      const totalResults = res?.total_results || res?.result?.total_results || soundList.length;
      const soundRows = soundList.slice(0, 15).map(s => {
        const title = s.title || `Sound #${s.id || s.slug}`;
        return {
          title: title.slice(0, 24),
          description: `Slug: ${s.slug || "-"} • Putar Sound`,
          id: `${prefix}myinstants --id ${s.slug || s.id}`
        };
      });
      const navRows = [{
        title: "🔥 Trending ID",
        description: "Sound paling hits di Indonesia",
        id: `${prefix}myinstants --trending --country id`
      }, {
        title: "🆕 Baru Ditambahkan",
        description: "Sound effect MyInstants rilis terbaru",
        id: `${prefix}myinstants --recent`
      }, {
        title: "📂 Daftar Kategori",
        description: "Jelajahi seluruh kategori MyInstants",
        id: `${prefix}myinstants --categories`
      }];
      const sections = [{
        title: `🔊 DAFTAR SUARA (Hal ${page})`,
        rows: soundRows
      }, {
        title: "📂 MENU KATEGORI",
        rows: navRows
      }];
      const filterTitle = queryParam.query ? `Cari: "${queryParam.query}"` : queryParam.category ? `Kategori: "${queryParam.category}"` : `Trending (${country.toUpperCase()})`;
      const bodyText = `🔊 *MYINSTANTS EXPLORER*\n\n` + `• *Filter:* ${filterTitle}\n` + `• *Hasil Halaman Ini:* ${totalResults} Suara\n` + `• *Halaman:* ${page}\n\n` + `_Pilih tombol di bawah untuk mendengarkan suara secara instan!_`;
      const footerText = `${botName} • MyInstants Buttons`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔊 Pilih & Putar (${soundRows.length})`,
          sections: sections
        })
      }];
      let baseCmd = `${prefix}myinstants`;
      if (actionType === "search") baseCmd += ` --search "${queryParam.query}"`;
      else if (actionType === "category") baseCmd += ` --category ${queryParam.category}`;
      else if (actionType === "recent") baseCmd += ` --recent`;
      else baseCmd += ` --trending --country ${country}`;
      if (page > 1) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `⬅️ Hal ${page - 1}`,
            id: `${baseCmd} --page ${page - 1}`
          })
        });
      }
      if (soundList.length >= 10) {
        buttons.push({
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: `➡️ Hal ${page + 1}`,
            id: `${baseCmd} --page ${page + 1}`
          })
        });
      }
      const options = {
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔊 *DAFTAR MYINSTANTS*\n\n`;
        fallback += soundRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`❌ MyInstants Error: ${errMsg}`);
    }
  }
};