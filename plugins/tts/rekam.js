import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
global.rekamSession = global.rekamSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v49",
  DEFAULT_VOICE: "af_heart",
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
export default {
  name: "rekam",
  aliases: ["rekamtts", "kokoro", "kokorotts", "ttsv49", "rekamai"],
  description: "Text-to-Speech Kokoro AI (Rekam AI v49) dengan Session Voice, Speed Control & CTA Search.",
  category: "AI",
  limit: true,
  example: "rekam Halo selamat pagi\nrekam --search female\nrekam I love you --voice af_heart --speed 1.2\nrekam --info\nrekam --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.rekamSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.rekamSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Suara Rekam AI (Kokoro) berhasil direset!*\nDefault voice kembali ke: \`${CONFIG.DEFAULT_VOICE}\` (Heart ❤️).\nKetik \`${prefix}rekam --search <query>\` untuk mencari suara lain.`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        const currentVoice = userSession?.voice || CONFIG.DEFAULT_VOICE;
        const currentSpeed = userSession?.speed || 1;
        return ctx.reply(`🎙️ *STATUS SESI REKAM AI (KOKORO v49)*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Model Voice:* \`${currentVoice}\`\n` + `• ⚡ *Speed:* \`${currentSpeed}x\`\n\n` + `💡 _Ganti model suara: \`${prefix}rekam --search <nama/gender>\`_`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceId = String(flags.setvoice);
        const speed = flags.speed ? parseFloat(flags.speed) : userSession?.speed || 1;
        const newSession = {
          voice: voiceId,
          speed: isNaN(speed) ? 1 : speed
        };
        global.rekamSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Model Suara Kokoro AI Berhasil Disimpan!*\n\n` + `• 🏷️ *Voice ID:* \`${newSession.voice}\`\n` + `• ⚡ *Speed:* \`${newSession.speed}x\`\n\n` + `👉 *Ketik:* \`${prefix}rekam Halo semuanya apa kabar?\``);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText || "female";
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          action: "voice_list"
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const voicesObj = data?.voices || {};
        const voiceKeys = Object.keys(voicesObj);
        if (!voiceKeys.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat daftar suara dari server Rekam AI.");
        }
        const filterKeyword = String(searchQuery).toLowerCase();
        const matchedKeys = voiceKeys.filter(id => {
          const v = voicesObj[id];
          const name = v?.name?.toLowerCase() || "";
          const gender = v?.gender?.toLowerCase() || "";
          const lang = v?.language?.toLowerCase() || "";
          return id.toLowerCase().includes(filterKeyword) || name.includes(filterKeyword) || gender.includes(filterKeyword) || lang.includes(filterKeyword);
        });
        if (!matchedKeys.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara dengan kata kunci: *${searchQuery}*\n\nContoh pencarian: \`female\`, \`male\`, \`en-us\`, \`heart\`, \`alloy\`, \`bella\`, \`adam\``);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(matchedKeys.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = matchedKeys.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Halaman ${page} tidak memiliki data suara.`);
        }
        const voiceRows = pageItems.map((id, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          const v = voicesObj[id];
          const name = v?.name || id;
          const gender = v?.gender || "AI";
          const lang = v?.language || "en-us";
          const traits = v?.traits || "";
          return {
            title: `${globalIdx}. ${name} ${traits}`.trim().slice(0, 24),
            id: `${prefix}rekam --setvoice "${id}"`,
            description: `ID: ${id} | Gender: ${gender} | Lang: ${lang}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}rekam --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH SUARA KOKORO (${pageItems.length})`,
            sections: [{
              title: `HASIL: ${searchQuery.toUpperCase()} (Hal ${page}/${totalPages})`,
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
        const bodyText = `╭───『 *REKAM AI (KOKORO v49)* 』\n` + `│ 🔍 *Pencarian:* "${searchQuery}"\n` + `│ 🎙️ *Total Hasil:* ${matchedKeys.length} Karakter\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + `╰────────────────────────\n\n` + `_Pilih model suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • Rekam AI TTS`;
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
      const speed = flags.speed ? parseFloat(flags.speed) : userSession?.speed || 1;
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *REKAM AI (KOKORO TTS v49)*\n\n` + `• *Voice Saat Ini:* \`${selectedVoice}\`\n` + `• *Speed:* \`${speed}x\`\n\n` + `*Penggunaan:*\n` + `• \`${prefix}rekam <teks>\`\n` + `• \`${prefix}rekam <teks> --voice <voice_id> --speed 1.2\`\n` + `• \`${prefix}rekam --search <female/male/nama>\`\n\n` + `*Contoh:* \`${prefix}rekam Hello world, Kokoro AI is speaking!\``);
      }
      await ctx.react("⏳");
      const payload = {
        action: "create",
        text: String(textToSpeak),
        voice: String(selectedVoice),
        speed: isNaN(speed) ? 1 : speed
      };
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      if (!data?.status || !data?.result?.audio_url) {
        throw new Error(data?.result || data?.message || "Gagal mengenerate suara Rekam AI.");
      }
      const current = global.rekamSession.get(senderId) || {};
      global.rekamSession.set(senderId, {
        ...current,
        voice: selectedVoice,
        speed: payload.speed
      });
      const audioUrl = data.result.audio_url;
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Rekam AI TTS Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Terjadi kesalahan saat memproses audio Kokoro.";
      ctx.reply(`❌ *Rekam AI Error:* ${errMsg}`);
    }
  }
};