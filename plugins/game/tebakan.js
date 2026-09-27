import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.tebakSession = global.tebakSession || new Map();
const GAME_TYPES = {
  gambar: {
    name: "Tebak Gambar",
    url: "https://wudysoft.my.id/api/game/tebak-gambar",
    emoji: "🖼️"
  },
  hewan: {
    name: "Tebak Hewan",
    url: "https://wudysoft.my.id/api/game/tebak-hewan",
    emoji: "🦁"
  },
  kabupaten: {
    name: "Tebak Kabupaten Indonesia",
    url: "https://wudysoft.my.id/api/game/tebak-kabupaten",
    emoji: "🏛️"
  },
  logo: {
    name: "Tebak Logo Aplikasi",
    url: "https://wudysoft.my.id/api/game/tebak-logo",
    emoji: "📱"
  },
  heroml: {
    name: "Tebak Hero Mobile Legends",
    url: "https://wudysoft.my.id/api/game/tebak-hero-ml",
    emoji: "⚔️"
  },
  genshin: {
    name: "Tebak Karakter Genshin Impact",
    url: "https://wudysoft.my.id/api/game/tebak-hero-genshin",
    emoji: "✨"
  }
};

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function fetchMediaBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Media Buffer Error]:", err.message);
  }
  return null;
}
export default {
  name: "tebak",
  aliases: ["tebak-game", "kuis", "game-tebak"],
  description: "Game kuis tebak gambar, hewan, kabupaten, logo aplikasi, hero MLBB, dan Genshin Impact",
  category: "Game",
  limit: true,
  example: "tebak --gambar atau tebak --hewan atau tebak --kabupaten",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.tebakSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.tebakSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAns = normalizeText(session.answer);
      const isCorrect = cleanUser === cleanAns || cleanUser.includes(cleanAns) || cleanAns.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        clearTimeout(session.timer);
        global.tebakSession.delete(chatId);
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender;
        if (senderJid && global.db?.user?.[senderJid]) {
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 250;
          if (typeof db?.write === "function") db.write(global.db);
        }
        const winMessage = `🎉 *SELAMAT JAWABAN KAMU BENAR!*\n\n` + `👤 *Penebak:* ${senderName}\n` + `🎮 *Game:* ${session.gameName}\n` + `🏆 *Jawaban:* *${session.answer}*\n` + (session.hintMessage ? `📝 *Deskripsi:* _${session.hintMessage}_\n` : "") + `⏱️ *Waktu Menjawab:* ${duration} detik\n` + `🎁 *Hadiah:* +250 EXP`;
        await sock.sendMessage(chatId, {
          text: winMessage
        }, {
          quoted: msg
        });
        if (typeof ctx?.react === "function") {
          await ctx.react("🎉");
        }
        return true;
      } else {
        if (typeof ctx?.react === "function") {
          await ctx.react("❌");
        }
        await sock.sendMessage(chatId, {
          text: `❌ *Jawaban Salah!*\n"${userText}" bukan jawaban yang tepat. Silakan coba tebak lagi!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TEBAK BEFORE HANDLER ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (global.tebakSession.has(chatId)) {
        const session = global.tebakSession.get(chatId);
        const targetQuoted = session.questionMsg || quotedMsg;
        if (rawText.includes("--clue") || rawText.includes("--hint") || rawText.includes("hint")) {
          const hintButtons = [{
            name: "quick_reply",
            display_text: "🏳️ Menyerah",
            id: `${prefix}tebak --nyerah`
          }];
          return await ctx.sendCta(`💡 *PETUNJUK JAWABAN:*\n\`${session.clue}\`\n\n_${session.hintMessage || "Tebak dengan benar sebelum waktu habis!"}_`, `${global.bot?.name || "WudysoftBot"} • Game Hint`, hintButtons, {
            title: "乂 PETUNJUK KUIS 乂",
            quoted: targetQuoted
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          clearTimeout(session.timer);
          global.tebakSession.delete(chatId);
          return await sock.sendMessage(chatId, {
            text: `🏳️ *Kamu Menyerah!*\n\nGame *${session.gameName}* telah dihentikan.\nJawaban yang benar adalah: *${session.answer}*` + (session.hintMessage ? `\n📝 _${session.hintMessage}_` : "")
          }, {
            quoted: targetQuoted
          });
        }
        const activeWarningBody = `⚠️ *Masih ada game ${session.gameName} yang aktif di chat ini!*

💡 *Petunjuk:* \`${session.clue}\`
👉 *Reply pesan soal* dengan jawabanmu, atau klik tombol di bawah:`;
        const activeButtons = [{
          name: "quick_reply",
          display_text: "💡 Minta Petunjuk",
          id: `${prefix}tebak --hint`
        }, {
          name: "quick_reply",
          display_text: "🏳️ Menyerah",
          id: `${prefix}tebak --nyerah`
        }];
        return await ctx.sendCta(activeWarningBody, `${global.bot?.name || "WudysoftBot"} • Game Sedang Berjalan`, activeButtons, {
          title: "乂 GAME MASIH AKTIF 乂",
          quoted: targetQuoted
        });
      }
      let selectedKey = null;
      if (rawText.includes("--gambar") || rawText.includes("gambar") || rawText.includes("--tebakgambar")) selectedKey = "gambar";
      else if (rawText.includes("--hewan") || rawText.includes("hewan")) selectedKey = "hewan";
      else if (rawText.includes("--kabupaten") || rawText.includes("kabupaten") || rawText.includes("--daerah")) selectedKey = "kabupaten";
      else if (rawText.includes("--logo") || rawText.includes("logo") || rawText.includes("--app")) selectedKey = "logo";
      else if (rawText.includes("--heroml") || rawText.includes("--ml") || rawText.includes("mlbb")) selectedKey = "heroml";
      else if (rawText.includes("--genshin") || rawText.includes("--gi") || rawText.includes("genshin")) selectedKey = "genshin";
      if (!selectedKey) {
        const categoryRows = Object.keys(GAME_TYPES).map(key => {
          const item = GAME_TYPES[key];
          return {
            title: `${item.emoji} ${item.name}`,
            id: `${prefix}tebak --${key}`,
            description: `Mulai kuis ${item.name}`
          };
        });
        const listSections = [{
          title: "🎮 PILIH KATEGORI GAME TEBAK",
          rows: categoryRows
        }];
        const bodyText = `🎮 *MINI GAMES: TEBAK KUIS*\n\n` + `Uji wawasan dan ketangkasanmu dalam berbagai kategori kuis seru!\n\n` + `*Pilihan Kategori Game:*\n` + `• 🖼️ \`${prefix}tebak --gambar\` (Tebak Gambar)\n` + `• 🦁 \`${prefix}tebak --hewan\` (Tebak Hewan)\n` + `• 🏛️ \`${prefix}tebak --kabupaten\` (Tebak Kabupaten)\n` + `• 📱 \`${prefix}tebak --logo\` (Tebak Logo Aplikasi)\n` + `• ⚔️ \`${prefix}tebak --heroml\` (Tebak Hero MLBB)\n` + `• ✨ \`${prefix}tebak --genshin\` (Tebak Karakter Genshin)\n\n` + `👇 *Pilih kategori dari menu di bawah untuk langsung mulai:*`;
        const footerText = `${global.bot?.name || "WudysoftBot"} • Mini Games Quiz`;
        const buttons = [{
          name: "single_select",
          title: "🎯 PILIH KATEGORI GAME",
          sections: listSections
        }];
        return await ctx.sendCta(bodyText, footerText, buttons, {
          title: "乂 MINI GAME QUIZ 乂",
          subtitle: "Pilih Kategori Permainan",
          quoted: quotedMsg
        });
      }
      await ctx.react("⏳");
      const gameConfig = GAME_TYPES[selectedKey];
      const {
        data
      } = await axios.get(gameConfig.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4,
        validateStatus: status => status < 500
      });
      if (!data) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat soal kuis dari server. Silakan coba lagi.");
      }
      let question = "";
      let answer = "";
      let clue = "";
      let hintMessage = "";
      let rawImageUrl = "";
      let rawAudioUrl = "";
      if (selectedKey === "gambar") {
        question = `Tebak susunan kata dari gambar berikut! (Level #${data.index || "Acak"})`;
        answer = data.jawaban || data.answer || "";
        clue = answer.replace(/[a-zA-Z0-9]/g, "_ ");
        hintMessage = data.deskripsi || data.description || "";
        rawImageUrl = data.img || data.image || "";
      } else if (selectedKey === "genshin") {
        const q = data.quiz || data;
        question = q.question || "Siapakah karakter Genshin Impact ini?";
        answer = q.answer || "";
        clue = q.mark_ans || "";
        hintMessage = q.quote ? `Quote: "${q.quote}"` : q.description || "";
        rawImageUrl = q.image || data.image || "";
      } else {
        question = data.question || "";
        answer = data.answer || "";
        clue = data.hint?.underline || data.clue || "";
        hintMessage = data.hint?.message || data.description || "";
        rawImageUrl = data.image || data.logo || data.portrait_images?.[0] || data.img || data.gambar || "";
        rawAudioUrl = data.quiz?.audio_url || data.hint?.audio || data.audio || "";
      }
      if (!answer) {
        throw new Error("Format jawaban dari API tidak valid.");
      }
      let mediaBuffer = null;
      if (rawImageUrl) {
        mediaBuffer = await fetchMediaBuffer(rawImageUrl);
      }
      const TIMEOUT_SECONDS = 120;
      const timer = setTimeout(async () => {
        if (global.tebakSession.has(chatId)) {
          const currentSession = global.tebakSession.get(chatId);
          global.tebakSession.delete(chatId);
          await sock.sendMessage(chatId, {
            text: `⏰ *Waktu Habis!*\n\nGame *${gameConfig.name}* telah berakhir.\nJawaban yang benar adalah: *${answer}*` + (hintMessage ? `\n📝 _${hintMessage}_` : "")
          }, {
            quoted: currentSession?.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const bodyText = `${gameConfig.emoji} *GAME: ${gameConfig.name.toUpperCase()}*\n\n` + `❓ *Pertanyaan:*\n${question}\n\n` + `💡 *Clue:* \`${clue || answer.replace(/[a-zA-Z0-9]/g, "_ ")}\`\n` + `⏱️ *Waktu:* ${TIMEOUT_SECONDS} detik\n\n` + `👉 *Reply (balas) pesan ini langsung dengan jawabanmu!*`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Reply pesan ini untuk menjawab`;
      const buttons = [{
        name: "quick_reply",
        display_text: "💡 Minta Petunjuk",
        id: `${prefix}tebak --hint`
      }, {
        name: "quick_reply",
        display_text: "🏳️ Menyerah",
        id: `${prefix}tebak --nyerah`
      }];
      const sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
        title: `乂 ${gameConfig.name.toUpperCase()} 乂`,
        subtitle: `Batas Waktu: ${TIMEOUT_SECONDS}s`,
        ...mediaBuffer ? {
          media: mediaBuffer,
          mediaType: "image"
        } : {},
        quoted: quotedMsg
      });
      const questionMsgId = sentMsg?.key?.id;
      global.tebakSession.set(chatId, {
        questionMsg: sentMsg,
        questionMsgId: questionMsgId,
        gameKey: selectedKey,
        gameName: gameConfig.name,
        answer: answer.trim(),
        clue: clue || answer.replace(/[a-zA-Z0-9]/g, "_ "),
        hintMessage: hintMessage,
        timer: timer,
        startTime: Date.now()
      });
      if (rawAudioUrl) {
        const audioBuffer = await fetchMediaBuffer(rawAudioUrl);
        if (audioBuffer) {
          await sock.sendMessage(chatId, {
            audio: audioBuffer,
            mimetype: "audio/mp4",
            ptt: true
          }, {
            quoted: sentMsg
          });
        }
      }
      await ctx.react("🎯");
    } catch (error) {
      console.error("[Tebak Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tebak Game Error: ${errMsg}`);
    }
  }
};