import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.chessSession = global.chessSession || new Map();
const API_URL = "https://wudysoft.my.id/api/game/chess";
const MOVE_REGEX = /^([a-h][1-8])[\s\-_/>to]*([a-h][1-8])(?:\s*([qrbn]))?$/i;
async function sendChessBoard(sock, ctx, chatId, session, textCaption, quotedMsg) {
  const isWhite = session.turn === "white";
  const currentTurnPlayer = isWhite ? session.white : session.black;
  const turnEmoji = isWhite ? "⚪ Putih" : "⚫ Hitam";
  const prefix = ctx?.prefix || ".";
  const buttons = [];
  if (session.status === "waiting") {
    buttons.push({
      display_text: "♟️ Gabung Lawan (Join)",
      id: `${prefix}catur join`
    }, {
      display_text: "🚪 Batalkan Tantangan",
      id: `${prefix}catur batal`
    });
  } else {
    buttons.push({
      display_text: "🔄 Perbarui Papan",
      id: `${prefix}catur papan`
    }, {
      display_text: "🏳️ Menyerah (Resign)",
      id: `${prefix}catur menyerah`
    });
  }
  const footerText = `${global.bot?.name || "Bot"} • Giliran: ${turnEmoji} (${currentTurnPlayer?.name || "Menunggu Lawan"})`;
  if (typeof ctx?.sendCta === "function") {
    await ctx.sendCta(textCaption, footerText, buttons, {
      title: "乂 ARENA CATUR DUA PEMAIN 乂",
      subtitle: `Giliran: ${turnEmoji}`,
      media: session.boardImageUrl,
      quoted: quotedMsg
    });
  } else {
    if (session.boardImageUrl && session.boardImageUrl.startsWith("http")) {
      await sock.sendMessage(chatId, {
        image: {
          url: session.boardImageUrl
        },
        caption: textCaption
      }, {
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
}
async function executeMove(gameId, from, to) {
  try {
    const res = await axios.post(API_URL, {
      action: "move",
      id: gameId,
      from: from.toLowerCase(),
      to: to.toLowerCase()
    }, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 3e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      message: err.message || "Network Error"
    };
  }
}
export default {
  name: "catur",
  aliases: ["chess", "maincatur", "skak"],
  description: "Game catur 2 pemain (Putih vs Hitam) dengan visual papan resmi",
  category: "Game",
  limit: true,
  example: "catur (buat room) atau catur e2 e4 (melangkah)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.chessSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.chessSession.get(chatId);
      const senderJid = ctx?.sender;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text || text.startsWith(`${ctx?.prefix || "."}catur`)) return;
      if (session.status === "waiting" && ["join", "ikut", "terima", "gas"].includes(text)) {
        if (session.white.jid === senderJid) {
          await ctx.reply("⚠️ Kamu adalah pembuat tantangan (Pion Putih)! Tunggu lawan bergabung.");
          return true;
        }
        session.black = {
          jid: senderJid,
          name: ctx?.pushname || "Pemain Hitam"
        };
        session.status = "playing";
        session.turn = "white";
        const startCaption = `🎉 *TANTANGAN CATUR DITERIMA & DIMULAI!*\n\n` + `⚪ *Putih:* ${session.white.name}\n` + `⚫ *Hitam:* ${session.black.name}\n\n` + `🎯 *Giliran Pertama:* ⚪ *${session.white.name}* (Putih)\n` + `👉 *Ketik langkah langsung di chat!* (Contoh: \`e2 e4\`)`;
        await sendChessBoard(sock, ctx, chatId, session, startCaption, msg);
        return true;
      }
      const moveMatch = text.match(MOVE_REGEX);
      if (session.status === "playing" && moveMatch) {
        const from = moveMatch[1].toLowerCase();
        const to = moveMatch[2].toLowerCase();
        const isWhiteTurn = session.turn === "white";
        const currentTurnJid = isWhiteTurn ? session.white.jid : session.black.jid;
        if (senderJid !== currentTurnJid) {
          const currentName = isWhiteTurn ? session.white.name : session.black.name;
          const turnColor = isWhiteTurn ? "⚪ Putih" : "⚫ Hitam";
          await ctx.reply(`⚠️ Sekarang giliran ${turnColor} (*${currentName}*) untuk melangkah!`);
          return true;
        }
        const data = await executeMove(session.id, from, to);
        if (!data || data.message === "Invalid move" || !data.boardImageUrl) {
          await ctx.reply(`❌ *Langkah ${from.toUpperCase()} ➔ ${to.toUpperCase()} tidak sah!* Periksa aturan catur.`);
          return true;
        }
        session.boardImageUrl = data.boardImageUrl;
        session.turn = data.currentTurn;
        const moverName = isWhiteTurn ? session.white.name : session.black.name;
        const nextPlayer = session.turn === "white" ? session.white : session.black;
        const nextColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        if (data.isCheckmate) {
          global.chessSession.delete(chatId);
          await axios.post(API_URL, {
            action: "delete",
            id: session.id
          }).catch(() => {});
          if (global.db?.user?.[senderJid]) {
            global.db.user[senderJid].exp = (global.db.user[senderJid].exp || 0) + 500;
            if (typeof db?.write === "function") db.write(global.db);
          }
          if (typeof ctx?.sendCta === "function") {
            await ctx.sendCta(`🏆 *SKAKMAT (CHECKMATE)!*\n\nSelamat kepada *${moverName}* yang memenangkan pertandingan! (+500 EXP) 🎉`, "Permainan Selesai", [{
              display_text: "🎮 Main Lagi",
              id: `${ctx?.prefix || "."}catur`
            }], {
              media: data.boardImageUrl,
              quoted: msg
            });
          } else {
            await sock.sendMessage(chatId, {
              image: {
                url: data.boardImageUrl
              },
              caption: `🏆 *SKAKMAT (CHECKMATE)!*\n\nSelamat kepada *${moverName}* yang memenangkan pertandingan! (+500 EXP) 🎉`
            }, {
              quoted: msg
            });
          }
          return true;
        }
        if (data.isDraw || data.isStalemate) {
          global.chessSession.delete(chatId);
          await axios.post(API_URL, {
            action: "delete",
            id: session.id
          }).catch(() => {});
          if (typeof ctx?.sendCta === "function") {
            await ctx.sendCta(`🤝 *PERMAINAN REMIS (DRAW / STALEMATE)!*\n\nPertandingan berakhir seri.`, "Permainan Selesai", [{
              display_text: "🎮 Main Lagi",
              id: `${ctx?.prefix || "."}catur`
            }], {
              media: data.boardImageUrl,
              quoted: msg
            });
          } else {
            await sock.sendMessage(chatId, {
              image: {
                url: data.boardImageUrl
              },
              caption: `🤝 *PERMAINAN REMIS (DRAW / STALEMATE)!*\n\nPertandingan berakhir seri.`
            }, {
              quoted: msg
            });
          }
          return true;
        }
        let moveInfo = `♟️ *${moverName}* melangkah: *${from.toUpperCase()} ➔ ${to.toUpperCase()}*\n`;
        if (data.inCheck) moveInfo += `⚠️ *SKAK!* Raja ${nextColor} sedang dalam ancaman!\n`;
        moveInfo += `\n🎯 *Giliran Sekarang:* ${nextColor} (*${nextPlayer.name}*)`;
        await sendChessBoard(sock, ctx, chatId, session, moveInfo, msg);
        return true;
      }
    } catch (e) {
      console.error("[CHESS BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      if (rawText.includes("menyerah") || rawText.includes("resign")) {
        if (!global.chessSession.has(chatId)) return ctx.reply("❌ Tidak ada game catur aktif.");
        const session = global.chessSession.get(chatId);
        const isWhite = session.white.jid === senderJid;
        const isBlack = session.black?.jid === senderJid;
        if (!isWhite && !isBlack) return ctx.reply("❌ Kamu bukan pemain di game ini.");
        const winner = isWhite ? session.black : session.white;
        const loserName = isWhite ? session.white.name : session.black.name;
        global.chessSession.delete(chatId);
        await axios.post(API_URL, {
          action: "delete",
          id: session.id
        }).catch(() => {});
        return ctx.reply(`🏳️ *${loserName} Menyerah!*\n🏆 Pemenang: *${winner?.name || "Lawan"}*`);
      }
      if (rawText.includes("batal") || rawText.includes("cancel")) {
        if (!global.chessSession.has(chatId)) return ctx.reply("❌ Tidak ada sesi catur aktif.");
        const session = global.chessSession.get(chatId);
        global.chessSession.delete(chatId);
        await axios.post(API_URL, {
          action: "delete",
          id: session.id
        }).catch(() => {});
        return ctx.reply("🚪 *Pertandingan catur berhasil dibatalkan.*");
      }
      if (rawText.includes("papan") || rawText.includes("board")) {
        if (!global.chessSession.has(chatId)) return ctx.reply("❌ Tidak ada game aktif.");
        const session = global.chessSession.get(chatId);
        const currentName = session.turn === "white" ? session.white.name : session.black?.name || "Menunggu Lawan";
        const turnColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        return await sendChessBoard(sock, ctx, chatId, session, `♟️ *Papan Catur Saat Ini*\n🎯 *Giliran:* ${turnColor} (*${currentName}*)`, quotedMsg);
      }
      if (rawText.includes("join") || rawText.includes("terima")) {
        if (!global.chessSession.has(chatId)) return ctx.reply(`❌ Belum ada room. Buat dengan \`${prefix}catur\``);
        const session = global.chessSession.get(chatId);
        if (session.status !== "waiting") return ctx.reply("⚠️ Game sudah dimulai!");
        if (session.white.jid === senderJid) return ctx.reply("⚠️ Kamu adalah pemain putih!");
        session.black = {
          jid: senderJid,
          name: ctx.pushname || "Pemain Hitam"
        };
        session.status = "playing";
        session.turn = "white";
        const startCaption = `🎉 *TANTANGAN CATUR DIMULAI!*\n\n` + `⚪ *Putih:* ${session.white.name}\n` + `⚫ *Hitam:* ${session.black.name}\n\n` + `🎯 *Giliran Pertama:* ⚪ *${session.white.name}* (Putih)\n` + `👉 *Ketik langkah di chat:* \`e2 e4\``;
        return await sendChessBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
      }
      const moveMatch = rawText.match(MOVE_REGEX);
      if (global.chessSession.has(chatId) && moveMatch) {
        const session = global.chessSession.get(chatId);
        if (session.status !== "playing") return ctx.reply("⚠️ Menunggu lawan bergabung!");
        const from = moveMatch[1].toLowerCase();
        const to = moveMatch[2].toLowerCase();
        const isWhiteTurn = session.turn === "white";
        const currentTurnJid = isWhiteTurn ? session.white.jid : session.black.jid;
        if (senderJid !== currentTurnJid) {
          return ctx.reply(`⚠️ Sekarang giliran ${isWhiteTurn ? "⚪ Putih" : "⚫ Hitam"}!`);
        }
        await ctx.react("⏳");
        const data = await executeMove(session.id, from, to);
        if (!data || data.message === "Invalid move" || !data.boardImageUrl) {
          await ctx.react("❌");
          return ctx.reply(`❌ Langkah *${from.toUpperCase()} ➔ ${to.toUpperCase()}* tidak sah!`);
        }
        session.boardImageUrl = data.boardImageUrl;
        session.turn = data.currentTurn;
        const moverName = isWhiteTurn ? session.white.name : session.black.name;
        const nextPlayer = session.turn === "white" ? session.white : session.black;
        const nextColor = session.turn === "white" ? "⚪ Putih" : "⚫ Hitam";
        let moveInfo = `♟️ *${moverName}* melangkah: *${from.toUpperCase()} ➔ ${to.toUpperCase()}*\n`;
        if (data.inCheck) moveInfo += `⚠️ *SKAK!* Raja ${nextColor} terancam!\n`;
        moveInfo += `\n🎯 *Giliran:* ${nextColor} (*${nextPlayer.name}*)`;
        await ctx.react("✅");
        return await sendChessBoard(sock, ctx, chatId, session, moveInfo, quotedMsg);
      }
      if (global.chessSession.has(chatId)) {
        return ctx.reply(`⚠️ Masih ada game catur aktif di grup ini!\nKetik \`${prefix}catur batal\` untuk mereset.`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "create"
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      if (!data?.gameId || !data?.boardImageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat papan catur dari server.");
      }
      const newSession = {
        id: data.gameId,
        white: {
          jid: senderJid,
          name: ctx.pushname || "Pemain Putih"
        },
        black: null,
        status: "waiting",
        turn: "white",
        boardImageUrl: data.boardImageUrl
      };
      global.chessSession.set(chatId, newSession);
      const lobbyCaption = `♟️ *TANTANGAN CATUR DIBUKA!*\n\n` + `╭───『 *DETAIL ROOM* 』\n` + `│ ⚪ *Putih (Host):* ${newSession.white.name}\n` + `│ ⚫ *Hitam:* _Menunggu Lawan..._\n` + `│ 🆔 *Game ID:* \`${data.gameId.slice(0, 8)}\`\n` + `╰──────────────────\n\n` + `👉 *Klik tombol di bawah untuk bergabung!*`;
      await sendChessBoard(sock, ctx, chatId, newSession, lobbyCaption, quotedMsg);
      await ctx.react("♟️");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Catur Error: ${error.message}`);
    }
  }
};