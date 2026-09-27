import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.caklontongSession = global.caklontongSession || new Map();
const API_URL = "https://www.wudysoft.my.id/api/game/cak-lontong";

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
async function sendCaklontongMessage(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${botName} • Reply pesan ini untuk menjawab`;
  const buttons = [{
    name: "quick_reply",
    display_text: "💡 Bantuan Clue",
    id: `${prefix}caklontong --clue`
  }, {
    name: "quick_reply",
    display_text: "🏳️ Menyerah",
    id: `${prefix}caklontong --nyerah`
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Kuis Cak Lontong`,
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
      console.error("[Cak Lontong sendCta Error]:", e.message);
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
  name: "caklontong",
  aliases: ["caklon", "lontong"],
  description: "Game teka-teki logika nyeleneh ala Cak Lontong dengan hadiah DB",
  category: "Game",
  limit: true,
  example: "caklontong",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.caklontongSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.caklontongSession.get(chatId);
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
        global.caklontongSession.delete(chatId);
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain Cerdas";
        if (senderJid) {
          if (typeof db?.ensureUser === "function") {
            db.ensureUser(senderJid, senderName);
          }
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + 4e3;
            global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + 120;
            if (typeof db?.write === "function") db.write(global.db);
          }
        }
        let winText = `🎉 *TEBAKAN BENAR!* 🎉\n\n`;
        winText += `👤 *Pemenang:* @${senderJid.split("@")[0]}\n`;
        winText += `❓ *Soal:* ${session.soal}\n`;
        winText += `💡 *Jawaban:* *${session.jawaban.toUpperCase()}*\n\n`;
        winText += `📝 *Alasan Cak Lontong:*\n_"${session.deskripsi}"_\n\n`;
        winText += `✨ *Hadiah:* +Rp 4.000 Money & +120 EXP!`;
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
          text: `❌ *SALAH!* Bukan "${userText}". Coba gunakan logika nyeleneh Cak Lontong!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[CAK LONTONG BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Kuis Cak Lontong ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("end") || rawText.includes("batal")) {
        if (global.caklontongSession.has(chatId)) {
          const session = global.caklontongSession.get(chatId);
          clearTimeout(session.timer);
          global.caklontongSession.delete(chatId);
          let surrenderText = `🏳️ *KAMU MENYERAH!* 🏳️\n\n`;
          surrenderText += `❓ *Soal:* ${session.soal}\n`;
          surrenderText += `💡 *Jawaban:* *${session.jawaban.toUpperCase()}*\n\n`;
          surrenderText += `📝 *Alasan Cak Lontong:*\n_"${session.deskripsi}"_`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi kuis Cak Lontong yang sedang aktif.");
      }
      if (rawText.includes("clue") || rawText.includes("bantuan") || rawText.includes("hint")) {
        if (!global.caklontongSession.has(chatId)) {
          return ctx.reply(`❌ Tidak ada game aktif. Mulai game baru dengan mengetik \`${prefix}caklontong\``);
        }
        const session = global.caklontongSession.get(chatId);
        const clueText = generateClue(session.jawaban);
        let clueMsg = `💡 *BANTUAN CLUE CAK LONTONG*\n\n`;
        clueMsg += `❓ *Soal:* ${session.soal}\n`;
        clueMsg += `🔍 *Kisi-kisi:* [ ${clueText} ] (${session.jawaban.length} Karakter)\n\n`;
        clueMsg += `👉 *Balas/reply pesan ini untuk menebak!*`;
        return await sendCaklontongMessage(sock, ctx, chatId, session, clueMsg, session.questionMsg || quotedMsg, prefix);
      }
      if (global.caklontongSession.has(chatId)) {
        const session = global.caklontongSession.get(chatId);
        const clueText = generateClue(session.jawaban);
        let activeMsg = `⚠️ *Masih ada pertanyaan Cak Lontong yang belum tertebak!*\n\n`;
        activeMsg += `❓ *Soal:* ${session.soal}\n`;
        activeMsg += `🔍 *Clue:* [ ${clueText} ] (${session.jawaban.length} Karakter)\n\n`;
        activeMsg += `👉 *Reply (balas) pesan ini untuk menjawab!*`;
        return await sendCaklontongMessage(sock, ctx, chatId, session, activeMsg, session.questionMsg || quotedMsg, prefix);
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
      if (!data || !data.soal || !data.jawaban) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat kuis Cak Lontong dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 120;
      const timer = setTimeout(async () => {
        if (global.caklontongSession.has(chatId)) {
          const activeSession = global.caklontongSession.get(chatId);
          global.caklontongSession.delete(chatId);
          let timeoutText = `⏰ *WAKTU MENJAWAB TELAH HABIS!*\n\n`;
          timeoutText += `❓ *Soal:* ${activeSession.soal}\n`;
          timeoutText += `💡 *Jawaban:* *${activeSession.jawaban.toUpperCase()}*\n\n`;
          timeoutText += `📝 *Alasan Cak Lontong:*\n_"${activeSession.deskripsi}"_`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          }, {
            quoted: activeSession.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const sessionObj = {
        index: data.index,
        soal: data.soal,
        jawaban: String(data.jawaban).trim(),
        deskripsi: data.deskripsi || "Tidak ada alasan.",
        msgIds: new Set(),
        timer: timer,
        startTime: Date.now()
      };
      global.caklontongSession.set(chatId, sessionObj);
      const clueText = generateClue(sessionObj.jawaban);
      let questionMsg = `🥸 *KUIS CAK LONTONG (TEKA-TEKI SULIT)* 🥸\n\n`;
      questionMsg += `❓ *Pertanyaan:*\n*${sessionObj.soal}*\n\n`;
      questionMsg += `🔍 *Clue:* [ ${clueText} ] (${sessionObj.jawaban.length} Karakter)\n`;
      questionMsg += `⏳ *Waktu:* 120 Detik\n`;
      questionMsg += `🎁 *Reward:* +Rp 4.000 Money & +120 EXP\n\n`;
      questionMsg += `👉 *Reply (balas) pesan ini untuk menjawab!*`;
      await sendCaklontongMessage(sock, ctx, chatId, sessionObj, questionMsg, quotedMsg, prefix);
      await ctx.react("🤔");
    } catch (error) {
      console.error("[Cak Lontong Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Cak Lontong Error: ${errMsg}`);
    }
  }
};