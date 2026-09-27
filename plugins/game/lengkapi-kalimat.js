import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.lengkapiKalimatSession = global.lengkapiKalimatSession || new Map();
const API_URL = "https://www.wudysoft.my.id/api/game/lengkapi-kalimat";

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}

function generateClue(answer) {
  const chars = answer.trim().split("");
  return chars.map((c, i) => {
    if (c === " ") return "   ";
    if (i === 0 || i === chars.length - 1) return `*${c.toUpperCase()}*`;
    return "•";
  }).join(" ");
}
async function sendLengkapiKalimatMessage(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${botName} • Reply pesan ini untuk melengkapi`;
  const buttons = [{
    name: "quick_reply",
    display_text: "💡 Bantuan Clue",
    id: `${prefix}lengkapi --clue`
  }, {
    name: "quick_reply",
    display_text: "🏳️ Menyerah",
    id: `${prefix}lengkapi --nyerah`
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Lengkapi Kalimat`,
        button_title: "Menu Bantuan"
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
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Lengkapi Kalimat sendCta Error]:", e.message);
    }
  }
  if (!sentMsg) {
    try {
      const nativeButtons = buttons.map(b => ({
        name: b.name || "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: b.display_text,
          id: b.id
        })
      }));
      sentMsg = await sock.sendMessage(chatId, {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: {
                text: textContent
              },
              footer: {
                text: footerText
              },
              nativeFlowMessage: {
                buttons: nativeButtons
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
      text: `${textContent}\n\n_${footerText}_`
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
  name: "lengkapikalimat",
  aliases: ["lengkapi", "lengkap", "tebakkalimat", "peribahasa"],
  description: "Game melengkapi kalimat rumpang dan peribahasa Indonesia dengan hadiah DB",
  category: "Game",
  limit: true,
  example: "lengkapikalimat",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.lengkapiKalimatSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.lengkapiKalimatSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || session.msgIds && session.msgIds.has(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      const cleanAnswer = normalizeText(session.jawaban);
      if (!cleanUser) return;
      if (cleanUser === cleanAnswer) {
        clearTimeout(session.timer);
        global.lengkapiKalimatSession.delete(chatId);
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
        if (senderJid) {
          if (typeof db?.ensureUser === "function") {
            db.ensureUser(senderJid, senderName);
          }
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 3500;
            global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 100;
            if (typeof db?.write === "function") db.write(global.db);
          }
        }
        const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
        let winText = `🎉 *TEBAKAN BENAR!* 🎉\n\n`;
        winText += `👤 *Pemenang:* @${senderJid.split("@")[0]}\n`;
        winText += `📖 *Kalimat Lengkap:*\n"${completedSentence}"\n\n`;
        winText += `💡 *Kata:* *${session.jawaban.toUpperCase()}*\n`;
        winText += `✨ *Hadiah:* +Rp 3.500 Money & +100 EXP!`;
        if (typeof ctx?.react === "function") await ctx.react("🎉");
        await sock.sendMessage(chatId, {
          text: winText,
          mentions: [senderJid]
        }, {
          quoted: msg
        });
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *SALAH!* "${userText}" tidak tepat untuk melengkapi kalimat tersebut. Coba kata lain!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[LENGKAPI KALIMAT BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Lengkapi Kalimat ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.lengkapiKalimatSession.has(chatId)) {
          const session = global.lengkapiKalimatSession.get(chatId);
          clearTimeout(session.timer);
          global.lengkapiKalimatSession.delete(chatId);
          const completedSentence = session.pertanyaan.replace(/_{2,}/g, `*${session.jawaban.toUpperCase()}*`);
          let surrenderText = `🏳️ *PERMAINAN BERAKHIR (MENYERAH)* 🏳️\n\n`;
          surrenderText += `📖 *Kalimat yang Benar:*\n"${completedSentence}"\n\n`;
          surrenderText += `💡 *Kata yang Hilang:* *${session.jawaban.toUpperCase()}*`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Lengkapi Kalimat yang sedang aktif di grup ini.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.lengkapiKalimatSession.has(chatId)) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik \`${prefix}lengkapikalimat\``);
        }
        const session = global.lengkapiKalimatSession.get(chatId);
        const clueText = generateClue(session.jawaban);
        let clueMsg = `💡 *BANTUAN CLUE LENGKAPI KALIMAT*\n\n`;
        clueMsg += `📖 *Kalimat:* "${session.pertanyaan}"\n`;
        clueMsg += `🔍 *Huruf:* [ ${clueText} ] (${session.jawaban.length} Karakter)\n\n`;
        clueMsg += `👉 *Balas/reply pesan ini untuk menjawab!*`;
        return await sendLengkapiKalimatMessage(sock, ctx, chatId, session, clueMsg, session.questionMsg || quotedMsg, prefix);
      }
      if (global.lengkapiKalimatSession.has(chatId)) {
        const session = global.lengkapiKalimatSession.get(chatId);
        const clueText = generateClue(session.jawaban);
        let activeMsg = `⚠️ *Masih ada permainan Lengkapi Kalimat yang aktif!*\n\n`;
        activeMsg += `📖 *Kalimat:* "${session.pertanyaan}"\n`;
        activeMsg += `🔍 *Clue:* [ ${clueText} ] (${session.jawaban.length} Karakter)\n\n`;
        activeMsg += `👉 *Reply (balas) pesan ini untuk melengkapi kata!*`;
        return await sendLengkapiKalimatMessage(sock, ctx, chatId, session, activeMsg, session.questionMsg || quotedMsg, prefix);
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
      if (!data || !data.pertanyaan || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Lengkapi Kalimat dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      const timer = setTimeout(async () => {
        if (global.lengkapiKalimatSession.has(chatId)) {
          const activeSession = global.lengkapiKalimatSession.get(chatId);
          global.lengkapiKalimatSession.delete(chatId);
          const completed = activeSession.pertanyaan.replace(/_{2,}/g, `*${activeSession.jawaban.toUpperCase()}*`);
          let timeoutText = `⏰ *WAKTU MENJAWAB TELAH HABIS!*\n\n`;
          timeoutText += `📖 *Kalimat yang Benar:*\n"${completed}"\n\n`;
          timeoutText += `💡 *Jawaban:* *${activeSession.jawaban.toUpperCase()}*`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          }, {
            quoted: activeSession.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const sessionObj = {
        pertanyaan: String(data.pertanyaan).trim(),
        jawaban: String(data.jawaban).trim(),
        msgIds: new Set(),
        timer: timer,
        startTime: Date.now()
      };
      global.lengkapiKalimatSession.set(chatId, sessionObj);
      const clueText = generateClue(sessionObj.jawaban);
      let questionMsg = `📖 *KUIS LENGKAPI KALIMAT* 📖\n\n`;
      questionMsg += `Lengkapilah bagian rumpang pada kalimat/peribahasa berikut:\n\n`;
      questionMsg += `💬 *"${sessionObj.pertanyaan}"*\n\n`;
      questionMsg += `🔍 *Clue Kata:* [ ${clueText} ] (${sessionObj.jawaban.length} Karakter)\n`;
      questionMsg += `⏳ *Waktu:* 120 Detik\n`;
      questionMsg += `🎁 *Reward:* +Rp 3.500 Money & +100 EXP\n\n`;
      questionMsg += `👉 *Reply (balas) pesan ini dengan kata yang tepat!*`;
      await sendLengkapiKalimatMessage(sock, ctx, chatId, sessionObj, questionMsg, quotedMsg, prefix);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Lengkapi Kalimat Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Lengkapi Kalimat Error: ${errMsg}`);
    }
  }
};