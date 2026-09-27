import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
global.yourVoicSession = global.yourVoicSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v41",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10,
  CACHE_TTL: 1e3 * 60 * 60 * 24
};
let cachedVoices = {
  list: [],
  lastFetched: 0
};

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) val = val.slice(1, -1);
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
async function getVoiceList() {
  const now = Date.now();
  if (cachedVoices.list.length && now - cachedVoices.lastFetched < CONFIG.CACHE_TTL) return cachedVoices.list;
  const {
    data
  } = await axios.get(`${CONFIG.API_URL}?action=voice_list`, {
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  if (Array.isArray(data) && data.length) {
    cachedVoices = {
      list: data,
      lastFetched: now
    };
    return data;
  }
  return cachedVoices.list;
}
export default {
  name: "yourvoic",
  aliases: ["yourvoice", "tts41", "yvtts"],
  description: "Text-to-Speech YourVoic dengan Session Voice & Konversi Opus.",
  category: "AI",
  limit: true,
  example: "yourvoic --list\nyourvoic halo semua\nyourvoic --info\nyourvoic --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.yourVoicSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.yourVoicSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Suara YourVoic berhasil direset!*\nKetik \`${prefix}yourvoic --list\` untuk memilih karakter baru.`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) return ctx.reply(`⚠️ Anda belum memiliki sesi suara aktif.\nKetik \`${prefix}yourvoic --list\` untuk memilih.`);
        return ctx.reply(`🎙️ *STATUS SESI YOURVOIC*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Karakter:* ${userSession.gender === "female" ? "👩" : "👨"} ${userSession.voiceName}\n` + `• 🎭 *Karakteristik:* ${userSession.description}\n\n` + `💡 _Ketik \`${prefix}yourvoic <teks>\` untuk berbicara._`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const allVoices = await getVoiceList();
        const queryTarget = String(flags.setvoice).toLowerCase().trim();
        const found = allVoices.find(v => v.id?.toLowerCase() === queryTarget || v.name?.toLowerCase() === queryTarget);
        const newSession = {
          voiceId: found ? found.id : String(flags.setvoice),
          voiceName: found ? found.name : String(flags.setvoice),
          gender: found ? found.gender || "AI" : flags.gender || "AI",
          description: found ? found.description || "Natural" : "Natural"
        };
        global.yourVoicSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Karakter Suara Berhasil Disimpan!*\n\n` + `• 🏷️ *Karakter:* ${newSession.gender === "female" ? "👩" : "👨"} ${newSession.voiceName}\n` + `• 🎭 *Karakteristik:* ${newSession.description}\n\n` + `👉 *Ketik:* \`${prefix}yourvoic Halo semuanya!\``);
      }
      if (flags.list || flags.search || flags.query || rawText.startsWith("--list") || rawText.startsWith("--search") || flags.page) {
        await ctx.react("⏳");
        const allVoices = await getVoiceList();
        let filtered = allVoices;
        const q = String(flags.search || flags.query || !flags.page && cleanText || "").toLowerCase().trim();
        if (q && q !== "true") {
          filtered = filtered.filter(v => Object.values(v).some(val => String(val).toLowerCase().includes(q)));
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = filtered.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan karakter untuk: *${q}* (Halaman ${page})`);
        }
        const femaleRows = pageItems.filter(v => v.gender === "female").map(v => ({
          title: `👩 ${v.name}`.slice(0, 24),
          id: `${prefix}yourvoic --setvoice "${v.id}" --gender "female"`,
          description: `${v.description || "Natural"} • ${v.english_us_name || v.name}`.slice(0, 60)
        }));
        const maleRows = pageItems.filter(v => v.gender === "male").map(v => ({
          title: `👨 ${v.name}`.slice(0, 24),
          id: `${prefix}yourvoic --setvoice "${v.id}" --gender "male"`,
          description: `${v.description || "Natural"} • ${v.english_us_name || v.name}`.slice(0, 60)
        }));
        const sections = [];
        if (femaleRows.length) sections.push({
          title: `👩 SUARA WANITA (Hal ${page})`,
          rows: femaleRows
        });
        if (maleRows.length) sections.push({
          title: `👨 SUARA PRIA (Hal ${page})`,
          rows: maleRows
        });
        let baseCmd = `${prefix}yourvoic`;
        if (q && q !== "true") baseCmd += ` --search "${q}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH KARAKTER (${pageItems.length})`,
            sections: sections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${baseCmd} --page ${page - 1}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }
        const bodyText = `╭───『 *YOURVOIC AI TTS* 』\n` + `│ 🎙️ *Total Karakter:* ${filtered.length} Model Tersedia\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + (q && q !== "true" ? `│ 🔍 *Pencarian:* "${q}"\n` : "") + `╰────────────────────────\n\n` + `_Pilih karakter suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • YourVoic Engine`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Explorer`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += [...femaleRows, ...maleRows].map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || (userSession ? userSession.voiceId : null);
      if (!selectedVoice) {
        return ctx.reply(`⚠️ *Pilih karakter suara terlebih dahulu!*\n\n👉 \`${prefix}yourvoic --list\` atau \`${prefix}yourvoic --search Sophia\``);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *YOURVOIC AI TTS*\n\n` + `• *Karakter:* ${userSession?.gender === "female" ? "👩" : "👨"} ${userSession?.voiceName || selectedVoice}\n\n` + `👉 *Ketik:* \`${prefix}yourvoic Halo semuanya\``);
      }
      await ctx.react("⏳");
      await ctx.reply(`🎙️ *YOURVOIC AI TTS*\n\n• *Model:* ${userSession?.gender === "female" ? "👩" : "👨"} ${userSession?.voiceName || selectedVoice}\n• *Teks:* _“${textToSpeak}”_\n\n⏳ _Sedang memproses audio..._`);
      const res = await axios.post(CONFIG.API_URL, {
        action: "generate",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        language: flags.language || flags.lang || "en-US"
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = res.data?.result || res.data?.audio_url;
      if (!res.data?.success || !audioUrl) throw new Error(res.data?.message || "Gagal membuat audio YourVoic.");
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[YourVoic Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ YourVoic Error: ${errMsg}`);
    }
  }
};