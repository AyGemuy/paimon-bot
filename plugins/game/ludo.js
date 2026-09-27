import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
global.ludoSession = global.ludoSession || new Map();
const API_URL = "https://wudysoft.my.id/api/game/ludo";
const PLAYER_COLORS = [{
  name: "Merah",
  emoji: "🔴",
  code: "p1"
}, {
  name: "Hijau",
  emoji: "🟢",
  code: "p2"
}, {
  name: "Kuning",
  emoji: "🟡",
  code: "p3"
}, {
  name: "Biru",
  emoji: "🔵",
  code: "p4"
}];
const DICE_EMOJIS = ["", "⚀ (1)", "⚁ (2)", "⚂ (3)", "⚃ (4)", "⚄ (5)", "⚅ (6)"];
async function callLudoApi(payload) {
  try {
    const res = await axios.post(API_URL, payload, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 6e4,
      validateStatus: status => status < 500
    });
    return res.data;
  } catch (err) {
    return {
      success: false,
      message: err.message || "Network Error"
    };
  }
}

function getMovablePieces(playerState, dice) {
  const movable = [];
  if (!playerState) return movable;
  for (const piece of ["a", "b", "c", "d"]) {
    const pos = playerState[piece] || 0;
    if (pos === 0 && dice === 6) {
      movable.push(piece);
    } else if (pos > 0 && pos + dice <= 57) {
      movable.push(piece);
    }
  }
  return movable;
}
async function sendLudoBoard(sock, ctx, chatId, session, textCaption, quotedMsg) {
  const currentPlayer = session.players[session.turnIndex];
  const prefix = ctx?.prefix || ".";
  const buttons = [];
  if (session.status === "waiting") {
    buttons.push({
      display_text: "🎮 Gabung (Join)",
      id: `${prefix}ludo join`
    });
    if (session.players.length >= 2) {
      buttons.push({
        display_text: "🚀 Mulai Sekarang",
        id: `${prefix}ludo start`
      });
    }
    buttons.push({
      display_text: "🚪 Batalkan Room",
      id: `${prefix}ludo cancel`
    });
  }
  if (session.status === "playing" && session.lastDice === null) {
    buttons.push({
      display_text: `🎲 Kocok Dadu (${currentPlayer.name})`,
      id: `${prefix}ludo roll`
    });
    buttons.push({
      display_text: "🚪 Batalkan Room",
      id: `${prefix}ludo cancel`
    });
  }
  if (session.status === "playing" && session.lastDice !== null && session.movablePieces?.length > 1) {
    const pieceRows = session.movablePieces.map(p => {
      const pos = session.state[`p${currentPlayer.playerNum}`]?.[p] || 0;
      return {
        title: `Bidak [${p.toUpperCase()}]`,
        id: `${prefix}ludo move ${p}`,
        description: `Posisi: ${pos === 0 ? "Kandang" : pos} ➔ Maju +${session.lastDice} langkah`
      };
    });
    buttons.push({
      title: "♟️ PILIH BIDAK UNTUK JALAN",
      sections: [{
        title: `GILIRAN: ${currentPlayer.name.toUpperCase()}`,
        rows: pieceRows
      }]
    });
    buttons.push({
      display_text: "🚪 Batalkan Room",
      id: `${prefix}ludo cancel`
    });
  }
  const footerText = `${global.bot?.name || "Bot"} • Ludo Multiplayer (${session.totalPlayers}P)`;
  if (typeof ctx?.sendCta === "function") {
    await ctx.sendCta(textCaption, footerText, buttons, {
      title: "乂 LUDO MULTIPLAYER ARENA 乂",
      subtitle: `Room ID: ${session.id.slice(0, 8)}`,
      media: session.boardUrl,
      quoted: quotedMsg
    });
  } else if (session.boardUrl) {
    await sock.sendMessage(chatId, {
      image: {
        url: session.boardUrl
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

function resetTurnTimer(sock, ctx, chatId, session) {
  if (session.turnTimer) clearTimeout(session.turnTimer);
  session.turnTimer = setTimeout(async () => {
    if (global.ludoSession.has(chatId) && session.status === "playing") {
      const afkPlayer = session.players[session.turnIndex];
      session.lastDice = null;
      session.movablePieces = [];
      session.turnIndex = (session.turnIndex + 1) % session.players.length;
      const nextPlayer = session.players[session.turnIndex];
      const timeoutCaption = `⏰ *WAKTU GILIRAN HABIS! (AFK)*\n\n` + `${afkPlayer.color.emoji} *${afkPlayer.name}* tidak merespon.\n` + `🎯 *Giliran beralih ke:* ${nextPlayer.color.emoji} *${nextPlayer.name}*`;
      resetTurnTimer(sock, ctx, chatId, session);
      await sendLudoBoard(sock, ctx, chatId, session, timeoutCaption, null);
    }
  }, 60 * 1e3);
}
export default {
  name: "ludo",
  aliases: ["ludoking", "mainludo"],
  description: "Game papan Ludo multiplayer interaktif (2, 3, atau 4 Pemain) Full CTA",
  category: "Game",
  group: true,
  limit: true,
  example: "ludo create 2 atau ludo create 4 atau ludo join",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.ludoSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.ludoSession.get(chatId);
      const senderJid = ctx?.sender;
      const text = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!text || text.startsWith(`${ctx?.prefix || "."}ludo`)) return;
      if (session.status === "waiting" && ["join", "ikut", "masuk"].includes(text)) {
        if (session.players.some(p => p.jid === senderJid)) {
          await ctx.reply("⚠️ Kamu sudah bergabung di room ini!");
          return true;
        }
        const playerNum = session.players.length + 1;
        const color = PLAYER_COLORS[playerNum - 1];
        session.players.push({
          jid: senderJid,
          name: ctx?.pushname || `Pemain ${playerNum}`,
          playerNum: playerNum,
          color: color
        });
        if (session.players.length === session.totalPlayers) {
          session.status = "playing";
          session.turnIndex = 0;
          session.lastDice = null;
          const firstPlayer = session.players[0];
          const startCaption = `🎉 *ROOM LUDO LENGKAP & GAME DIMULAI!*\n\n` + `Daftar Pemain (${session.totalPlayers}P):\n` + session.players.map(p => `• ${p.color.emoji} *${p.name}* (${p.color.name})`).join("\n") + `\n\n🎯 *Giliran Pertama:* ${firstPlayer.color.emoji} *${firstPlayer.name}*\n` + `👉 Klik tombol di bawah untuk mengocok dadu!`;
          resetTurnTimer(sock, ctx, chatId, session);
          await sendLudoBoard(sock, ctx, chatId, session, startCaption, msg);
          return true;
        }
        await ctx.reply(`✅ *${ctx?.pushname || "Pemain"}* bergabung (${color.emoji} ${color.name})!\n` + `Slot: *${session.players.length}/${session.totalPlayers}* pemain.\n` + (session.players.length >= 2 ? `_(Host bisa klik \`Mulai Sekarang\` untuk langsung mulai)_` : ""));
        return true;
      }
      if (session.status === "waiting" && ["start", "mulai", "gas"].includes(text)) {
        if (session.players[0].jid !== senderJid) {
          await ctx.reply("⚠️ Hanya pembuat room (Host) yang bisa memulai permainan!");
          return true;
        }
        if (session.players.length < 2) {
          await ctx.reply("❌ Minimal dibutuhkan 2 pemain untuk memulai Ludo!");
          return true;
        }
        session.totalPlayers = session.players.length;
        session.status = "playing";
        session.turnIndex = 0;
        session.lastDice = null;
        const firstPlayer = session.players[0];
        const startCaption = `🚀 *GAME LUDO DIMULAI OLEH HOST!*\n\n` + `Daftar Pemain (${session.totalPlayers}P):\n` + session.players.map(p => `• ${p.color.emoji} *${p.name}* (${p.color.name})`).join("\n") + `\n\n🎯 *Giliran Pertama:* ${firstPlayer.color.emoji} *${firstPlayer.name}*\n` + `👉 Klik tombol di bawah untuk mengocok dadu!`;
        resetTurnTimer(sock, ctx, chatId, session);
        await sendLudoBoard(sock, ctx, chatId, session, startCaption, msg);
        return true;
      }
      if (session.status === "playing" && ["roll", "kocok", "dadu", "putar"].includes(text)) {
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid) return;
        if (session.lastDice !== null) {
          await ctx.reply(`⚠️ Kamu sudah mengocok dadu (${DICE_EMOJIS[session.lastDice]}). Silakan pilih bidak!`);
          return true;
        }
        const dice = Math.floor(Math.random() * 6) + 1;
        session.lastDice = dice;
        const playerKey = `p${currentPlayer.playerNum}`;
        const movable = getMovablePieces(session.state[playerKey], dice);
        session.movablePieces = movable;
        if (movable.length === 0) {
          session.lastDice = null;
          session.movablePieces = [];
          session.turnIndex = (session.turnIndex + 1) % session.players.length;
          const nextPlayer = session.players[session.turnIndex];
          const noMoveCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mendapat dadu: *${DICE_EMOJIS[dice]}*\n\n` + `❌ *Tidak ada bidak yang dapat bergerak!*\n` + `🎯 *Giliran beralih ke:* ${nextPlayer.color.emoji} *${nextPlayer.name}*`;
          resetTurnTimer(sock, ctx, chatId, session);
          await sendLudoBoard(sock, ctx, chatId, session, noMoveCaption, msg);
          return true;
        }
        if (movable.length === 1) {
          const piece = movable[0];
          const currentPos = session.state[playerKey][piece] || 0;
          const newPos = currentPos === 0 ? 1 : currentPos + dice;
          const data = await callLudoApi({
            action: "move",
            id: session.id,
            player: String(currentPlayer.playerNum),
            [piece]: newPos
          });
          if (data?.game?.boardUrl) {
            session.boardUrl = data.game.boardUrl;
            session.state = data.game.state;
          }
          const pState = session.state[playerKey];
          if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
            if (session.turnTimer) clearTimeout(session.turnTimer);
            global.ludoSession.delete(chatId);
            if (global.db?.user?.[currentPlayer.jid]) {
              global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
              if (typeof db?.write === "function") db.write(global.db);
            }
            await ctx.reply(`🏆 *SELAMAT! ${currentPlayer.color.emoji} ${currentPlayer.name.toUpperCase()} MEMENANGKAN GAME LUDO!* (+500 EXP) 🏆`);
            return true;
          }
          const rolledSix = dice === 6;
          session.lastDice = null;
          session.movablePieces = [];
          if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
          const activePlayer = session.players[session.turnIndex];
          const autoCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mengocok dadu: *${DICE_EMOJIS[dice]}*!\n` + `♟️ *Auto-Move:* Bidak [${piece.toUpperCase()}] maju ke posisi *${newPos}*!\n\n` + (rolledSix ? `🎉 *Dadu 6!* ${currentPlayer.name} dapat mengocok dadu lagi!\n` : "") + `🎯 *Giliran Sekarang:* ${activePlayer.color.emoji} *${activePlayer.name}*`;
          resetTurnTimer(sock, ctx, chatId, session);
          await sendLudoBoard(sock, ctx, chatId, session, autoCaption, msg);
          return true;
        }
        const rollCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mengocok dadu: *${DICE_EMOJIS[dice]}*!\n\n` + `♟️ Bidak yang bisa digerakkan: *${movable.map(m => m.toUpperCase()).join(", ")}*\n` + `👉 Pilih bidak dari menu dropdown di bawah!`;
        await sendLudoBoard(sock, ctx, chatId, session, rollCaption, msg);
        return true;
      }
      if (session.status === "playing" && ["a", "b", "c", "d"].includes(text)) {
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid || session.lastDice === null) return;
        const piece = text;
        if (!session.movablePieces?.includes(piece)) {
          await ctx.reply(`❌ Bidak [${piece.toUpperCase()}] tidak bisa bergerak dengan dadu ${session.lastDice}!`);
          return true;
        }
        const playerKey = `p${currentPlayer.playerNum}`;
        const currentPos = session.state[playerKey][piece] || 0;
        const newPos = currentPos === 0 ? 1 : currentPos + session.lastDice;
        const data = await callLudoApi({
          action: "move",
          id: session.id,
          player: String(currentPlayer.playerNum),
          [piece]: newPos
        });
        if (data?.game?.boardUrl) {
          session.boardUrl = data.game.boardUrl;
          session.state = data.game.state;
        }
        const pState = session.state[playerKey];
        if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
          if (session.turnTimer) clearTimeout(session.turnTimer);
          global.ludoSession.delete(chatId);
          if (global.db?.user?.[currentPlayer.jid]) {
            global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
            if (typeof db?.write === "function") db.write(global.db);
          }
          await ctx.reply(`🏆 *SELAMAT! ${currentPlayer.color.emoji} ${currentPlayer.name.toUpperCase()} MEMENANGKAN GAME LUDO!* (+500 EXP) 🏆`);
          return true;
        }
        const rolledSix = session.lastDice === 6;
        session.lastDice = null;
        session.movablePieces = [];
        if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
        const activePlayer = session.players[session.turnIndex];
        const moveCaption = `♟️ ${currentPlayer.color.emoji} *${currentPlayer.name}* memindahkan bidak [${piece.toUpperCase()}] ke posisi *${newPos}*!\n\n` + (rolledSix ? `🎉 *Dadu 6!* ${currentPlayer.name} dapat mengocok dadu lagi!\n` : "") + `🎯 *Giliran Sekarang:* ${activePlayer.color.emoji} *${activePlayer.name}*`;
        resetTurnTimer(sock, ctx, chatId, session);
        await sendLudoBoard(sock, ctx, chatId, session, moveCaption, msg);
        return true;
      }
    } catch (e) {
      console.error("[LUDO BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      const senderJid = ctx.sender;
      if (rawText.includes("cancel") || rawText.includes("keluar") || rawText.includes("batal")) {
        if (global.ludoSession.has(chatId)) {
          const session = global.ludoSession.get(chatId);
          if (session.turnTimer) clearTimeout(session.turnTimer);
          global.ludoSession.delete(chatId);
          await callLudoApi({
            action: "delete",
            id: session.id
          });
          return ctx.reply("🚪 *Room Ludo di grup ini berhasil dibatalkan.*");
        }
        return ctx.reply("❌ Tidak ada sesi Ludo yang sedang berjalan.");
      }
      if (rawText.includes("join") || rawText.includes("masuk")) {
        if (!global.ludoSession.has(chatId)) {
          return ctx.reply(`❌ Belum ada room Ludo. Buat dulu dengan \`${prefix}ludo create [2|3|4]\``);
        }
        const session = global.ludoSession.get(chatId);
        if (session.status !== "waiting") return ctx.reply("⚠️ Permainan Ludo sudah dimulai!");
        if (session.players.some(p => p.jid === senderJid)) return ctx.reply("⚠️ Kamu sudah bergabung di dalam room!");
        const playerNum = session.players.length + 1;
        const color = PLAYER_COLORS[playerNum - 1];
        session.players.push({
          jid: senderJid,
          name: ctx.pushname || `Pemain ${playerNum}`,
          playerNum: playerNum,
          color: color
        });
        if (session.players.length === session.totalPlayers) {
          session.status = "playing";
          session.turnIndex = 0;
          session.lastDice = null;
          const firstPlayer = session.players[0];
          const startCaption = `🎉 *LUDO ROOM PENUH & DIMULAI!*\n\n` + `Daftar Pemain (${session.totalPlayers}P):\n` + session.players.map(p => `• ${p.color.emoji} *${p.name}* (${p.color.name})`).join("\n") + `\n\n🎯 *Giliran Pertama:* ${firstPlayer.color.emoji} *${firstPlayer.name}*\n` + `👉 Klik tombol di bawah untuk mengocok dadu!`;
          resetTurnTimer(sock, ctx, chatId, session);
          return await sendLudoBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
        }
        return ctx.reply(`✅ *${ctx.pushname || "Pemain"}* berhasil bergabung (${color.emoji} ${color.name})!\n` + `Slot Pemain: *${session.players.length}/${session.totalPlayers}*`);
      }
      if (rawText.includes("start") || rawText.includes("mulai")) {
        if (!global.ludoSession.has(chatId)) return ctx.reply("❌ Tidak ada room aktif.");
        const session = global.ludoSession.get(chatId);
        if (session.players[0].jid !== senderJid) {
          return ctx.reply("⚠️ Hanya pembuat room (Host) yang bisa memulai permainan!");
        }
        if (session.players.length < 2) {
          return ctx.reply("❌ Minimal dibutuhkan 2 pemain untuk memulai Ludo!");
        }
        session.totalPlayers = session.players.length;
        session.status = "playing";
        session.turnIndex = 0;
        session.lastDice = null;
        const firstPlayer = session.players[0];
        const startCaption = `🚀 *GAME LUDO DIMULAI OLEH HOST!*\n\n` + `Daftar Pemain (${session.totalPlayers}P):\n` + session.players.map(p => `• ${p.color.emoji} *${p.name}* (${p.color.name})`).join("\n") + `\n\n🎯 *Giliran Pertama:* ${firstPlayer.color.emoji} *${firstPlayer.name}*\n` + `👉 Klik tombol di bawah untuk mengocok dadu!`;
        resetTurnTimer(sock, ctx, chatId, session);
        return await sendLudoBoard(sock, ctx, chatId, session, startCaption, quotedMsg);
      }
      if (rawText.includes("roll") || rawText.includes("kocok")) {
        if (!global.ludoSession.has(chatId)) return ctx.reply("❌ Tidak ada game Ludo aktif.");
        const session = global.ludoSession.get(chatId);
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid) {
          return ctx.reply(`⚠️ Sekarang giliran ${currentPlayer.color.emoji} *${currentPlayer.name}*!`);
        }
        const dice = Math.floor(Math.random() * 6) + 1;
        session.lastDice = dice;
        const playerKey = `p${currentPlayer.playerNum}`;
        const movable = getMovablePieces(session.state[playerKey], dice);
        session.movablePieces = movable;
        if (movable.length === 0) {
          session.lastDice = null;
          session.movablePieces = [];
          session.turnIndex = (session.turnIndex + 1) % session.players.length;
          const nextPlayer = session.players[session.turnIndex];
          const noMoveCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mendapat dadu: *${DICE_EMOJIS[dice]}*\n\n` + `❌ *Tidak ada bidak yang bisa melangkah!*\n` + `🎯 *Giliran beralih ke:* ${nextPlayer.color.emoji} *${nextPlayer.name}*`;
          resetTurnTimer(sock, ctx, chatId, session);
          return await sendLudoBoard(sock, ctx, chatId, session, noMoveCaption, quotedMsg);
        }
        if (movable.length === 1) {
          const piece = movable[0];
          const currentPos = session.state[playerKey][piece] || 0;
          const newPos = currentPos === 0 ? 1 : currentPos + dice;
          const data = await callLudoApi({
            action: "move",
            id: session.id,
            player: String(currentPlayer.playerNum),
            [piece]: newPos
          });
          if (data?.game?.boardUrl) {
            session.boardUrl = data.game.boardUrl;
            session.state = data.game.state;
          }
          const pState = session.state[playerKey];
          if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
            if (session.turnTimer) clearTimeout(session.turnTimer);
            global.ludoSession.delete(chatId);
            if (global.db?.user?.[currentPlayer.jid]) {
              global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
              if (typeof db?.write === "function") db.write(global.db);
            }
            return ctx.reply(`🏆 *SELAMAT! ${currentPlayer.color.emoji} ${currentPlayer.name.toUpperCase()} MENANG!* (+500 EXP) 🏆`);
          }
          const rolledSix = dice === 6;
          session.lastDice = null;
          session.movablePieces = [];
          if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
          const activePlayer = session.players[session.turnIndex];
          const autoCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mengocok dadu: *${DICE_EMOJIS[dice]}*!\n` + `♟️ *Auto-Move:* Bidak [${piece.toUpperCase()}] maju ke posisi *${newPos}*!\n\n` + (rolledSix ? `🎉 *Dadu 6!* ${currentPlayer.name} dapat mengocok dadu lagi!\n` : "") + `🎯 *Giliran Sekarang:* ${activePlayer.color.emoji} *${activePlayer.name}*`;
          resetTurnTimer(sock, ctx, chatId, session);
          return await sendLudoBoard(sock, ctx, chatId, session, autoCaption, quotedMsg);
        }
        const rollCaption = `🎲 ${currentPlayer.color.emoji} *${currentPlayer.name}* mengocok dadu: *${DICE_EMOJIS[dice]}*!\n\n` + `♟️ Bidak yang bisa jalan: *${movable.map(m => m.toUpperCase()).join(", ")}*\n` + `👉 Pilih bidak dari menu dropdown di bawah!`;
        return await sendLudoBoard(sock, ctx, chatId, session, rollCaption, quotedMsg);
      }
      if (rawText.includes("move")) {
        if (!global.ludoSession.has(chatId)) return ctx.reply("❌ Tidak ada game Ludo aktif.");
        const session = global.ludoSession.get(chatId);
        const currentPlayer = session.players[session.turnIndex];
        if (currentPlayer.jid !== senderJid || session.lastDice === null) {
          return ctx.reply("⚠️ Bukan giliranmu atau kamu belum mengocok dadu!");
        }
        const piece = rawText.split("move")[1]?.trim()?.toLowerCase();
        if (!["a", "b", "c", "d"].includes(piece) || !session.movablePieces?.includes(piece)) {
          return ctx.reply(`❌ Bidak [${piece?.toUpperCase() || "?"}] tidak dapat bergerak.`);
        }
        const playerKey = `p${currentPlayer.playerNum}`;
        const currentPos = session.state[playerKey][piece] || 0;
        const newPos = currentPos === 0 ? 1 : currentPos + session.lastDice;
        const data = await callLudoApi({
          action: "move",
          id: session.id,
          player: String(currentPlayer.playerNum),
          [piece]: newPos
        });
        if (data?.game?.boardUrl) {
          session.boardUrl = data.game.boardUrl;
          session.state = data.game.state;
        }
        const pState = session.state[playerKey];
        if (pState.a === 57 && pState.b === 57 && pState.c === 57 && pState.d === 57) {
          if (session.turnTimer) clearTimeout(session.turnTimer);
          global.ludoSession.delete(chatId);
          if (global.db?.user?.[currentPlayer.jid]) {
            global.db.user[currentPlayer.jid].exp = (global.db.user[currentPlayer.jid].exp || 0) + 500;
            if (typeof db?.write === "function") db.write(global.db);
          }
          return ctx.reply(`🏆 *SELAMAT! ${currentPlayer.color.emoji} ${currentPlayer.name.toUpperCase()} MENANG!* (+500 EXP) 🏆`);
        }
        const rolledSix = session.lastDice === 6;
        session.lastDice = null;
        session.movablePieces = [];
        if (!rolledSix) session.turnIndex = (session.turnIndex + 1) % session.players.length;
        const activePlayer = session.players[session.turnIndex];
        const moveCaption = `♟️ ${currentPlayer.color.emoji} *${currentPlayer.name}* memindahkan bidak [${piece.toUpperCase()}] ke posisi *${newPos}*!\n\n` + (rolledSix ? `🎉 *Dadu 6!* ${currentPlayer.name} dapat mengocok dadu lagi!\n` : "") + `🎯 *Giliran Sekarang:* ${activePlayer.color.emoji} *${activePlayer.name}*`;
        resetTurnTimer(sock, ctx, chatId, session);
        return await sendLudoBoard(sock, ctx, chatId, session, moveCaption, quotedMsg);
      }
      if (global.ludoSession.has(chatId)) {
        return ctx.reply(`⚠️ Masih ada game Ludo aktif di grup ini!\nKetik \`${prefix}ludo cancel\` untuk mereset.`);
      }
      let totalPlayers = 4;
      const countMatch = rawText.match(/\b([234])\b/);
      if (countMatch) {
        totalPlayers = parseInt(countMatch[1], 10);
      }
      await ctx.react("⏳");
      const data = await callLudoApi({
        action: "create",
        total: totalPlayers
      });
      if (!data?.success || !data?.game) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat room Ludo dari server.");
      }
      const game = data.game;
      const hostColor = PLAYER_COLORS[0];
      const newSession = {
        id: game.id,
        totalPlayers: totalPlayers,
        status: "waiting",
        boardUrl: game.boardUrl,
        state: game.state,
        turnIndex: 0,
        lastDice: null,
        movablePieces: [],
        players: [{
          jid: senderJid,
          name: ctx.pushname || "Host (Player 1)",
          playerNum: 1,
          color: hostColor
        }]
      };
      global.ludoSession.set(chatId, newSession);
      const lobbyCaption = `🎲 *LOBBY LUDO MULTIPLAYER DIBUKA!*\n\n` + `╭───『 *ROOM DETAIL* 』\n` + `│ 👑 *Host:* ${ctx.pushname || "Player 1"}\n` + `│ 👥 *Kapasitas:* ${totalPlayers} Pemain\n` + `│ 🆔 *Room ID:* \`${game.id.slice(0, 8)}\`\n` + `╰──────────────────\n\n` + `Daftar Pemain (${newSession.players.length}/${totalPlayers}):\n` + `1. ${hostColor.emoji} *${ctx.pushname || "Player 1"}* (${hostColor.name})\n\n` + `👉 *Klik tombol di bawah untuk bergabung!*`;
      await sendLudoBoard(sock, ctx, chatId, newSession, lobbyCaption, quotedMsg);
      await ctx.react("🎲");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Ludo Error: ${error.message}`);
    }
  }
};