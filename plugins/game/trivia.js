import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.triviaSession = global.triviaSession || new Map();
const API_URL = "https://www.wudysoft.my.id/api/game/trivia-maker";
const QUESTION_TIMEOUT = 45;
const PRESET_TOPICS = [{
  id: "tech",
  name: "💻 Teknologi & Komputer",
  desc: "Seputar software, hardware, internet, & AI"
}, {
  id: "anime",
  name: "🎌 Anime & Manga",
  desc: "Kuis seputar anime, manga, & karakter populer"
}, {
  id: "science",
  name: "🔬 Sains & Pengetahuan Alam",
  desc: "Fisika, kimia, biologi, astronomi, & luar angkasa"
}, {
  id: "gaming",
  name: "🎮 Video Games",
  desc: "Game konsol, PC, mobile, esports, & sejarah gaming"
}, {
  id: "history",
  name: "📜 Sejarah Dunia & Indonesia",
  desc: "Peristiwa bersejarah, tokoh, kerajaan, & perang dunia"
}, {
  id: "geography",
  name: "🌍 Geografi & Negara",
  desc: "Ibukota, bendera, landmark, gunung, & peta dunia"
}, {
  id: "movies",
  name: "🎬 Film & Sinema",
  desc: "Hollywood, Marvel, DC, sutradara, & film box office"
}, {
  id: "music",
  name: "🎵 Musik & Musisi",
  desc: "Genre musik, band legendaris, lagu hits, & instrumen"
}, {
  id: "sports",
  name: "⚽ Olahraga & Atlet",
  desc: "Sepak bola, basket, bulu tangkis, F1, & olimpiade"
}, {
  id: "general",
  name: "🌐 Pengetahuan Umum",
  desc: "Kumpulan fakta unik dan pengetahuan umum dunia"
}];

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}

function getCorrectLetter(q) {
  const cleanAns = normalizeText(q.correctAnswer);
  if (normalizeText(q.optionA) === cleanAns) return "A";
  if (normalizeText(q.optionB) === cleanAns) return "B";
  if (normalizeText(q.optionC) === cleanAns) return "C";
  if (normalizeText(q.optionD) === cleanAns) return "D";
  return "A";
}

function formatTriviaBody(session) {
  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const totalQ = session.questions.length;
  let text = `🧠 *KUIS TRIVIA MASTER* 🧠\n\n`;
  text += `╭───『 *INFORMASI KUIS* 』\n`;
  text += `│ 📌 *Topik:* ${(session.topic || "General").toUpperCase()}\n`;
  text += `│ 📊 *Progres Soal:* Soal ${qNum} dari ${totalQ}\n`;
  text += `│ ⏳ *Waktu Jawab:* ${QUESTION_TIMEOUT} Detik\n`;
  text += `│ 🎁 *Hadiah:* +Rp 2.500 & +100 EXP\n`;
  text += `╰──────────────────\n\n`;
  text += `❓ *Pertanyaan:*\n*${q.question}*\n\n`;
  text += `╭───『 *PILIHAN JAWABAN* 』\n`;
  text += `│ 🅰️ *A.* ${q.optionA}\n`;
  text += `│ 🅱️ *B.* ${q.optionB}\n`;
  text += `│ 🅲️ *C.* ${q.optionC}\n`;
  text += `│ 🅳️ *D.* ${q.optionD}\n`;
  text += `╰──────────────────\n\n`;
  text += `_Klik tombol list di bawah untuk memilih jawaban atau ketik langsung huruf (A/B/C/D)!_`;
  return text;
}
async function sendTopicSelectionMenu(sock, ctx, chatId, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const topicRows = PRESET_TOPICS.map(t => ({
    title: t.name,
    id: `${prefix}trivia ${t.id}`,
    description: t.desc
  }));
  const bodyText = `🧠 *TRIVIA MASTER - PILIH TOPIK KUIS*\n\n` + `Kamu belum menentukan topik kuis trivia!\n` + `Silakan pilih salah satu topik bawaan dari menu di bawah ini, atau ketik manual topik kustommu.\n\n` + `💡 *Contoh Kustom:* \`${prefix}trivia Marvel\` atau \`${prefix}trivia Kpop\``;
  const footerText = `${botName} • Silakan pilih topik untuk memulai game`;
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `📚 DAFTAR TOPIK KUIS`,
      sections: [{
        title: `${botName} • Kategori Trivia Populer`,
        rows: topicRows
      }]
    })
  }];
  const options = {
    image: bannerImage,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Pilihan Topik`,
        button_title: "Pilih Topik"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    return await ctx.sendCta(bodyText, footerText, buttons, options);
  }
  let listFallback = `${bodyText}\n\n╭───『 *TOPIK TERSEDIA* 』\n`;
  PRESET_TOPICS.forEach((t, i) => {
    listFallback += `│ *${i + 1}.* ${t.name}\n│    👉 \`${prefix}trivia ${t.id}\`\n`;
  });
  listFallback += `╰──────────────────`;
  return await sock.sendMessage(chatId, {
    text: listFallback
  }, {
    quoted: quotedMsg
  });
}
async function sendTriviaCtaMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const q = session.questions[session.currentIndex];
  const qNum = session.currentIndex + 1;
  const bodyText = formatTriviaBody(session);
  const footerText = `${botName} • Soal ${qNum}/${session.questions.length} • Pilih jawaban di bawah`;
  const answerRows = [{
    title: `🅰️ Opsi A: ${q.optionA.slice(0, 30)}`,
    id: `A`,
    description: `Pilih [A] ${q.optionA.slice(0, 45)}`
  }, {
    title: `🅱️ Opsi B: ${q.optionB.slice(0, 30)}`,
    id: `B`,
    description: `Pilih [B] ${q.optionB.slice(0, 45)}`
  }, {
    title: `🅲️ Opsi C: ${q.optionC.slice(0, 30)}`,
    id: `C`,
    description: `Pilih [C] ${q.optionC.slice(0, 45)}`
  }, {
    title: `🅳️ Opsi D: ${q.optionD.slice(0, 30)}`,
    id: `D`,
    description: `Pilih [D] ${q.optionD.slice(0, 45)}`
  }, {
    title: `🏳️ Menyerah`,
    id: `${prefix}trivia --nyerah`,
    description: `Hentikan sesi kuis dan buka kunci jawaban`
  }];
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `🔘 PILIH JAWABAN (${qNum}/${session.questions.length})`,
      sections: [{
        title: `${botName} • Opsi Soal #${qNum}`,
        rows: answerRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Menyerah",
      id: `${prefix}trivia --nyerah`
    })
  }];
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const options = {
    image: bannerImage,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Trivia Quiz`,
        button_title: "Jawab Kuis"
      },
      limited_time_offer: {
        text: `⏳ Sisa Waktu: ${QUESTION_TIMEOUT} Detik`,
        url: "",
        copy_code: "",
        expiration_time: Date.now() + QUESTION_TIMEOUT * 1e3
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[Trivia sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                hasMediaAttachment: true,
                imageMessage: {
                  url: bannerImage
                }
              },
              body: {
                text: bodyText
              },
              footer: {
                text: footerText
              },
              nativeFlowMessage: {
                buttons: buttons.map(b => ({
                  name: b.name,
                  buttonParamsJson: b.buttonParamsJson
                }))
              },
              contextInfo: options.contextInfo
            }
          }
        }
      }, {
        quoted: quotedMsg
      });
    } catch (e) {}
  }
  if (!sentMsg) {
    sentMsg = await sock.sendMessage(chatId, {
      image: {
        url: bannerImage
      },
      caption: `${bodyText}\n\n_${footerText}_`
    }, {
      quoted: quotedMsg
    });
  }
  if (sentMsg?.key?.id) {
    session.msgIds = session.msgIds || new Set();
    session.msgIds.add(sentMsg.key.id);
    session.questionMsg = sentMsg;
    session.questionMsgId = sentMsg.key.id;
  }
  return sentMsg;
}
async function nextTriviaQuestion(sock, ctx, chatId, session, prefix = ".") {
  clearTimeout(session.timer);
  session.currentIndex++;
  if (session.currentIndex >= session.questions.length) {
    global.triviaSession.delete(chatId);
    let scoreboard = `🏆 *PERMAINAN TRIVIA SELESAI!* 🏆\n\n`;
    scoreboard += `📊 *PAPAN SKOR AKHIR:*\n`;
    const sortedPlayers = Object.entries(session.scores).sort((a, b) => b[1].score - a[1].score);
    const mentions = [];
    if (sortedPlayers.length) {
      sortedPlayers.forEach(([jid, data], idx) => {
        mentions.push(jid);
        scoreboard += `*${idx + 1}.* @${jid.split("@")[0]} ➔ ${data.correct} Benar (${data.score} Poin)\n`;
      });
    } else {
      scoreboard += `_Tidak ada pemain yang berhasil menjawab dengan benar._\n`;
    }
    scoreboard += `\n🎉 *Terima kasih telah berpartisipasi! Ketik \`${prefix}trivia <topik>\` untuk bermain lagi.*`;
    return await sock.sendMessage(chatId, {
      text: scoreboard,
      mentions: mentions
    }, {
      quoted: session.questionMsg || null
    });
  }
  session.timer = setTimeout(async () => {
    if (global.triviaSession.has(chatId)) {
      const activeSession = global.triviaSession.get(chatId);
      const currentQ = activeSession.questions[activeSession.currentIndex];
      const correctLtr = getCorrectLetter(currentQ);
      await sock.sendMessage(chatId, {
        text: `⏰ *WAKTU HABIS!*\n\nKunci jawaban yang benar: *[${correctLtr}] ${currentQ.correctAnswer}*.\nLanjut ke soal berikutnya...`
      }, {
        quoted: activeSession.questionMsg || null
      });
      await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
    }
  }, QUESTION_TIMEOUT * 1e3);
  await sendTriviaCtaMessage(sock, ctx, chatId, session, session.questionMsg, prefix);
}
export default {
  name: "trivia",
  aliases: ["triviakuis", "kuistrivia", "triviamaker", "quiz"],
  description: "Game kuis trivia pilihan ganda interaktif dengan CTA List UI & seleksi topik",
  category: "Game",
  limit: true,
  example: "trivia tech\ntrivia anime\ntrivia history\ntrivia science",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.triviaSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.triviaSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || session.msgIds && session.msgIds.has(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = normalizeText(userText);
      if (!cleanInput) return;
      const currentQ = session.questions[session.currentIndex];
      const correctLetter = getCorrectLetter(currentQ);
      const correctText = normalizeText(currentQ.correctAnswer);
      const isCorrect = cleanInput === correctLetter.toLowerCase() || cleanInput === correctText || cleanInput.length >= 4 && correctText.includes(cleanInput);
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
      const senderJid = ctx?.sender || msg?.key?.participant;
      if (isCorrect) {
        clearTimeout(session.timer);
        session.scores[senderJid] = session.scores[senderJid] || {
          name: senderName,
          score: 0,
          correct: 0
        };
        session.scores[senderJid].score += 100;
        session.scores[senderJid].correct += 1;
        if (senderJid) {
          if (typeof db?.ensureUser === "function") {
            db.ensureUser(senderJid, senderName);
          }
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 100;
            global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 2500;
            if (typeof db?.write === "function") db.write(global.db);
          }
        }
        if (typeof ctx?.react === "function") await ctx.react("✅");
        const winNotif = `🎉 *JAWABAN BENAR!*\n` + `Jawaban *[${correctLetter}] ${currentQ.correctAnswer}* berhasil dijawab oleh @${senderJid.split("@")[0]}!\n` + `🎁 *Reward:* +Rp 2.500 & +100 EXP (+100 Poin)`;
        await sock.sendMessage(chatId, {
          text: winNotif,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        await nextTriviaQuestion(sock, ctx, chatId, session, ctx?.prefix || ".");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *Jawaban Salah!* "${userText}" bukan jawaban yang tepat. Coba pilih lagi!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[TRIVIA BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Kuis Trivia ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("stop")) {
        if (global.triviaSession.has(chatId)) {
          const session = global.triviaSession.get(chatId);
          clearTimeout(session.timer);
          global.triviaSession.delete(chatId);
          const currentQ = session.questions[session.currentIndex];
          const correctLtr = getCorrectLetter(currentQ);
          return await sock.sendMessage(chatId, {
            text: `🏳️ *KUIS TRIVIA DIHENTIKAN*\n\nKunci jawaban soal terakhir: *[${correctLtr}] ${currentQ.correctAnswer}*.\nPermainan telah berakhir.`
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Kuis Trivia yang sedang aktif di grup ini.");
      }
      if (global.triviaSession.has(chatId)) {
        const session = global.triviaSession.get(chatId);
        return await sendTriviaCtaMessage(sock, ctx, chatId, session, session.questionMsg || quotedMsg, prefix);
      }
      if (!rawText) {
        return await sendTopicSelectionMenu(sock, ctx, chatId, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      const topic = rawText;
      const {
        data
      } = await axios.get(API_URL, {
        params: {
          topic: topic
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      const questions = data?.questions || [];
      if (!Array.isArray(questions) || questions.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memuat kuis trivia untuk topik "${topic}".\nKetik \`${prefix}trivia\` untuk melihat daftar topik yang tersedia.`);
      }
      const sessionObj = {
        topic: topic,
        questions: questions,
        currentIndex: 0,
        scores: {},
        msgIds: new Set(),
        timer: null,
        startTime: Date.now()
      };
      sessionObj.timer = setTimeout(async () => {
        if (global.triviaSession.has(chatId)) {
          const activeSession = global.triviaSession.get(chatId);
          const currentQ = activeSession.questions[activeSession.currentIndex];
          const correctLtr = getCorrectLetter(currentQ);
          await sock.sendMessage(chatId, {
            text: `⏰ *WAKTU HABIS!*\n\nKunci jawaban yang benar: *[${correctLtr}] ${currentQ.correctAnswer}*.\nLanjut ke soal berikutnya...`
          }, {
            quoted: activeSession.questionMsg || null
          });
          await nextTriviaQuestion(sock, ctx, chatId, activeSession, prefix);
        }
      }, QUESTION_TIMEOUT * 1e3);
      global.triviaSession.set(chatId, sessionObj);
      await sendTriviaCtaMessage(sock, ctx, chatId, sessionObj, quotedMsg, prefix);
      await ctx.react("🧠");
    } catch (error) {
      console.error("[Trivia Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Trivia Game Error: ${errMsg}`);
    }
  }
};