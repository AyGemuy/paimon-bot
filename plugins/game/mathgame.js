import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.mathGameSession = global.mathGameSession || new Map();
const BASE_API_URL = "https://www.wudysoft.my.id/api/game/math";
const VALID_LEVELS = ["noob", "easy", "medium", "hard", "extreme", "impossible", "impossible2"];
async function sendMathGameMessage(sock, ctx, chatId, session, textContent, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const footerText = `${botName} • Reply pesan ini untuk menjawab`;
  const buttons = [{
    name: "quick_reply",
    display_text: "🏳️ Menyerah",
    id: `${prefix}mathgame --nyerah`
  }, {
    name: "quick_reply",
    display_text: "📋 Pilihan Level",
    id: `${prefix}mathgame --list`
  }];
  const options = {
    jid: chatId,
    to: chatId,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 2,
        divider_indices: [1],
        list_title: `${botName} • Math Game Arena`,
        button_title: "Menu Kuis"
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
      console.error("[MathGame sendCta Error]:", e.message);
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
  name: "mathgame",
  aliases: ["gamemath", "kuismath", "kuismtk"],
  description: "Game asah otak matematika cepat dengan API berbagai level & hadiah DB",
  category: "Game",
  limit: true,
  example: "mathgame medium / mathgame extreme",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.mathGameSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.mathGameSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const isQuotingGame = quotedStanzaId && (quotedStanzaId === session.questionMsgId || session.msgIds && session.msgIds.has(quotedStanzaId));
      if (!isQuotingGame) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim();
      const prefixList = [".", "#", "!", "/", ctx?.prefix].filter(Boolean);
      if (prefixList.some(p => userText.startsWith(p))) return;
      const cleanInput = userText.replace(/,/g, ".").trim();
      const userNumber = Number(cleanInput);
      if (isNaN(userNumber)) return;
      const isCorrect = Math.abs(userNumber - Number(session.result)) < .01;
      if (isCorrect) {
        clearTimeout(session.timer);
        global.mathGameSession.delete(chatId);
        const senderJid = ctx?.sender || msg?.key?.participant;
        const senderName = ctx?.pushName || ctx?.pushname || "Pemain Jenius";
        const rewardMoney = Math.max(3e3, Number(session.bonus) * 15);
        const rewardExp = Math.max(40, Math.floor(rewardMoney / 100));
        if (senderJid) {
          if (typeof db?.ensureUser === "function") {
            db.ensureUser(senderJid, senderName);
          }
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].money = (Number(global.db.user[senderJid].money) || 0) + rewardMoney;
            global.db.user[senderJid].exp = (Number(global.db.user[senderJid].exp) || 0) + rewardExp;
            if (typeof db?.write === "function") db.write(global.db);
          }
        }
        let winText = `🎉 *HASIL PERHITUNGAN TEPAT!* 🎉\n\n`;
        winText += `👤 *Pemenang:* @${senderJid.split("@")[0]}\n`;
        winText += `🧮 *Soal:* *${session.str}* = *${session.result}*\n`;
        winText += `📊 *Tingkat:* ${session.mode.toUpperCase()}\n\n`;
        winText += `✨ *Hadiah:* +Rp ${rewardMoney.toLocaleString()} Money & +${rewardExp} EXP!`;
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
          text: `❌ *SALAH!* Hasil "${userText}" tidak tepat. Ayo hitung kembali!`
        }, {
          quoted: msg
        });
        return true;
      }
    } catch (e) {
      console.error("[MATH GAME BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      if (!isGroup) {
        return ctx.reply("❌ *Game Matematika ini hanya dapat dimainkan di dalam Grup!*");
      }
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("nyerah") || rawText.includes("surrender") || rawText.includes("batal") || rawText.includes("end")) {
        if (global.mathGameSession.has(chatId)) {
          const session = global.mathGameSession.get(chatId);
          clearTimeout(session.timer);
          global.mathGameSession.delete(chatId);
          let surrenderText = `🏳️ *PERMAINAN BERAKHIR (MENYERAH)* 🏳️\n\n`;
          surrenderText += `🧮 *Soal:* ${session.str}\n`;
          surrenderText += `💡 *Kunci Jawaban:* *${session.result}*\n`;
          surrenderText += `📊 *Tingkat:* ${session.mode.toUpperCase()}`;
          return await sock.sendMessage(chatId, {
            text: surrenderText
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi Matematika yang sedang aktif di grup ini.");
      }
      if (rawText.includes("list") || rawText.includes("level") || rawText.includes("mode")) {
        let listText = `🧮 *PILIHAN TINGKAT KESULITAN MATH GAME*\n\n`;
        listText += `Pilih mode saat memulai game:\n\n`;
        VALID_LEVELS.forEach((lvl, i) => {
          listText += `${i + 1}. \`${prefix}mathgame ${lvl}\`\n`;
        });
        listText += `\n_Contoh: \`${prefix}mathgame hard\` atau \`${prefix}mathgame extreme\`_`;
        return ctx.reply(listText);
      }
      if (global.mathGameSession.has(chatId)) {
        const session = global.mathGameSession.get(chatId);
        let activeMsg = `⚠️ *Masih ada tantangan Matematika yang sedang aktif!*\n\n`;
        activeMsg += `🧮 *Soal:* *${session.str} = ?*\n`;
        activeMsg += `📊 *Mode:* ${session.mode.toUpperCase()}\n\n`;
        activeMsg += `👉 *Reply (balas) pesan ini dengan angka jawabanmu!*`;
        return await sendMathGameMessage(sock, ctx, chatId, session, activeMsg, session.questionMsg || quotedMsg, prefix);
      }
      const chosenLevel = VALID_LEVELS.find(lvl => rawText.includes(lvl)) || "medium";
      await ctx.react("⏳");
      const requestUrl = `${BASE_API_URL}?level=${encodeURIComponent(chosenLevel)}`;
      const {
        data
      } = await axios.get(requestUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.str === undefined || data.result === undefined) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat tantangan matematika dari server. Silakan coba lagi.");
      }
      const durationMs = Number(data.time) || 3e4;
      const durationSec = Math.round(durationMs / 1e3);
      const timer = setTimeout(async () => {
        if (global.mathGameSession.has(chatId)) {
          const activeSession = global.mathGameSession.get(chatId);
          global.mathGameSession.delete(chatId);
          let timeoutText = `⏰ *WAKTU HITUNG TELAH HABIS!*\n\n`;
          timeoutText += `🧮 *Soal:* ${activeSession.str} = ?\n`;
          timeoutText += `💡 *Kunci Jawaban:* *${activeSession.result}*\n`;
          timeoutText += `📊 *Mode:* ${activeSession.mode.toUpperCase()}`;
          await sock.sendMessage(chatId, {
            text: timeoutText
          }, {
            quoted: activeSession.questionMsg || null
          });
        }
      }, durationMs);
      const sessionObj = {
        str: String(data.str).trim(),
        result: data.result,
        mode: String(data.mode || chosenLevel).trim(),
        bonus: Number(data.bonus) || 10,
        time: durationMs,
        msgIds: new Set(),
        timer: timer,
        startTime: Date.now()
      };
      global.mathGameSession.set(chatId, sessionObj);
      const rewardMoney = Math.max(3e3, sessionObj.bonus * 15);
      const rewardExp = Math.max(40, Math.floor(rewardMoney / 100));
      let questionMsg = `🧮 *TANTANGAN MATEMATIKA CEPAT* 🧮\n\n`;
      questionMsg += `Berapakah hasil dari operasi hitung berikut:\n\n`;
      questionMsg += `👉 *${sessionObj.str} = ?*\n\n`;
      questionMsg += `📊 *Mode Level:* ${sessionObj.mode.toUpperCase()}\n`;
      questionMsg += `⏳ *Batas Waktu:* ${durationSec} Detik\n`;
      questionMsg += `🎁 *Potensi Hadiah:* +Rp ${rewardMoney.toLocaleString()} & +${rewardExp} EXP\n\n`;
      questionMsg += `👉 *Reply (balas) pesan ini dengan angka jawabanmu!*`;
      await sendMathGameMessage(sock, ctx, chatId, sessionObj, questionMsg, quotedMsg, prefix);
      await ctx.react("🔢");
    } catch (error) {
      console.error("[Math Game Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Math Game Error: ${errMsg}`);
    }
  }
};