import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.deckSession = global.deckSession || new Map();
const API_URL = "https://wudysoft.my.id/api/game/deck";
const SUIT_EMOJIS = {
  SPADES: "♠️",
  HEARTS: "♥️",
  DIAMONDS: "♦️",
  CLUBS: "♣️"
};

function formatCard(card) {
  if (!card) return "[ 🎴 ?? ]";
  const suit = SUIT_EMOJIS[card.suit] || card.suit;
  const val = card.value === "10" ? "10" : card.value[0];
  return `[ ${suit} ${val} ]`;
}
async function requestDeck(payload) {
  try {
    const res = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 3e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      error: err.message || "Network Error"
    };
  }
}
async function sendBlackjackTable(sock, ctx, chatId, session, gameData, textCaption, quotedMsg) {
  const isGameOver = gameData.status !== "active" && gameData.status !== "cleared";
  const prefix = ctx?.prefix || ".";
  const buttons = [];
  if (!isGameOver) {
    buttons.push({
      display_text: "🃏 Tambah Kartu (Hit)",
      id: `${prefix}deck hit`
    }, {
      display_text: "🛑 Tahan (Stand)",
      id: `${prefix}deck stand`
    });
  } else {
    buttons.push({
      display_text: "🔄 Main Lagi (New Game)",
      id: `${prefix}deck`
    });
  }
  const footerText = `${global.bot?.name || "Bot"} • Blackjack 21 Casino Game`;
  const lastPlayerCard = gameData.playerHand?.[gameData.playerHand.length - 1]?.image;
  if (typeof ctx?.sendCta === "function") {
    await ctx.sendCta(textCaption, footerText, buttons, {
      title: "乂 BLACKJACK 21 TABLE 乂",
      subtitle: `Status: ${gameData.status?.toUpperCase() || "PLAYING"}`,
      media: lastPlayerCard,
      quoted: quotedMsg
    });
  } else {
    await sock.sendMessage(chatId, {
      text: textCaption
    }, {
      quoted: quotedMsg
    });
  }
}
export default {
  name: "deck",
  aliases: ["blackjack", "bj21", "kartu21", "mainkartu"],
  description: "Game kartu Blackjack 21 melawan Dealer AI Full CTA Buttons",
  category: "Game",
  limit: true,
  example: "deck atau deck hit atau deck stand",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      const senderJid = ctx?.sender;
      if (!chatId || !senderJid) return;
      const sessionKey = `${chatId}_${senderJid}`;
      if (!global.deckSession.has(sessionKey)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.deckSession.get(sessionKey);
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text || text.startsWith(`${ctx?.prefix || "."}deck`)) return;
      if (["hit", "tarik", "tambah", "ambil", "h"].includes(text)) {
        const data = await requestDeck({
          action: "hit",
          gameId: session.gameId
        });
        if (data.error) {
          global.deckSession.delete(sessionKey);
          await ctx.reply(`⚠️ ${data.error}`);
          return true;
        }
        const playerCards = (data.playerHand || []).map(formatCard).join(" ");
        if (data.status === "player_bust") {
          global.deckSession.delete(sessionKey);
          const bustCaption = `💥 *PLAYER BUST! (MELEBIHI 21)* 💥\n\n` + `╭───『 *HASIL KARTU* 』\n` + `│ 👤 *Kartu Kamu:* ${playerCards} (Skor: *${data.playerScore}*)\n` + `│ 🤖 *Kartu Dealer:* ${formatCard(data.dealerVisibleCard)} [ 🎴 ?? ]\n` + `╰──────────────────\n\n` + `❌ *Kamu kalah karena skor melebihi batas 21!*`;
          await sendBlackjackTable(sock, ctx, chatId, session, data, bustCaption, msg);
          return true;
        }
        const hitCaption = `🃏 *PLAYER HITS (TAMBAH KARTU)*\n\n` + `╭───『 *MEJA BLACKJACK* 』\n` + `│ 👤 *Kartu Kamu:* ${playerCards} (Skor: *${data.playerScore}*)\n` + `│ 🤖 *Dealer:* ${formatCard(data.dealerVisibleCard)} [ 🎴 ?? ]\n` + `╰──────────────────\n\n` + `👉 Klik tombol di bawah untuk menambah kartu atau bertahan!`;
        await sendBlackjackTable(sock, ctx, chatId, session, data, hitCaption, msg);
        return true;
      }
      if (["stand", "tahan", "pas", "cukup", "s"].includes(text)) {
        const data = await requestDeck({
          action: "stand",
          gameId: session.gameId
        });
        global.deckSession.delete(sessionKey);
        if (data.error) {
          await ctx.reply(`⚠️ ${data.error}`);
          return true;
        }
        const playerCards = (data.playerHand || []).map(formatCard).join(" ");
        const dealerCards = (data.dealerHand || []).map(formatCard).join(" ");
        let resultEmoji = "🤝";
        let resultTitle = "PERMAINAN SERI (PUSH)!";
        if (data.status === "player_win" || data.status === "dealer_bust") {
          resultEmoji = "🏆";
          resultTitle = "SELAMAT! KAMU MENANG!";
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 300;
            if (typeof db?.write === "function") db.write(global.db);
          }
        } else if (data.status === "dealer_win") {
          resultEmoji = "💀";
          resultTitle = "DEALER MENANG!";
        }
        const standCaption = `${resultEmoji} *${resultTitle}* ${resultEmoji}\n\n` + `╭───『 *REKAP HASIL MEJA* 』\n` + `│ 👤 *Kartu Kamu:* ${playerCards} ➔ Skor: *${data.playerScore}*\n` + `│ 🤖 *Kartu Dealer:* ${dealerCards} ➔ Skor: *${data.dealerScore}*\n` + `╰──────────────────\n\n` + `📝 *Pesan Dealer:* _${data.message || "-"}_`;
        await sendBlackjackTable(sock, ctx, chatId, session, data, standCaption, msg);
        return true;
      }
    } catch (e) {
      console.error("[BLACKJACK BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      const sessionKey = `${chatId}_${senderJid}`;
      if (rawText.includes("end") || rawText.includes("batal")) {
        if (global.deckSession.has(sessionKey)) {
          const session = global.deckSession.get(sessionKey);
          global.deckSession.delete(sessionKey);
          await requestDeck({
            action: "delete",
            gameId: session.gameId
          });
          return ctx.reply("🚪 *Permainan Blackjack berhasil dibatalkan.*");
        }
        return ctx.reply("❌ Tidak ada sesi Blackjack aktif.");
      }
      if (rawText.includes("hit")) {
        if (!global.deckSession.has(sessionKey)) return ctx.reply(`❌ Mulai dulu dengan \`${prefix}deck\``);
        const session = global.deckSession.get(sessionKey);
        const data = await requestDeck({
          action: "hit",
          gameId: session.gameId
        });
        if (data.error) {
          global.deckSession.delete(sessionKey);
          return ctx.reply(`⚠️ ${data.error}`);
        }
        const playerCards = (data.playerHand || []).map(formatCard).join(" ");
        if (data.status === "player_bust") {
          global.deckSession.delete(sessionKey);
          return await sendBlackjackTable(sock, ctx, chatId, session, data, `💥 *PLAYER BUST (LEBIH DARI 21)!*\n\n👤 *Kartu Kamu:* ${playerCards} (Skor: *${data.playerScore}*)\n❌ Kamu kalah!`, quotedMsg);
        }
        return await sendBlackjackTable(sock, ctx, chatId, session, data, `🃏 *PLAYER HITS*\n\n👤 *Kartu Kamu:* ${playerCards} (Skor: *${data.playerScore}*)\n🤖 *Dealer:* ${formatCard(data.dealerVisibleCard)} [ 🎴 ?? ]`, quotedMsg);
      }
      if (rawText.includes("stand")) {
        if (!global.deckSession.has(sessionKey)) return ctx.reply(`❌ Mulai dulu dengan \`${prefix}deck\``);
        const session = global.deckSession.get(sessionKey);
        const data = await requestDeck({
          action: "stand",
          gameId: session.gameId
        });
        global.deckSession.delete(sessionKey);
        const playerCards = (data.playerHand || []).map(formatCard).join(" ");
        const dealerCards = (data.dealerHand || []).map(formatCard).join(" ");
        return await sendBlackjackTable(sock, ctx, chatId, session, data, `🏁 *HASIL BLACKJACK 21*\n\n👤 *Kartu Kamu:* ${playerCards} (Skor: *${data.playerScore}*)\n🤖 *Kartu Dealer:* ${dealerCards} (Skor: *${data.dealerScore}*)\n\n🏆 *Pemenang:* *${data.winner || data.status}*`, quotedMsg);
      }
      if (global.deckSession.has(sessionKey)) {
        return ctx.reply(`⚠️ Selesaikan dulu mejamu yang aktif dengan mengklik tombol Hit / Stand!`);
      }
      await ctx.react("⏳");
      const data = await requestDeck({
        action: "create"
      });
      if (!data?.gameId) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat meja kartu dari server.");
      }
      const newSession = {
        gameId: data.gameId,
        startTime: Date.now()
      };
      global.deckSession.set(sessionKey, newSession);
      const playerCards = (data.playerHand || []).map(formatCard).join(" ");
      const dealerVisible = formatCard(data.dealerVisibleCard);
      if (data.playerScore === 21) {
        const standData = await requestDeck({
          action: "stand",
          gameId: data.gameId
        });
        global.deckSession.delete(sessionKey);
        if (global.db?.user?.[senderJid]) {
          global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 300;
          if (typeof db?.write === "function") db.write(global.db);
        }
        return await sendBlackjackTable(sock, ctx, chatId, newSession, standData, `🔥 *BLACKJACK ALAMI (SKOR 21)!* 🔥\n\n👤 *Kartu Kamu:* ${playerCards} ➔ Skor: *21*\n🤖 *Kartu Dealer:* ${(standData.dealerHand || []).map(formatCard).join(" ")} ➔ Skor: *${standData.dealerScore}*\n\n🏆 *Pemenang:* *${standData.winner || "Player wins!"}* (+300 EXP)`, quotedMsg);
      }
      const startCaption = `🎰 *MEJA BLACKJACK 21 DIBUKA!*\n\n` + `╭───『 *KARTU TANGAN* 』\n` + `│ 👤 *Kartu Kamu:* ${playerCards}\n` + `│ 📊 *Skor Kamu:* *${data.playerScore}*\n` + `│ 🤖 *Kartu Dealer:* ${dealerVisible} [ 🎴 ?? ]\n` + `│ 👁️ *Nilai Terbuka:* ${data.dealerVisibleCardValue}\n` + `╰──────────────────\n\n` + `👉 Klik tombol **Hit** untuk tambah kartu atau **Stand** untuk bertahan!`;
      await sendBlackjackTable(sock, ctx, chatId, newSession, data, startCaption, quotedMsg);
      await ctx.react("🃏");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Deck Error: ${error.message}`);
    }
  }
};