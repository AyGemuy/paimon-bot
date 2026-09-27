import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
global.playVoiceSession = global.playVoiceSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v37",
  TIMEOUT: 9e4,
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
  const rawList = data?.voices || (Array.isArray(data) ? data : []);
  if (Array.isArray(rawList) && rawList.length) {
    cachedVoices = {
      list: rawList,
      lastFetched: now
    };
    return rawList;
  }
  return cachedVoices.list;
}
export default {
  name: "playvoice",
  aliases: ["tts37", "playai", "zeroshot", "voiceclone"],
  description: "Play Voice AI Zero-Shot Cloning dengan Session Voice & Konversi Opus.",
  category: "AI",
  limit: true,
  example: "playvoice --search american\nplayvoice halo kawan\nplayvoice --info\nplayvoice --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.playVoiceSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.playVoiceSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Suara Play Voice telah direset!*\nKetik \`${prefix}playvoice --list\` untuk memilih suara baru.`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) return ctx.reply(`⚠️ Anda belum memiliki sesi suara aktif.\nKetik \`${prefix}playvoice --list\` untuk memilih.`);
        return ctx.reply(`🎙️ *STATUS SESI PLAY VOICE*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Karakter:* ${userSession.voiceName}\n` + `• 🆔 *Voice ID:* \`${userSession.voiceId}\`\n` + `• 🌍 *Aksen:* ${userSession.accent} (${userSession.gender})\n\n` + `💡 _Ketik \`${prefix}playvoice <teks>\` untuk berbicara._`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const allVoices = await getVoiceList();
        const queryTarget = String(flags.setvoice).toLowerCase().trim();
        const found = allVoices.find(v => (v.voice_id || v.id)?.toLowerCase() === queryTarget || v.name?.toLowerCase().includes(queryTarget));
        const newSession = {
          voiceId: found ? found.voice_id || found.id : String(flags.setvoice),
          voiceName: found ? found.name : flags.name || `Model #${flags.setvoice}`,
          accent: found ? found.accent || "Standard" : flags.accent || "Standard",
          gender: found ? found.gender || "AI" : flags.gender || "AI"
        };
        global.playVoiceSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Karakter Suara Berhasil Disimpan!*\n\n` + `• 🏷️ *Nama:* ${newSession.voiceName}\n` + `• 🌍 *Aksen:* ${newSession.accent} (${newSession.gender})\n\n` + `👉 *Ketik:* \`${prefix}playvoice Halo apa kabar?\``);
      }
      if (flags.search || flags.list || flags.query || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        await ctx.react("⏳");
        const allVoices = await getVoiceList();
        let filtered = allVoices;
        const q = String(flags.search || flags.query || !flags.page && cleanText || "").toLowerCase().trim();
        if (q && q !== "true") {
          filtered = filtered.filter(v => v.name?.toLowerCase().includes(q) || v.accent?.toLowerCase().includes(q));
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = filtered.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan suara untuk: *${q}* (Halaman ${page})`);
        }
        const voiceRows = pageItems.map(v => ({
          title: `${v.gender === "female" ? "👩" : "👨"} ${v.name}`.slice(0, 24),
          id: `${prefix}playvoice --setvoice "${v.voice_id || v.id}" --name "${v.name}" --accent "${v.accent || "Standard"}" --gender "${v.gender || "AI"}"`,
          description: `${v.accent || "Standard"} • ${v.age || "All Age"}`.slice(0, 60)
        }));
        let baseCmd = `${prefix}playvoice`;
        if (q && q !== "true") baseCmd += ` --search "${q}"`;
        else baseCmd += ` --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH KARAKTER (${pageItems.length})`,
            sections: [{
              title: `DAFTAR SUARA (Hal ${page}/${totalPages})`,
              rows: voiceRows
            }]
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
        const bodyText = `╭───『 *PLAY VOICE AI TTS* 』\n` + `│ 🎙️ *Total Model:* ${filtered.length} Suara Tersedia\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + (q && q !== "true" ? `│ 🔍 *Pencarian:* "${q}"\n` : "") + `╰────────────────────────\n\n` + `_Pilih karakter suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • Play Voice Engine`;
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
          fallback += voiceRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
          if (totalPages > 1) fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page < totalPages ? page + 1 : page - 1}\`_`;
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || (userSession ? userSession.voiceId : null);
      if (!selectedVoice) {
        return ctx.reply(`⚠️ *Pilih karakter suara terlebih dahulu!*\n\n👉 Ketik \`${prefix}playvoice --list\` untuk memilih suara.`);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *PLAY VOICE AI TTS*\n\n` + `• *Karakter Aktif:* 🏷️ ${userSession?.voiceName || selectedVoice}\n\n` + `👉 *Ketik:* \`${prefix}playvoice Halo apa kabar?\``);
      }
      await ctx.react("⏳");
      const res = await axios.post(CONFIG.API_URL, {
        action: "generate",
        text: String(textToSpeak),
        voice_id: String(selectedVoice),
        speed: Number(flags.speed || 1)
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        responseType: "arraybuffer",
        timeout: CONFIG.TIMEOUT
      });
      await sendPTT(sock, targetJid, Buffer.from(res.data), quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[PlayVoice Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Play Voice Error: ${errMsg}`);
    }
  }
};