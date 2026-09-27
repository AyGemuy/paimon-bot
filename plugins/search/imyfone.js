import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/misc/voice/imyfone";
const DEFAULT_VOICE_ID = "0001";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["id", "voiceid", "i"].includes(lowerKey)) key = "id";
    if (["text", "body", "t"].includes(lowerKey)) key = "text";
    if (["search", "find", "s"].includes(lowerKey)) key = "search";
    if (["accent", "a"].includes(lowerKey)) key = "accent";
    if (["emotion", "e"].includes(lowerKey)) key = "emotion";
    if (["speed"].includes(lowerKey)) key = "speed";
    if (["volume"].includes(lowerKey)) key = "volume";
    if (["pitch"].includes(lowerKey)) key = "pitch";
    if (["page", "p"].includes(lowerKey)) key = "page";
    if (["limit", "l"].includes(lowerKey)) key = "limit";
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

function ensureArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.list)) return data.list;
    if (Array.isArray(data.voices)) return data.voices;
    if (Array.isArray(data.voice_list)) return data.voice_list;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.data)) return ensureArray(data.data);
  }
  return [];
}
async function searchTTS(searchText, pageNum = 1, pageSize = 10) {
  try {
    const {
      data
    } = await axios.post(API_URL, {
      action: "search_tts",
      searchText: String(searchText || ""),
      pageNum: Number(pageNum) || 1,
      pageSize: Number(pageSize) || 10,
      productId: 1
    }, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 3e4
    });
    return ensureArray(data?.data || data?.result || data);
  } catch (err) {
    return [];
  }
}
export default {
  name: "imyfone",
  aliases: ["voxbox", "topmediai", "ai-voice", "ttsvoice"],
  description: "Text-to-Speech AI iMyFone VoxBox (Direct Gen, CLI Flags & Interactive Search)",
  category: "AI",
  limit: true,
  example: "imyfone --text 'Halo selamat pagi' atau imyfone --search naruto",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["imyfone", "voxbox", "topmediai", "ai-voice", "ttsvoice"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const quotedText = ctx.quoted?.text || ctx.quoted?.body || "";
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const searchKeyword = flags.search || null;
      const page = Number(flags.page) || 1;
      const limit = Number(flags.limit) || 10;
      if (searchKeyword) {
        await ctx.react("⏳");
        const voiceList = await searchTTS(searchKeyword, page, limit);
        if (!Array.isArray(voiceList) || voiceList.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci: *"${searchKeyword}"*`);
        }
        const topVoice = voiceList[0];
        const sampleText = quotedText || "Halo! Ini adalah contoh suara dari iMyFone AI.";
        const voiceRows = voiceList.map(v => ({
          title: `🎙️ ${v.voice_name || "Unknown Voice"}`.slice(0, 24),
          description: `ID: ${v.voice_id || "-"} • ${v.voice_type || "General"}`,
          id: `${prefix}imyfone --id ${v.voice_id} --text "${sampleText}"`
        }));
        const sections = [{
          title: `🎙️ HASIL MODEL SUARA (Hal ${page})`,
          rows: voiceRows
        }];
        const buttons = [{
          name: "single_select",
          title: `🎧 Pilih Model Suara (${voiceList.length})`,
          sections: sections
        }, {
          name: "cta_copy",
          display_text: "📌 Salin Voice ID Teratas",
          copy_code: String(topVoice.voice_id || "")
        }];
        const apiAccents = (Array.isArray(topVoice.accent) ? topVoice.accent : []).join(", ") || "-";
        const bodyText = `🎙️ *IMYFONE AI VOICE SEARCH*\n\n` + `• *Nama Model:* ${topVoice.voice_name || "-"}\n` + `• *Karakter:* ${topVoice.voice_type || "-"}\n` + `• *Usia:* ${topVoice.voice_age || "-"}\n` + `• *Voice ID:* \`${topVoice.voice_id || "-"}\`\n\n` + `🌐 *Aksen yang Didukung:*\n_${apiAccents}_\n\n` + `_Klik tombol di bawah untuk memilih model secara langsung!_`;
        const footerText = `${botName} • iMyFone VoxBox AI`;
        const bannerMedia = topVoice.avatar_url || topVoice.avatar_url_webp || global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Select Voice`,
              button_title: "Lihat Model Suara"
            },
            limited_time_offer: {
              text: `✦ ${botName} - iMyFone AI ✦`,
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
          let fallbackMsg = `🎙️ *DAFTAR MODEL SUARA IMYFONE AI*\n\n`;
          fallbackMsg += voiceList.map(v => `• *${v.voice_name || "Voice"}* (${v.voice_type || "-"})\n  ID: \`${v.voice_id}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      if (!rawText && !quotedText) {
        return ctx.reply(`🎙️ *IMYFONE VOXBOX AI (TEXT-TO-SPEECH)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 \`${prefix}imyfone Halo selamat pagi!\`\n` + `  👉 Reply teks pesan dengan caption: \`${prefix}imyfone\`\n\n` + `• *Cari Model Suara (CTA UI):*\n` + `  👉 \`${prefix}imyfone --search naruto\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--id <voice_id>\` (Contoh: \`--id 0001\` / \`--id ${DEFAULT_VOICE_ID}\`)\n` + `  • \`--text <teks>\` (Teks yang ingin diubah ke suara)\n` + `  • \`--accent <nama_aksen>\` (Contoh: \`--accent "English(US)"\`)\n` + `  • \`--speed <number>\` (Kecepatan, default: \`1\`)\n` + `  • \`--pitch <number>\` (Pitch suara, default: \`3\`)\n` + `  • \`--volume <number>\` (Volume, default: \`50\`)`);
      }
      const textToSpeech = flags.text || cleanPrompt || quotedText;
      if (!textToSpeech) {
        return ctx.reply(`❌ Masukkan teks yang ingin diubah menjadi suara!\nContoh: \`${prefix}imyfone --text "Halo selamat datang!"\``);
      }
      await ctx.react("⏳");
      const activeVoiceId = String(flags.id || DEFAULT_VOICE_ID);
      let voiceMeta = {};
      const voiceMetaList = await searchTTS(activeVoiceId, 1, 5);
      if (Array.isArray(voiceMetaList) && voiceMetaList.length > 0) {
        voiceMeta = voiceMetaList.find(v => String(v?.voice_id) === activeVoiceId) || voiceMetaList[0] || {};
      }
      const dynamicAccents = Array.isArray(voiceMeta?.accent) ? voiceMeta.accent : [];
      const speedVal = typeof flags.speed === "number" ? flags.speed : parseFloat(flags.speed) || 1;
      const pitchVal = typeof flags.pitch === "number" ? flags.pitch : parseInt(flags.pitch, 10) || 3;
      const volumeVal = typeof flags.volume === "number" ? flags.volume : parseInt(flags.volume, 10) || 50;
      const payloadTTS = {
        action: "create_tts",
        voiceId: activeVoiceId,
        text: String(textToSpeech),
        accent: String(flags.accent || dynamicAccents[0] || "English(US)"),
        emotionName: String(flags.emotion || "Default"),
        speed: speedVal,
        volume: volumeVal,
        pitch: pitchVal,
        articleTitle: "Unnamed",
        backgroundUrl: "",
        isAudition: 1,
        countryCode: "US"
      };
      const {
        data
      } = await axios.post(API_URL, payloadTTS, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resultAudio = data?.data?.decrypted_oss_url || data?.data?.oss_url;
      if (!resultAudio || !String(resultAudio).startsWith("http")) {
        throw new Error(data?.message || "Gagal membuat audio TTS. Periksa kembali teks atau Voice ID.");
      }
      await sock.sendMessage(ctx.id, {
        audio: {
          url: resultAudio
        },
        mimetype: "audio/mp4",
        ptt: true
      }, {
        quoted: quotedMsg
      });
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
      ctx.reply(`❌ iMyFone Error: ${errorMessage}`);
    }
  }
};