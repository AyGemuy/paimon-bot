import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
global.voxcloneSession = global.voxcloneSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v45",
  DEFAULT_VOICE: "id-ID-Standard-A",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  ITEMS_PER_PAGE: 10
};

function parseFlags(rawStr = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawStr)) !== null) {
    const key = match[1].toLowerCase();
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    flags[key] = val;
  }
  const cleanText = rawStr.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
async function requestVoxClone(payload, senderId) {
  const userSession = global.voxcloneSession.get(senderId);
  if (userSession?.state && !payload.state) {
    payload.state = userSession.state;
  }
  const makeRequest = async body => {
    return await axios.post(CONFIG.API_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CONFIG.USER_AGENT
      },
      timeout: CONFIG.TIMEOUT
    });
  };
  try {
    const res = await makeRequest(payload);
    const data = res.data;
    if (!data?.status) {
      throw new Error(data?.error || data?.message || "Response status false dari server.");
    }
    if (data.state) {
      const current = global.voxcloneSession.get(senderId) || {};
      global.voxcloneSession.set(senderId, {
        ...current,
        state: data.state
      });
    }
    return data;
  } catch (error) {
    if (payload.state) {
      console.warn(`[VoxClone] Sesi state kedaluwarsa untuk user ${senderId}. Memulai auto-refresh sesi baru...`);
      delete payload.state;
      if (userSession) {
        userSession.state = null;
        global.voxcloneSession.set(senderId, userSession);
      }
      const retryRes = await makeRequest(payload);
      const retryData = retryRes.data;
      if (!retryData?.status) {
        throw new Error(retryData?.error || retryData?.message || "Gagal saat auto-refresh sesi.");
      }
      if (retryData.state) {
        const current = global.voxcloneSession.get(senderId) || {};
        global.voxcloneSession.set(senderId, {
          ...current,
          state: retryData.state
        });
        console.log(`[VoxClone] Sesi state baru berhasil disimpan untuk user ${senderId}.`);
      }
      return retryData;
    }
    throw error;
  }
}
export default {
  name: "voxclone",
  aliases: ["vox", "voxtts", "ttsv45", "gcloudtts"],
  description: "Text-to-Speech AI VoxClone (Google Cloud TTS v45) dengan Auto Refresh Session & CTA Search.",
  category: "AI",
  limit: true,
  example: "voxclone --search id-ID\nvoxclone Halo selamat pagi\nvoxclone --info\nvoxclone --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.voxcloneSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.voxcloneSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Suara & Token berhasil direset!*\nDefault voice kembali ke: \`${CONFIG.DEFAULT_VOICE}\`.\nKetik \`${prefix}voxclone --search <kode/nama>\` untuk mencari model suara.`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        return ctx.reply(`🎙️ *STATUS SESI VOXCLONE (TTS v45)*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Voice Saat Ini:* \`${currentVoice}\`\n` + `• 🔑 *State Sesi:* ${userSession?.state ? "🟢 Aktif (Auto-Refresh)" : "⚪ Belum Digenerate"}\n\n` + `💡 _Ganti model suara: \`${prefix}voxclone --search <kata_kunci>\`_`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceName = String(flags.setvoice);
        const newSession = {
          voice: voiceName,
          state: userSession?.state || null
        };
        global.voxcloneSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Model Suara VoxClone Berhasil Disimpan!*\n\n` + `• 🏷️ *Model Voice:* \`${newSession.voice}\`\n\n` + `👉 *Ketik:* \`${prefix}voxclone Halo semuanya apa kabar?\``);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "id-ID";
        await ctx.react("⏳");
        const data = await requestVoxClone({
          action: "voice_list"
        }, senderId);
        const allVoices = Array.isArray(data?.result) ? data.result : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar suara dari server VoxClone.");
        }
        const filterKeyword = String(searchQuery).toLowerCase();
        const matchedVoices = allVoices.filter(v => typeof v === "string" && v.toLowerCase().includes(filterKeyword));
        if (!matchedVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan voice dengan kata kunci: *${searchQuery}*\n\nContoh kata kunci: \`id-ID\`, \`en-US\`, \`Standard\`, \`Wavenet\`, \`Journey\`, \`Studio\``);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedVoices.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedVoices.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Halaman ${page} tidak memiliki data suara.`);
        }
        const voiceRows = pageItems.map((voiceName, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const parts = voiceName.split("-");
          const locale = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "Global";
          const type = parts.slice(2).join("-") || "Standard";
          return {
            title: `${globalIdx}. ${voiceName}`.slice(0, 24),
            id: `${prefix}voxclone --setvoice "${voiceName}"`,
            description: `Locale: ${locale} | Type: ${type}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}voxclone --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `HASIL FILTER: ${searchQuery.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `╭───『 *VOXCLONE AI TTS (TTS v45)* 』\n` + `│ 🔍 *Pencarian:* "${searchQuery}"\n` + `│ 🎙️ *Total Hasil:* ${matchedVoices.length} Model\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + `╰────────────────────────\n\n` + `_Pilih model suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • VoxClone TTS`;
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
      const selectedVoice = flags.voice || flags.name || userSession?.voice || CONFIG.DEFAULT_VOICE;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *VOXCLONE AI TTS v45*\n\n` + `• *Voice Saat Ini:* \`${selectedVoice}\`\n\n` + `*Penggunaan:*\n` + `• \`${prefix}voxclone <teks>\`\n` + `• \`${prefix}voxclone <teks> --voice <nama_voice>\`\n` + `• \`${prefix}voxclone --search <kata_kunci>\`\n\n` + `*Contoh:* \`${prefix}voxclone Halo semuanya selamat datang!\``);
      }
      await ctx.react("⏳");
      const payload = {
        action: "generate",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        ...flags
      };
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const data = await requestVoxClone(payload, senderId);
      const audioUrl = data?.result?.audio_url;
      if (!audioUrl) {
        throw new Error(data?.error || data?.message || "Gagal mendapatkan URL audio.");
      }
      const current = global.voxcloneSession.get(senderId) || {};
      global.voxcloneSession.set(senderId, {
        ...current,
        voice: selectedVoice
      });
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[VoxClone TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`❌ *VoxClone Error:* ${errMsg}`);
    }
  }
};