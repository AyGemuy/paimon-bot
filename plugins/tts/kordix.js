import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  sendPTT
} from "../../lib/audio.js";
global.kordixSession = global.kordixSession || new Map();
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/misc/tts/v46",
  TIMEOUT: 6e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  ITEMS_PER_PAGE: 10
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
export default {
  name: "kordix",
  aliases: ["kordixtts", "kordixvoice", "kordixai", "ksearch"],
  description: "Text-to-Speech AI Kordix v46 dengan Session Voice, CTA Search & PTT Opus.",
  category: "AI",
  limit: true,
  example: "kordix --search anime\nkordix halo kawan\nkordix --info\nkordix --reset",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = (ctx.query || "").trim();
      if (!rawText && ctx.quoted?.text) rawText = ctx.quoted.text.trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const senderId = ctx.sender || ctx.author || msg.key?.participant || msg.key?.remoteJid || ctx.id;
      const userSession = global.kordixSession.get(senderId) || null;
      const {
        flags,
        cleanText
      } = parseFlags(rawText);
      if (flags.reset || rawText === "--reset") {
        global.kordixSession.delete(senderId);
        return ctx.reply(`✅ *Sesi Suara Kordix berhasil direset!*\nKetik \`${prefix}kordix --search <nama>\` untuk mencari karakter baru.`);
      }
      if (flags.info || flags.status || rawText === "--info") {
        if (!userSession) return ctx.reply(`⚠️ Anda belum memiliki karakter suara yang disetel.\nCari dengan \`${prefix}kordix --search <nama>\`.`);
        return ctx.reply(`🎙️ *STATUS SESI KORDIX*\n\n` + `• 👤 *User:* @${senderId.split("@")[0]}\n` + `• 🏷️ *Karakter:* ${userSession.name}\n` + `• 🆔 *ID Suara:* \`${userSession.id}\`\n` + `• 🌐 *Bahasa:* ${userSession.language || "-"}\n\n` + `💡 _Ketik \`${prefix}kordix <teks>\` untuk berbicara._`, {
          mentions: [senderId]
        });
      }
      if (flags.setvoice) {
        const voiceName = String(flags.setvoice);
        const voiceId = flags.id ? String(flags.id) : voiceName;
        const newSession = {
          id: voiceId,
          name: voiceName,
          language: flags.lang || "en",
          gender: flags.gender || "AI"
        };
        global.kordixSession.set(senderId, newSession);
        await ctx.react("✅");
        return ctx.reply(`✅ *Karakter Suara Berhasil Disimpan!*\n\n` + `• 🏷️ *Karakter:* ${newSession.name}\n` + `• 🆔 *ID:* \`${newSession.id}\`\n\n` + `👉 *Ketik:* \`${prefix}kordix Halo apa kabar semuanya?\``);
      }
      if (flags.search || flags.query || flags.list || rawText.startsWith("--search") || rawText.startsWith("--list") || flags.page) {
        const searchQuery = flags.search || flags.query || !flags.page && cleanText;
        if (!searchQuery || searchQuery === true) {
          return ctx.reply(`❌ Masukkan kata kunci pencarian!\nContoh: \`${prefix}kordix --search anime\``);
        }
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(CONFIG.API_URL, {
          action: "search",
          query: String(searchQuery)
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": CONFIG.USER_AGENT
          },
          timeout: CONFIG.TIMEOUT
        });
        const voiceItems = data?.result?.items || [];
        if (!voiceItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan model suara untuk kata kunci: *${searchQuery}*`);
        }
        const page = Math.max(1, Number(flags.page) || 1);
        const totalPages = Math.ceil(voiceItems.length / CONFIG.ITEMS_PER_PAGE) || 1;
        const pageItems = voiceItems.slice((page - 1) * CONFIG.ITEMS_PER_PAGE, page * CONFIG.ITEMS_PER_PAGE);
        if (!pageItems.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Halaman ${page} tidak memiliki data suara.`);
        }
        const topVoice = pageItems[0];
        const previewThumb = topVoice.image || "https://public-platform.r2.fish.audio/cdn-cgi/image/width=256,format=webp/coverimage/a4af569aa1c84e18a28a19cbbaca7be7";
        const voiceRows = pageItems.map((v, i) => {
          const globalIdx = (page - 1) * CONFIG.ITEMS_PER_PAGE + i + 1;
          return {
            title: `${globalIdx}. ${v.name}`.slice(0, 24),
            id: `${prefix}kordix --setvoice "${v.name}" --id "${v.id}" --lang "${v.language || "en"}" --gender "${v.gender || "AI"}"`,
            description: `Bahasa: ${v.language || "-"} | Gender: ${v.gender || "-"}`.slice(0, 60)
          };
        });
        const baseCmd = `${prefix}kordix --search "${searchQuery}"`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎧 PILIH MODEL SUARA (${pageItems.length})`,
            sections: [{
              title: `HASIL PENCARIAN (Hal ${page}/${totalPages})`,
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
        const bodyText = `╭───『 *KORDIX VOICE SEARCH* 』\n` + `│ 🔍 *Pencarian:* "${searchQuery}"\n` + `│ 🎙️ *Total Hasil:* ${voiceItems.length} Karakter\n` + `│ 📑 *Halaman:* ${page} dari ${totalPages}\n` + `├──────────────────\n` + `│ 👤 *Sorotan:* ${topVoice.name}\n` + `│ 🌐 *Bahasa:* ${topVoice.language || "-"}\n` + `│ 🆔 *ID:* \`${topVoice.id}\`\n` + `╰──────────────────\n\n` + `_Pilih karakter suara dari dropdown di bawah atau gunakan tombol navigasi halaman:_`;
        const footerText = `${botName} • Kordix Search`;
        const options = {
          title: "乂 KORDIX VOICE SEARCH 乂",
          subtitle: `Query: ${searchQuery}`,
          media: previewThumb,
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
      const selectedVoice = flags.voice || flags.name || (userSession ? userSession.name : null);
      if (!selectedVoice) {
        return ctx.reply(`⚠️ *Pilih karakter suara terlebih dahulu!*\n\n` + `👉 \`${prefix}kordix --search <nama>\`\n` + `Contoh: \`${prefix}kordix --search anime\``);
      }
      const textToSpeak = cleanText || flags.text;
      if (!textToSpeak) {
        return ctx.reply(`🎙️ *KORDIX AI TTS*\n\n` + `• *Karakter:* ${selectedVoice}\n\n` + `👉 *Ketik:* \`${prefix}kordix Halo apa kabar?\``);
      }
      await ctx.react("⏳");
      await ctx.reply(`🎙️ *KORDIX AI TEXT-TO-SPEECH*\n\n• *Karakter:* 🏷️ ${selectedVoice}\n• *Teks:* _“${textToSpeak}”_\n\n⏳ _Sedang memproses audio..._`);
      const payload = {
        action: "generate",
        text: String(textToSpeak),
        name: String(selectedVoice),
        ...flags
      };
      delete payload.voice;
      delete payload.search;
      delete payload.query;
      delete payload.list;
      delete payload.setvoice;
      const {
        data
      } = await axios.post(CONFIG.API_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": CONFIG.USER_AGENT
        },
        timeout: CONFIG.TIMEOUT
      });
      const audioUrl = data?.result?.audio_url || data?.result?.audioUrl;
      if (!audioUrl || !audioUrl.startsWith("http")) {
        throw new Error(data?.message || data?.result || "Gagal membuat audio Kordix.");
      }
      await sendPTT(sock, targetJid, audioUrl, quotedMsg);
      await ctx.react("🎙️");
    } catch (error) {
      console.error("[Kordix Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      ctx.reply(`❌ Kordix Error: ${errMsg}`);
    }
  }
};