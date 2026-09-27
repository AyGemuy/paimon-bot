import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
import {
  upload
} from "../../lib/upload.js";
global.voicechangerSession = global.voicechangerSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/voice-changer/v2",
  TIMEOUT: 12e4,
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
async function requestVoiceChanger(payload) {
  const res = await axios.post(CONFIG.API_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  const data = res.data;
  if (!data || data.status === "error" || data.status === false) {
    throw new Error(data?.error || data?.result?.error_message || "Response status false dari server.");
  }
  return data;
}
export default {
  name: "voicechanger",
  aliases: ["vc", "rvc", "changevoice", "voicetone"],
  description: "AI Voice Changer (RVC) dengan Session Management & CTA Search.",
  category: "AI",
  limit: true,
  example: "voicechanger --search trump\nreply audio lalu ketik: voicechanger\nvoicechanger --info\nvoicechanger --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.voicechangerSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.voicechangerSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Model Suara berhasil direset!*\n` + `Silakan pilih kembali model suara dengan mengetik: \`${prefix}vc --search <nama_karakter>\` atau \`${prefix}vc --list\``);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession?.voice) {
          return ctx.reply(`🎙️ *STATUS SESI VOICE CHANGER*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Voice Saat Ini:* _Belum disetel_\n\n` + `💡 _Pilih model suara terlebih dahulu: \`${prefix}vc --search <nama>\`_`, {
            mentions: [senderId]
          });
        }
        return ctx.reply(`🎙️ *STATUS SESI VOICE CHANGER*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Model Voice:* \`${userSession.name || userSession.voice}\`\n` + `• 🆔 *Tone ID:* \`${userSession.voice}\`\n\n` + `💡 _Ganti model suara: \`${prefix}vc --search <kata_kunci>\`_`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice);
        const voiceName = flags.name || `Tone ${voiceId}`;
        const newSession = {
          voice: voiceId,
          name: voiceName
        };
        global.voicechangerSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Model Suara Voice Changer Berhasil Disimpan!*\n\n` + `• 🏷️ *Model:* \`${newSession.name}\`\n` + `• 🆔 *Tone ID:* \`${newSession.voice}\`\n\n` + `👉 *Kirim/Balas Audio/VN dengan ketik:* \`${prefix}vc\``);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const page = Math.max(1, Number(flags.page) || 1);
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "";
        await ctx.react("⏳");
        const data = await requestVoiceChanger({
          action: "list",
          page: page
        });
        let allVoices = Array.isArray(data?.result?.voices) ? data.result.voices : [];
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ada data suara pada halaman ${page}.`);
        }
        if (searchQuery) {
          const filterKeyword = String(searchQuery).toLowerCase();
          allVoices = allVoices.filter(v => v.tone_name && v.tone_name.toLowerCase().includes(filterKeyword) || v.tone_id && String(v.tone_id).includes(filterKeyword));
        }
        if (!allVoices.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara dengan kata kunci: *${searchQuery}*\n\nContoh: \`${prefix}vc --search trump\` atau \`${prefix}vc --list --page 2\``);
        }
        const totalPages = page + (allVoices.length >= CONFIG.ITEMS_PER_PAGE ? 1 : 0);
        const pageItems = allVoices.slice(0, CONFIG.ITEMS_PER_PAGE);
        const voiceRows = pageItems.map((item, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const toneName = item.tone_name || `Tone ${item.tone_id}`;
          return {
            title: `${globalIdx}. ${toneName}`.slice(0, 24),
            id: `${prefix}vc --setvoice "${item.tone_id}" --name "${toneName}"`,
            description: `ID: ${item.tone_id} | Author: ${item.author_name || "Community"}`.slice(0, 60)
          };
        });
        const baseCmd = searchQuery ? `${prefix}vc --search "${searchQuery}"` : `${prefix}vc --list`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `DAFTAR MODEL SUARA (Hal ${page})`,
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
        if (allVoices.length >= CONFIG.ITEMS_PER_PAGE) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${baseCmd} --page ${page + 1}`
            })
          });
        }
        const bodyText = `╭───『 *AI VOICE CHANGER LIBRARY* 』\n` + `│ 🔍 *Pencarian:* "${searchQuery || "Semua"}"\n` + `│ 🎙️ *Ditemukan:* ${allVoices.length} Model\n` + `│ 📑 *Halaman:* ${page}\n` + `╰────────────────────────\n\n` + `_Pilih model suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • Voice Changer`;
        const options = {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Voice Library`,
              button_title: `Buka Hal ${page}`
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let fallback = `${bodyText}\n\n`;
          fallback += voiceRows.map(r => `• *${r.title}*\n  Pilih: \`${r.id}\``).join("\n\n");
          if (page > 1 || allVoices.length >= CONFIG.ITEMS_PER_PAGE) {
            fallback += `\n\n_Pindah Halaman: Ketik \`${baseCmd} --page ${page + 1}\`_`;
          }
          await ctx.reply(fallback);
        }
        await ctx.react("✅");
        return;
      }
      const selectedVoice = flags.voice || flags.tone_id || flags.voice_id || userSession?.voice;
      if (!selectedVoice) {
        return ctx.reply(`🎙️ *AI VOICE CHANGER*\n\n` + `⚠️ *Model suara belum dipilih!*\n\n` + `*Cara Penggunaan:*\n` + `1. Cari model: \`${prefix}vc --search <nama>\` atau \`${prefix}vc --list\`\n` + `2. Atau sertakan langsung ID suara saat reply audio: \`${prefix}vc --voice <tone_id>\`\n\n` + `*Contoh:* \`${prefix}vc --search minions\``);
      }
      const mime = (ctx.mimetype || ctx.quoted?.mimetype || "").toLowerCase();
      const mediaType = (ctx.mediaType || ctx.quoted?.mediaType || "").toLowerCase();
      const isAudio = /audio|ogg|mp3|opus|m4a|video/i.test(mime) || /audio|video|voice/i.test(mediaType);
      if (!isAudio) {
        return ctx.reply(`🎙️ *AI VOICE CHANGER*\n\n` + `• *Voice ID Terpilih:* \`${selectedVoice}\`\n\n` + `⚠️ *Silakan balas (reply) atau kirim file Audio / Voice Note yang ingin diubah suaranya!*`);
      }
      await ctx.react("⏳");
      const downloadFn = ctx.quoted?.download || ctx.download;
      const buffer = typeof downloadFn === "function" ? await downloadFn.call(ctx.quoted || ctx) : null;
      if (!buffer || !Buffer.isBuffer(buffer)) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh berkas audio dari pesan.");
      }
      const uploadRes = await upload(buffer);
      if (!uploadRes?.status || !uploadRes?.url) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal mengunggah media audio: ${uploadRes?.message || "Upload error"}`);
      }
      const audioUrl = uploadRes.url;
      const payload = {
        action: "generate",
        voice: String(selectedVoice),
        audio: audioUrl,
        filename: `audio_${Date.now()}.mp3`,
        file_type: "audio/mpeg",
        ...flags
      };
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const data = await requestVoiceChanger(payload);
      const outputAudioUrl = data?.result?.output_url;
      if (!outputAudioUrl) {
        throw new Error(data?.result?.error_message || data?.error || "Gagal mendapatkan output URL audio.");
      }
      const current = global.voicechangerSession.get(senderId) || {};
      global.voicechangerSession.set(senderId, {
        ...current,
        voice: selectedVoice
      });
      await sendPTT(sock, targetJid, outputAudioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Voice Changer Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.error || error.response?.data?.result?.error_message || error.message || "Terjadi kesalahan internal saat memproses suara.";
      ctx.reply(`❌ *Voice Changer Error:* ${errMsg}`);
    }
  }
};