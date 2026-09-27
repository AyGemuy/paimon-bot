import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.animeQuizSession = global.animeQuizSession || new Map();
const API_URL = "https://www.wudysoft.my.id/api/game/anime-quiz";
const DEFAULT_TIMEOUT = 30;

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}
async function callAnimeQuizApi(params = {}) {
  const res = await axios.get(API_URL, {
    params: params,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 3e4
  });
  return res?.data;
}

function formatAnimeQuizBody(session) {
  const stats = session.data.stats || {};
  const choices = session.data.quiz?.choices || [];
  const qNum = session.data.question_number || 1;
  const livesCount = Math.max(0, stats.lives ?? 3);
  const hearts = "❤️".repeat(livesCount) + "🖤".repeat(Math.max(0, 3 - livesCount));
  let text = `🎌 *ANIME CHARACTER GUESS QUIZ* 🎌\n\n`;
  text += `╭───『 *STATUS PERMAINAN* 』\n`;
  text += `│ 📊 *Soal Ke:* #${qNum} (Level ${stats.level || 1})\n`;
  text += `│ 💖 *Nyawa:* ${hearts} (${livesCount}/3)\n`;
  text += `│ 🏆 *Total Skor:* ${stats.score || "00000"}\n`;
  text += `│ ⏳ *Waktu Jawab:* ${session.data.time_limit || DEFAULT_TIMEOUT} Detik\n`;
  text += `│ 🎁 *Hadiah:* +Rp 3.000 & +150 EXP\n`;
  text += `╰──────────────────\n\n`;
  text += `❓ *Siapakah nama karakter anime pada gambar di atas?*\n\n`;
  text += `╭───『 *PILIHAN JAWABAN* 』\n`;
  const letters = ["🅰️ A", "🅱️ B", "🅲️ C", "🅳️ D"];
  choices.forEach((c, idx) => {
    text += `│ ${letters[idx] || `[${idx + 1}]`}. *${c.name}*\n│     📺 _Anime: ${c.anime}_\n`;
  });
  text += `╰──────────────────\n\n`;
  text += `_Pilih opsi melalui tombol list di bawah atau balas chat dengan huruf A/B/C/D!_`;
  return text;
}
async function sendAnimeQuizMessage(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const choices = session.data.quiz?.choices || [];
  const qNum = session.data.question_number || 1;
  const imageUrl = session.data.quiz?.image || "https://files.catbox.moe/g2e6i5.jpg";
  const bodyText = formatAnimeQuizBody(session);
  const footerText = `${botName} • Soal #${qNum} • Pilih jawaban di menu`;
  const letters = ["A", "B", "C", "D"];
  const choiceRows = choices.map((c, i) => ({
    title: `[${letters[i]}] ${c.name.slice(0, 25)}`,
    id: letters[i],
    description: `📺 ${c.anime.slice(0, 45)}`
  }));
  choiceRows.push({
    title: "🏳️ Menyerah",
    id: `${prefix}animequiz --nyerah`,
    description: "Hentikan sesi kuis anime"
  });
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `🔘 PILIH KARAKTER (Soal #${qNum})`,
      sections: [{
        title: `${botName} • Pilihan Jawaban`,
        rows: choiceRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🏳️ Nyerah",
      id: `${prefix}animequiz --nyerah`
    })
  }];
  const options = {
    image: imageUrl,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Anime Quiz`,
        button_title: "Pilih Karakter"
      },
      limited_time_offer: {
        text: `⏳ Sisa Waktu: ${session.data.time_limit || DEFAULT_TIMEOUT} Detik`,
        url: "",
        copy_code: "",
        expiration_time: Date.now() + (session.data.time_limit || DEFAULT_TIMEOUT) * 1e3
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
      console.error("[AnimeQuiz sendCta Error]:", e.message);
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
                  url: imageUrl
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
        url: imageUrl
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
export default {
  name: "animequiz",
  aliases: ["tebakanime", "tebakkarakter", "animeguess", "aquiz"],
  description: "Game tebak gambar karakter & anime interaktif dengan sistem nyawa dan level",
  category: "Game",
  limit: true,
  example: "animequiz\nanimequiz --nyerah",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.animeQuizSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.animeQuizSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || session.msgIds && session.msgIds.has(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = normalizeText(userText);
      if (!cleanInput) return;
      const choices = session.data.quiz?.choices || [];
      const letters = ["a", "b", "c", "d"];
      let chosenItem = null;
      if (letters.includes(cleanInput)) {
        const idx = letters.indexOf(cleanInput);
        chosenItem = choices[idx];
      } else if (/^[1-4]$/.test(cleanInput)) {
        const idx = Number(cleanInput) - 1;
        chosenItem = choices[idx];
      } else {
        chosenItem = choices.find(c => normalizeText(c.name) === cleanInput || normalizeText(c.anime) === cleanInput || cleanInput.length >= 4 && normalizeText(c.name).includes(cleanInput));
      }
      if (!chosenItem) {
        return;
      }
      clearTimeout(session.timer);
      const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const resultData = await callAnimeQuizApi({
        session: session.apiSession,
        answer: chosenItem.id
      });
      if (resultData?.is_correct === true) {
        if (typeof ctx?.react === "function") await ctx.react("✅");
        if (senderJid) {
          if (typeof db?.ensureUser === "function") {
            db.ensureUser(senderJid, senderName);
          }
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 150;
            global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3e3;
            if (typeof db?.write === "function") db.write(global.db);
          }
        }
        const winNotif = `🎉 *TEBAKAN TEPAT!* 🎉\n\n` + `Karakter: *${chosenItem.name}*\n` + `Anime: *${chosenItem.anime}*\n` + `Penebak: @${senderJid.split("@")[0]}\n` + `🎁 *Reward:* +Rp 3.000 & +150 EXP (+${resultData.stats?.added_score || 100} Poin)\n\n` + `_Memuat soal berikutnya..._`;
        await sock.sendMessage(chatId, {
          text: winNotif,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        session.data = resultData;
        session.apiSession = resultData.session || session.apiSession;
        session.timer = setTimeout(async () => {
          if (global.animeQuizSession.has(chatId)) {
            global.animeQuizSession.delete(chatId);
            await sock.sendMessage(chatId, {
              text: `⏰ *WAKTU HABIS!*\nSesi Anime Quiz telah berakhir karena tidak ada jawaban.`
            }, {
              quoted: session.questionMsg || null
            });
          }
        }, (resultData.time_limit || DEFAULT_TIMEOUT) * 1e3);
        await sendAnimeQuizMessage(sock, ctx, chatId, session, session.questionMsg, ctx?.prefix || ".");
        return true;
      }
      if (resultData?.is_correct === false || resultData?.stats?.lives === 0) {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        const remainingLives = resultData?.stats?.lives ?? 0;
        if (remainingLives <= 0) {
          global.animeQuizSession.delete(chatId);
          const gameOverText = `💀 *GAME OVER - NYAWA HABIS!* 💀\n\n` + `❌ Tebakan *"${chosenItem.name}"* salah!\n` + `📊 *Skor Akhir:* ${resultData?.stats?.score || session.data.stats?.score || "0"}\n` + `🏆 *Level Dicapai:* Level ${resultData?.stats?.level || session.data.stats?.level || 1}\n\n` + `Gunakan \`${ctx?.prefix || "."}animequiz\` untuk memulai game baru!`;
          await sock.sendMessage(chatId, {
            text: gameOverText
          }, {
            quoted: msg
          });
          return true;
        }
        session.data = resultData;
        session.apiSession = resultData.session || session.apiSession;
        const wrongText = `❌ *JAWABAN SALAH!*\n` + `Tebakan *"${chosenItem.name}"* kurang tepat.\n` + `Sisa Nyawa: ❤️ *${remainingLives}/3*\n\n` + `_Coba tebak pilihan lainnya!_`;
        await sock.sendMessage(chatId, {
          text: wrongText
        }, {
          quoted: msg
        });
        session.timer = setTimeout(async () => {
          if (global.animeQuizSession.has(chatId)) {
            global.animeQuizSession.delete(chatId);
            await sock.sendMessage(chatId, {
              text: `⏰ *WAKTU HABIS!*\nSesi Anime Quiz berakhir.`
            }, {
              quoted: session.questionMsg || null
            });
          }
        }, (resultData.time_limit || DEFAULT_TIMEOUT) * 1e3);
        return true;
      }
    } catch (e) {
      console.error("[ANIME QUIZ BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Anime Quiz ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("stop")) {
        if (global.animeQuizSession.has(chatId)) {
          const session = global.animeQuizSession.get(chatId);
          clearTimeout(session.timer);
          global.animeQuizSession.delete(chatId);
          return await sock.sendMessage(chatId, {
            text: `🏳️ *ANIME QUIZ DIHENTIKAN!*\nPermainan telah dihentikan atas permintaan pemain.`
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Anime Quiz yang sedang aktif di grup ini.");
      }
      if (global.animeQuizSession.has(chatId)) {
        const session = global.animeQuizSession.get(chatId);
        return await sendAnimeQuizMessage(sock, ctx, chatId, session, session.questionMsg || quotedMsg, prefix);
      }
      await ctx.react("⏳");
      const initialData = await callAnimeQuizApi();
      if (!initialData?.quiz?.choices || !initialData.quiz?.image) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat data Anime Quiz dari server. Silakan coba beberapa saat lagi.");
      }
      const sessionObj = {
        apiSession: initialData.session,
        data: initialData,
        msgIds: new Set(),
        timer: null,
        startTime: Date.now()
      };
      sessionObj.timer = setTimeout(async () => {
        if (global.animeQuizSession.has(chatId)) {
          global.animeQuizSession.delete(chatId);
          await sock.sendMessage(chatId, {
            text: `⏰ *WAKTU HABIS!*\nSesi Anime Quiz telah berakhir karena tidak ada jawaban.`
          }, {
            quoted: sessionObj.questionMsg || null
          });
        }
      }, (initialData.time_limit || DEFAULT_TIMEOUT) * 1e3);
      global.animeQuizSession.set(chatId, sessionObj);
      await sendAnimeQuizMessage(sock, ctx, chatId, sessionObj, quotedMsg, prefix);
      await ctx.react("🎌");
    } catch (error) {
      console.error("[Anime Quiz Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Anime Quiz Error: ${errMsg}`);
    }
  }
};