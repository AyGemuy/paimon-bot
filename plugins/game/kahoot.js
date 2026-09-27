import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
const API_URL = "https://wudysoft.my.id/api/fun/kahoot";
global.kahootGameSession = global.kahootGameSession || new Map();

function cleanHtml(str = "") {
  return String(str).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function normalizeText(str = "") {
  return String(str).toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function sendKahootQuestion(sock, ctx, chatId, session, quotedMsg) {
  const prefix = ctx.prefix || ".";
  const botName = global.bot?.name || "WudysoftBot";
  const q = session.questions[session.currentIndex];
  const qIndex = session.currentIndex + 1;
  const totalQ = session.questions.length;
  const timeoutSec = Math.max(Math.round((q.time || 3e4) / 1e3), 20);
  const questionTitle = cleanHtml(q.question || q.title || "Pertanyaan Kuis");
  const choices = (q.choices || []).map(c => ({
    answer: cleanHtml(c.answer),
    correct: Boolean(c.correct)
  }));
  const letters = ["A", "B", "C", "D", "E", "F"];
  let choiceText = "";
  const choiceRows = [];
  choices.forEach((c, idx) => {
    const label = letters[idx] || `${idx + 1}`;
    choiceText += `• *[ ${label} ]* ${c.answer}\n`;
    choiceRows.push({
      title: `[ Pilihan ${label} ] ${c.answer.slice(0, 30)}`,
      id: `${prefix}kahootgame ${label}`,
      description: `Ketuk untuk memilih jawaban ${label}`
    });
  });
  const bodyText = `🎯 *KAHOOT QUIZ: ${session.quizTitle.toUpperCase()}*\n\n` + `╭───『 *SOAL #${qIndex} DARI ${totalQ}* 』\n` + `│ ❓ *Pertanyaan:*\n` + `│ ${questionTitle}\n` + `╰────────────────────────\n\n` + `📋 *Daftar Pilihan Jawaban:*\n` + `${choiceText}\n` + `⏱️ *Batas Waktu:* \`${timeoutSec} detik\`\n` + `📊 *Skor:* \`${session.score} Poin\`\n\n` + `👇 *Ketuk tombol di bawah untuk langsung memilih jawabanmu:*`;
  const footerText = `${botName} • Soal ${qIndex} dari ${totalQ}`;
  const buttons = [{
    name: "single_select",
    title: "🎯 PILIH JAWABAN ANDA",
    sections: [{
      title: `Soal #${qIndex}: Pilih Opsi Jawaban`,
      rows: choiceRows
    }]
  }, {
    name: "quick_reply",
    display_text: "⏭️ Lewati Soal",
    id: `${prefix}kahootgame --skip`
  }, {
    name: "quick_reply",
    display_text: "🏳️ Menyerah",
    id: `${prefix}kahootgame --nyerah`
  }];
  const mediaUrl = q.image || q.media?.[0]?.url || session.coverUrl || null;
  const timer = setTimeout(async () => {
    if (global.kahootGameSession.has(chatId)) {
      const activeSession = global.kahootGameSession.get(chatId);
      const currentQ = activeSession.questions[activeSession.currentIndex];
      const correctChoice = currentQ.choices?.find(c => c.correct === true);
      const correctAnsText = correctChoice ? cleanHtml(correctChoice.answer) : "-";
      await sock.sendMessage(chatId, {
        text: `⏰ *Waktu Habis untuk Soal #${qIndex}!*\nKunci Jawaban: *${correctAnsText}*`
      });
      activeSession.currentIndex++;
      if (activeSession.currentIndex < activeSession.questions.length) {
        await sendKahootQuestion(sock, ctx, chatId, activeSession, quotedMsg);
      } else {
        global.kahootGameSession.delete(chatId);
        await sock.sendMessage(chatId, {
          text: `🏁 *KUIS KAHOOT SELESAI!*\n\n` + `🏆 *Skor Akhir:* \`${activeSession.score} / ${activeSession.questions.length * 100}\`\n` + `🎯 *Akurasi:* \`${Math.round(activeSession.score / (activeSession.questions.length * 100) * 100)}%\``
        });
      }
    }
  }, timeoutSec * 1e3);
  session.timer = timer;
  const options = {
    title: `乂 KAHOOT: SOAL #${qIndex}/${totalQ} 乂`,
    subtitle: `Skor: ${session.score} Poin`,
    media: mediaUrl,
    quoted: quotedMsg
  };
  if (typeof ctx.sendCta === "function") {
    await ctx.sendCta(bodyText, footerText, buttons, options);
  } else if (mediaUrl) {
    await sock.sendMessage(chatId, {
      image: {
        url: mediaUrl
      },
      caption: bodyText
    }, {
      quoted: quotedMsg
    });
  } else {
    await sock.sendMessage(chatId, {
      text: bodyText
    }, {
      quoted: quotedMsg
    });
  }
}
export default {
  name: "kahootgame",
  aliases: ["kgame", "kahoot-game", "kuiskahoot", "kahootplay"],
  description: "Bermain kuis interaktif Kahoot Full Button / Dropdown tanpa banyak mengetik",
  category: "Game",
  limit: true,
  example: "kahootgame 2nd Grade Phonics atau kahootgame Anime",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.kahootGameSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.kahootGameSession.get(chatId);
      let userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefix = ctx?.prefix || ".";
      if (userText.startsWith(`${prefix}kahootgame `)) {
        userText = userText.slice(`${prefix}kahootgame `.length).trim();
      }
      if (userText.startsWith("--") || userText === `${prefix}kahootgame`) return;
      const q = session.questions[session.currentIndex];
      const choices = q.choices || [];
      const letters = ["a", "b", "c", "d", "e", "f"];
      const lowerInput = userText.toLowerCase().trim();
      let selectedIndex = -1;
      if (letters.includes(lowerInput)) {
        selectedIndex = letters.indexOf(lowerInput);
      } else if (!isNaN(lowerInput) && parseInt(lowerInput) >= 1 && parseInt(lowerInput) <= choices.length) {
        selectedIndex = parseInt(lowerInput) - 1;
      } else {
        const cleanUser = normalizeText(userText);
        selectedIndex = choices.findIndex(c => {
          const cleanAns = normalizeText(cleanHtml(c.answer));
          return cleanAns === cleanUser || cleanAns.includes(cleanUser) || cleanUser.includes(cleanAns);
        });
      }
      if (selectedIndex === -1 || !choices[selectedIndex]) return;
      clearTimeout(session.timer);
      const chosenChoice = choices[selectedIndex];
      const isCorrect = Boolean(chosenChoice.correct);
      const correctChoice = choices.find(c => c.correct === true);
      const correctAnsText = correctChoice ? cleanHtml(correctChoice.answer) : "-";
      const senderJid = ctx?.sender;
      const senderName = ctx?.pushname || "Pemain";
      if (isCorrect) {
        session.score += 100;
        if (senderJid && global.db?.user?.[senderJid]) {
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 150;
          if (typeof db?.write === "function") db.write(global.db);
        }
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        await sock.sendMessage(chatId, {
          text: `🎉 *BENAR!* (+150 EXP)\nJawaban: *${cleanHtml(chosenChoice.answer)}*\nSkor: \`${session.score} Poin\``
        }, {
          quoted: msg
        });
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *SALAH!*\nPilihanmu: _${cleanHtml(chosenChoice.answer)}_\nKunci Jawaban: *${correctAnsText}*`
        }, {
          quoted: msg
        });
      }
      session.currentIndex++;
      if (session.currentIndex < session.questions.length) {
        await sendKahootQuestion(sock, ctx, chatId, session, msg);
      } else {
        global.kahootGameSession.delete(chatId);
        await sock.sendMessage(chatId, {
          text: `🏁 *KUIS SELESAI!*\n\n` + `👤 *Pemain:* ${senderName}\n` + `🏆 *Skor Akhir:* \`${session.score} / ${session.questions.length * 100}\`\n` + `🎯 *Akurasi:* \`${Math.round(session.score / (session.questions.length * 100) * 100)}%\``
        }, {
          quoted: msg
        });
      }
      return true;
    } catch (e) {
      console.error("[KAHOOT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (global.kahootGameSession.has(chatId)) {
        const session = global.kahootGameSession.get(chatId);
        if (rawText.includes("--nyerah") || rawText.includes("nyerah")) {
          clearTimeout(session.timer);
          global.kahootGameSession.delete(chatId);
          return ctx.reply(`🏳️ *Permainan Kahoot Dihentikan!* Skor kamu: \`${session.score} Poin\`.`);
        }
        if (rawText.includes("--skip") || rawText.includes("skip")) {
          clearTimeout(session.timer);
          session.currentIndex++;
          if (session.currentIndex < session.questions.length) {
            await ctx.reply("⏭️ *Soal dilewati, memuat soal berikutnya...*");
            await sendKahootQuestion(sock, ctx, chatId, session, quotedMsg);
          } else {
            global.kahootGameSession.delete(chatId);
            return ctx.reply(`🏁 *Kuis selesai!* Skor akhir: \`${session.score} Poin\`.`);
          }
          return;
        }
      }
      if (!rawText) {
        return ctx.reply(`🎮 *KAHOOT GAME (FULL BUTTON)*\n\n` + `• *Mulai Game:* \`${prefix}kahootgame <topik_kuis>\`\n` + `  👉 Contoh: \`${prefix}kahootgame Phonics\`\n` + `  👉 Contoh: \`${prefix}kahootgame Anime\`\n\n` + `• *Mulai via UUID:* \`${prefix}kahootgame --uuid <uuid_kuis>\``);
      }
      await ctx.react("⏳");
      let targetUuid = "";
      if (/--uuid\s+([^\s]+)/i.test(rawText)) {
        const match = rawText.match(/--uuid\s+([^\s]+)/i);
        if (match) targetUuid = match[1];
      }
      if (!targetUuid) {
        const {
          data: searchData
        } = await axios.post(API_URL, {
          action: "search",
          query: rawText
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        const entities = searchData?.entities || [];
        if (!searchData || entities.length === 0) {
          await ctx.react("❌");
          return ctx.reply(`❌ Kuis Kahoot dengan topik "*${rawText}*" tidak ditemukan.`);
        }
        const quizRows = entities.slice(0, 10).map((item, idx) => {
          const c = item.card || {};
          return {
            title: `[#${idx + 1}] ${cleanHtml(c.title).slice(0, 30)}`,
            id: `${prefix}kahootgame --uuid ${c.uuid}`,
            description: `❓ ${c.number_of_questions || 0} Soal • 👤 ${c.creator_username || "Unknown"}`
          };
        });
        const firstCard = entities[0]?.card || {};
        const coverMedia = firstCard.cover || global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
        const selectBodyText = `🎯 *PILIH KUIS KAHOOT UNTUK DIMAINKAN*\n\n` + `🔍 *Topik:* \`${rawText}\`\n` + `📊 *Ditemukan:* ${entities.length} Kuis Siap Main\n\n` + `👇 *Pilih salah satu kuis pada menu dropdown di bawah untuk langsung mulai bermain:*`;
        const selectButtons = [{
          name: "single_select",
          title: "🎮 PILIH KUIS KAHOOT",
          sections: [{
            title: `Hasil Pencarian: ${rawText}`,
            rows: quizRows
          }]
        }];
        return await ctx.sendCta(selectBodyText, `${global.bot?.name || "WudysoftBot"} • Kahoot Game`, selectButtons, {
          title: "乂 KAHOOT GAME: PILIH KUIS 乂",
          subtitle: `Topik: ${rawText}`,
          media: coverMedia,
          quoted: quotedMsg
        });
      }
      const {
        data: detailData
      } = await axios.post(API_URL, {
        action: "detail",
        uuid: targetUuid
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 6e4
      });
      const kahoot = detailData?.kahoot || {};
      const card = detailData?.card || {};
      const questions = (kahoot.questions || []).filter(q => q.choices && q.choices.length > 0);
      if (!detailData || questions.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat soal kuis dari server. Coba pilih kuis lainnya.");
      }
      const newSession = {
        quizTitle: cleanHtml(card.title || kahoot.title || "Kahoot Game"),
        coverUrl: card.cover || kahoot.cover || null,
        questions: questions.slice(0, 10),
        currentIndex: 0,
        score: 0,
        startTime: Date.now(),
        timer: null
      };
      global.kahootGameSession.set(chatId, newSession);
      await sendKahootQuestion(sock, ctx, chatId, newSession, quotedMsg);
      await ctx.react("🎮");
    } catch (error) {
      console.error("[KAHOOT GAME ERROR]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Kahoot Game Error: ${errMsg}`);
    }
  }
};