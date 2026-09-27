import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.tebakLaguSession = global.tebakLaguSession || new Map();
const API_URL = "https://wudysoft.my.id/api/game/tebak-lagu/v2";

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function fetchAudioBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      timeout: 2e4
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Audio Error]:", err.message);
  }
  return null;
}
export default {
  name: "tebaklagu",
  aliases: ["tebak-lagu", "kuislagu", "guessthesong"],
  description: "Game kuis tebak judul lagu dari potongan audio dengan pilihan ganda",
  category: "Game",
  limit: true,
  example: "tebaklagu",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.tebakLaguSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.tebakLaguSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isReplyingToQuiz = quotedStanzaId && (quotedStanzaId === session.questionMsgId || quotedStanzaId === session.audioMsgId);
      if (!isReplyingToQuiz) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const correctKey = normalizeText(session.key);
      const correctAnswer = normalizeText(session.answer);
      const isCorrect = cleanUser === correctKey || cleanUser === `opsi ${correctKey}` || cleanUser === `pilihan ${correctKey}` || cleanUser === correctAnswer || cleanUser.includes(correctAnswer) || correctAnswer.includes(cleanUser) && cleanUser.length >= 4;
      if (isCorrect) {
        clearTimeout(session.timer);
        global.tebakLaguSession.delete(chatId);
        const duration = ((Date.now() - session.startTime) / 1e3).toFixed(1);
        const senderName = ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender;
        if (senderJid && global.db?.user?.[senderJid]) {
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 300;
          if (typeof db?.write === "function") db.write(global.db);
        }
        const winMessage = `🎉 *TEBAKAN KAMU TEPAT SEKALI!*\n\n` + `👤 *Penebak:* ${senderName}\n` + `🎵 *Judul Lagu:* *${session.answer}* (Opsi ${session.key})\n` + `⏱️ *Waktu Menjawab:* ${duration} detik\n` + `🎁 *Hadiah:* +300 EXP`;
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
          text: `❌ *Jawaban Salah!*\n"${userText}" bukan jawaban yang tepat. Silakan dengarkan kembali dan coba tebak lagi!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TEBAK LAGU BEFORE HANDLER ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (global.tebakLaguSession.has(chatId)) {
        const session = global.tebakLaguSession.get(chatId);
        const targetQuoted = session.questionMsg || quotedMsg;
        if (rawText.includes("--clue") || rawText.includes("--hint") || rawText.includes("hint")) {
          const hintButtons = [{
            name: "quick_reply",
            display_text: "🏳️ Menyerah",
            id: `${prefix}tebaklagu --nyerah`
          }];
          return await ctx.sendCta(`💡 *PETUNJUK JUDUL LAGU:*\n\`${session.clue}\`\n\n_Dengarkan audio yang dikirim untuk mencocokkan lirik/nadanya._`, `${global.bot?.name || "WudysoftBot"} • Game Hint`, hintButtons, {
            title: "乂 PETUNJUK TEBAK LAGU 乂",
            quoted: targetQuoted
          });
        }
        if (rawText.includes("--nyerah") || rawText.includes("--surrender") || rawText.includes("nyerah")) {
          clearTimeout(session.timer);
          global.tebakLaguSession.delete(chatId);
          return await sock.sendMessage(chatId, {
            text: `🏳️ *Kamu Menyerah!*\n\nGame Tebak Lagu telah dihentikan.\nJawaban yang benar adalah: *${session.answer}* (Opsi ${session.key})`
          }, {
            quoted: targetQuoted
          });
        }
        const activeWarningBody = `⚠️ *Masih ada permainan Tebak Lagu yang aktif di chat ini!*

💡 *Petunjuk:* \`${session.clue}\`
👉 *Reply pesan soal/audio* dengan opsi A/B/C/D atau klik tombol di bawah:`;
        const activeButtons = [{
          name: "quick_reply",
          display_text: "💡 Minta Petunjuk",
          id: `${prefix}tebaklagu --hint`
        }, {
          name: "quick_reply",
          display_text: "🏳️ Menyerah",
          id: `${prefix}tebaklagu --nyerah`
        }];
        return await ctx.sendCta(activeWarningBody, `${global.bot?.name || "WudysoftBot"} • Game Sedang Berjalan`, activeButtons, {
          title: "乂 GAME MASIH AKTIF 乂",
          quoted: targetQuoted
        });
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.get(API_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.status !== 200 || !data.audio) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis tebak lagu dari server. Silakan coba lagi.");
      }
      const answer = data.answer || "";
      const rawAudioUrl = data.audio || "";
      const underlineClue = data.hint?.underline || answer.replace(/[a-zA-Z0-9]/g, "_ ");
      const correctKey = data.details?.key || "A";
      const options = data.details?.options || {};
      const TIMEOUT_SECONDS = 120;
      const timer = setTimeout(async () => {
        if (global.tebakLaguSession.has(chatId)) {
          const activeSession = global.tebakLaguSession.get(chatId);
          global.tebakLaguSession.delete(chatId);
          await sock.sendMessage(chatId, {
            text: `⏰ *Waktu Habis!*\n\nGame Tebak Lagu telah berakhir.\nJawaban yang benar adalah: *${answer}* (Opsi ${correctKey})`
          }, {
            quoted: activeSession?.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const optionRows = Object.keys(options).map(optKey => ({
        title: `[${optKey}] ${options[optKey]}`.slice(0, 24),
        id: `${optKey}`,
        description: `Pilih opsi ${optKey}: ${options[optKey]}`.slice(0, 60)
      }));
      const listSections = [{
        title: "🎧 PILIH JAWABAN YANG TEPAT",
        rows: optionRows
      }];
      const bodyText = `🎧 *GAME: TEBAK JUDUL LAGU*\n\n` + `Dengarkan audio potongan lagu yang dikirim dan tebak judulnya!\n\n` + `📋 *Pilihan Jawaban:*\n` + `• 🅰️ ${options.A || "-"}\n` + `• 🅱️ ${options.B || "-"}\n` + `• 🅲 ${options.C || "-"}\n` + `• 🅳 ${options.D || "-"}\n\n` + `💡 *Clue:* \`${underlineClue}\`\n` + `⏱️ *Waktu:* ${TIMEOUT_SECONDS} detik\n\n` + `👉 *Reply pesan soal/audio ini dengan A, B, C, atau D!*`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • Reply pesan ini untuk menjawab`;
      const buttons = [{
        name: "single_select",
        title: "🎯 PILIH JAWABAN",
        sections: listSections
      }, {
        name: "quick_reply",
        display_text: "💡 Minta Petunjuk",
        id: `${prefix}tebaklagu --hint`
      }, {
        name: "quick_reply",
        display_text: "🏳️ Menyerah",
        id: `${prefix}tebaklagu --nyerah`
      }];
      const sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 KUIS TEBAK LAGU 乂",
        subtitle: `Batas Waktu: ${TIMEOUT_SECONDS}s`,
        quoted: quotedMsg
      });
      const questionMsgId = sentMsg?.key?.id;
      const audioBuffer = await fetchAudioBuffer(rawAudioUrl);
      let sentAudioMsg = null;
      if (audioBuffer) {
        sentAudioMsg = await sock.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: "audio/mp4",
          ptt: true
        }, {
          quoted: sentMsg
        });
      }
      global.tebakLaguSession.set(chatId, {
        questionMsg: sentMsg,
        questionMsgId: questionMsgId,
        audioMsgId: sentAudioMsg?.key?.id || null,
        answer: answer.trim(),
        key: correctKey.trim(),
        clue: underlineClue,
        timer: timer,
        startTime: Date.now()
      });
      await ctx.react("🎵");
    } catch (error) {
      console.error("[Tebak Lagu Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Tebak Lagu Error: ${errMsg}`);
    }
  }
};