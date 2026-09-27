import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.family100Session = global.family100Session || new Map();
const API_URL = "https://wudysoft.my.id/api/game/family100";

function normalizeText(str) {
  return (str || "").toLowerCase().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").trim();
}

function formatFamily100Board(session) {
  let text = `👨‍👩‍👧‍👦 *SURVEI FAMILY 100*\n\n`;
  text += `❓ *Pertanyaan:*\n*${session.soal}*\n\n`;
  text += `╭───『 *PAPAN SURVEI* 』\n`;
  session.jawaban.forEach((ans, idx) => {
    const found = session.terjawab[idx];
    if (found) {
      const username = found.jid ? `@${found.jid.split("@")[0]}` : found.name;
      text += `│ (${idx + 1}) *${ans.toUpperCase()}* ➔ ${username} ✅\n`;
    } else {
      const hidden = ans.replace(/[a-zA-Z0-9]/g, "• ");
      text += `│ (${idx + 1}) [ ${hidden.trim()} ]\n`;
    }
  });
  const totalFound = session.terjawab.filter(Boolean).length;
  text += `╰──────────────────\n\n`;
  text += `📊 *Progres:* ${totalFound}/${session.jawaban.length} Jawaban Tertebak\n`;
  text += `👉 *Reply (balas) pesan ini dengan tebakanmu!*`;
  return text;
}
async function sendFamily100Message(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${botName} • Reply pesan ini untuk menjawab`;
  const mentions = [...new Set((session.terjawab || []).filter(Boolean).map(t => t.jid).filter(Boolean))];
  const buttons = [{
    name: "quick_reply",
    display_text: "📋 Lihat Papan",
    id: `${prefix}family100 --papan`
  }, {
    name: "quick_reply",
    display_text: "🏳️ Menyerah",
    id: `${prefix}family100 --nyerah`
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Family 100`,
        button_title: "Menu Kuis"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: mentions
    },
    quoted: quotedMsg || undefined
  };
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    try {
      sentMsg = await ctx.sendCta(textContent, footerText, buttons, options);
    } catch (e) {
      console.error("[Family 100 sendCta Error]:", e.message);
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
      text: `${textContent}\n\n_${footerText}_`,
      mentions: mentions
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
  name: "family100",
  aliases: ["f100", "fam100", "survey100"],
  description: "Game survei Family 100 dengan papan tebakan multi-jawaban via API",
  category: "Game",
  limit: true,
  example: "family100",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.family100Session.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.family100Session.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || session.msgIds && session.msgIds.has(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanUser = normalizeText(userText);
      if (!cleanUser) return;
      const alreadyAnswered = session.jawaban.findIndex((ans, idx) => {
        return session.terjawab[idx] && normalizeText(ans) === cleanUser;
      });
      if (alreadyAnswered !== -1) {
        const answerer = session.terjawab[alreadyAnswered];
        if (typeof ctx?.react === "function") await ctx.react("⚠️");
        await sock.sendMessage(chatId, {
          text: `⚠️ Jawaban *"${session.jawaban[alreadyAnswered].toUpperCase()}"* sudah pernah ditebak oleh @${answerer.jid.split("@")[0]}!`,
          mentions: [answerer.jid]
        }, {
          quoted: msg
        });
        return true;
      }
      const answerIndex = session.jawaban.findIndex((ans, idx) => {
        if (session.terjawab[idx]) return false;
        const cleanAns = normalizeText(ans);
        return cleanAns === cleanUser || cleanAns.includes(cleanUser) && cleanUser.length >= 3;
      });
      if (answerIndex !== -1) {
        const matchedAnswer = session.jawaban[answerIndex];
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain";
        const senderJid = ctx?.sender || msg?.key?.participant;
        session.terjawab[answerIndex] = {
          jawaban: matchedAnswer,
          jid: senderJid,
          name: senderName
        };
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
        const totalFound = session.terjawab.filter(Boolean).length;
        const isAllFound = totalFound === session.jawaban.length;
        if (isAllFound) {
          clearTimeout(session.timer);
          global.family100Session.delete(chatId);
          const finalBoard = formatFamily100Board(session);
          const winText = `🎉 *LUAR BIASA! SEMUA JAWABAN TERTEBAK!* 🎉\n\n` + finalBoard + `\n\n🏆 *Permainan Family 100 Selesai! Selamat kepada semua penebak.*`;
          const allWinners = session.terjawab.filter(Boolean).map(t => t.jid);
          if (typeof ctx?.react === "function") await ctx.react("🎉");
          await sock.sendMessage(chatId, {
            text: winText,
            mentions: allWinners
          }, {
            quoted: msg
          });
          return true;
        }
        const updatedBoard = formatFamily100Board(session);
        const correctInfo = `✨ *TEBAKAN BENAR!*\n` + `Jawaban *[${matchedAnswer.toUpperCase()}]* berhasil ditebak oleh @${senderJid.split("@")[0]}! (+Rp 3.000 & +150 EXP)\n\n` + updatedBoard;
        if (typeof ctx?.react === "function") await ctx.react("✅");
        await sendFamily100Message(sock, ctx, chatId, session, correctInfo, msg, ctx?.prefix || ".");
        return true;
      } else {
        if (typeof ctx?.react === "function") await ctx.react("❌");
        await sock.sendMessage(chatId, {
          text: `❌ *Jawaban Salah!*\n"${userText}" tidak ada dalam survei ini. Coba tebak kata lainnya!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[FAMILY 100 BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Family 100 ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.family100Session.has(chatId)) {
          const session = global.family100Session.get(chatId);
          clearTimeout(session.timer);
          global.family100Session.delete(chatId);
          let revealText = `🏳️ *PERMAINAN FAMILY 100 BERAKHIR (MENYERAH)*\n\n` + `❓ *Pertanyaan:*\n*${session.soal}*\n\n` + `╭───『 *KUNCI JAWABAN LENGKAP* 』\n`;
          const mentions = [];
          session.jawaban.forEach((ans, idx) => {
            const found = session.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              revealText += `│ (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              revealText += `│ (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          revealText += `╰──────────────────`;
          return await sock.sendMessage(chatId, {
            text: revealText,
            mentions: mentions
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Family 100 yang sedang aktif di grup ini.");
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.family100Session.has(chatId)) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik \`${prefix}family100\``);
        }
        const session = global.family100Session.get(chatId);
        const boardText = formatFamily100Board(session);
        return await sendFamily100Message(sock, ctx, chatId, session, boardText, session.questionMsg || quotedMsg, prefix);
      }
      if (global.family100Session.has(chatId)) {
        const session = global.family100Session.get(chatId);
        const boardText = formatFamily100Board(session);
        return await sendFamily100Message(sock, ctx, chatId, session, `⚠️ *Masih ada permainan Family 100 yang aktif di grup ini!*\n\n` + boardText, session.questionMsg || quotedMsg, prefix);
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
      if (!data || !data.soal || !Array.isArray(data.jawaban) || data.jawaban.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Family 100 dari server. Silakan coba beberapa saat lagi.");
      }
      const TIMEOUT_SECONDS = 180;
      const timer = setTimeout(async () => {
        if (global.family100Session.has(chatId)) {
          const activeSession = global.family100Session.get(chatId);
          global.family100Session.delete(chatId);
          let timeoutText = `⏰ *WAKTU FAMILY 100 TELAH HABIS!*\n\n` + `❓ *Pertanyaan:*\n*${activeSession.soal}*\n\n` + `╭───『 *KUNCI JAWABAN LENGKAP* 』\n`;
          const mentions = [];
          activeSession.jawaban.forEach((ans, idx) => {
            const found = activeSession.terjawab[idx];
            if (found) {
              mentions.push(found.jid);
              timeoutText += `│ (${idx + 1}) *${ans.toUpperCase()}* ➔ @${found.jid.split("@")[0]}\n`;
            } else {
              timeoutText += `│ (${idx + 1}) *${ans.toUpperCase()}* ❌\n`;
            }
          });
          timeoutText += `╰──────────────────`;
          await sock.sendMessage(chatId, {
            text: timeoutText,
            mentions: mentions
          }, {
            quoted: activeSession.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const sessionObj = {
        soal: data.soal,
        jawaban: data.jawaban.map(j => String(j).trim()),
        terjawab: new Array(data.jawaban.length).fill(null),
        msgIds: new Set(),
        timer: timer,
        startTime: Date.now()
      };
      global.family100Session.set(chatId, sessionObj);
      const initialBoard = formatFamily100Board(sessionObj);
      await sendFamily100Message(sock, ctx, chatId, sessionObj, initialBoard, quotedMsg, prefix);
      await ctx.react("👨‍👩‍👧‍👦");
    } catch (error) {
      console.error("[Family 100 Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Family 100 Error: ${errMsg}`);
    }
  }
};