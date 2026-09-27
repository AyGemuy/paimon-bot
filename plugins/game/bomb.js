import db from "../../data/db.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
global.bombPvP = global.bombPvP || new Map();
const WIRE_COLORS = [{
  id: "merah",
  num: "1",
  name: "🔴 Kabel Merah"
}, {
  id: "biru",
  num: "2",
  name: "🔵 Kabel Biru"
}, {
  id: "hijau",
  num: "3",
  name: "🟢 Kabel Hijau"
}, {
  id: "kuning",
  num: "4",
  name: "🟡 Kabel Kuning"
}, {
  id: "putih",
  num: "5",
  name: "⚪ Kabel Putih"
}];
async function sendBombCta(sock, ctx, targetJid, bodyText, footerText, buttons, quoted = null, mentions = []) {
  const botName = global.bot?.name || "WudysoftBot";
  const options = {
    jid: targetJid,
    to: targetJid,
    chat: targetJid,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 3,
        divider_indices: [2],
        list_title: `${botName} • Bomb Defusal Arena`,
        button_title: "Pilih Kabel"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false,
      mentionedJid: mentions
    },
    quoted: quoted || undefined
  };
  if (typeof ctx?.sendCta === "function" && targetJid === ctx.id) {
    try {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {
      console.error("[sendBombCta ctx.sendCta error]:", e.message);
    }
  }
  try {
    const nativeButtons = buttons.map(b => ({
      name: b.name || "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: b.display_text,
        id: b.id || b.copy_code || ""
      })
    }));
    return await sock.sendMessage(targetJid, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: bodyText
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
      quoted: quoted
    });
  } catch (e) {
    console.error("[sendBombCta native interactive error]:", e.message);
  }
  if (typeof ctx?.sendCta === "function") {
    try {
      const pcCtx = Object.create(ctx);
      Object.defineProperty(pcCtx, "id", {
        value: targetJid,
        writable: true
      });
      Object.defineProperty(pcCtx, "chat", {
        value: targetJid,
        writable: true
      });
      return await pcCtx.sendCta(bodyText, footerText, buttons, options);
    } catch (e) {}
  }
  return await sock.sendMessage(targetJid, {
    text: `${bodyText}\n\n_${footerText}_`,
    mentions: mentions
  }, {
    quoted: quoted
  });
}
async function applyWireSetup(sock, ctx, setupGame, wireInput) {
  const matchedWire = WIRE_COLORS.find(w => w.id === wireInput || w.num === wireInput || wireInput.includes(w.id) || wireInput.includes(w.name.toLowerCase()));
  if (!matchedWire) {
    return ctx.reply("⚠️ Pilihan kabel tidak valid! Ketik angka 1 - 5 atau nama warnanya.");
  }
  clearTimeout(setupGame.setupTimer);
  setupGame.detonateWire = matchedWire.id;
  const remainingWires = WIRE_COLORS.filter(w => w.id !== matchedWire.id);
  setupGame.defuseWire = remainingWires[Math.floor(Math.random() * remainingWires.length)].id;
  setupGame.status = "ARMED";
  setupGame.expireTime = Date.now() + 60 * 1e3;
  if (typeof ctx?.react === "function") await ctx.react("💣");
  await ctx.reply(`✅ *BOM BERHASIL DISETEL!*\n\n` + `Kabel jebakan detonator: *${matchedWire.name}*\n` + `Bom telah aktif di grup selama 60 detik. Pantau grup sekarang!`);
  return await armBombInGroup(sock, ctx, setupGame);
}
export default {
  name: "bomb",
  aliases: ["bom", "defuse", "pasangbom"],
  description: "Pasang bom rahasia via PC dan tantang anggota grup menjinakkannya",
  category: "Game",
  limit: false,
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us") || msg?.key?.remoteJid?.endsWith("@g.us"));
      const senderJid = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      if (!senderJid) return;
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (!isGroup) {
        const setupGame = Array.from(global.bombPvP.values()).find(g => g.status === "SETTING_UP" && g.planterJid === senderJid);
        if (!setupGame) return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        return await applyWireSetup(sock, ctx, setupGame, userText);
      }
      if (isGroup) {
        const groupId = ctx.id;
        const game = global.bombPvP.get(groupId);
        if (!game || game.status !== "ARMED") return;
        const prefix = ctx?.prefix || ".";
        if (userText.startsWith(prefix)) return;
        const matchedWire = WIRE_COLORS.find(w => w.id === userText || w.num === userText || userText.includes(w.id) || userText.includes(w.name.toLowerCase()));
        if (!matchedWire) return;
        const senderName = ctx?.pushName || "Penjinak";
        const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
        await handleCutWire(sock, ctx, groupId, game, matchedWire.id, senderJid, senderName, prefix, quotedMsg);
        return true;
      }
    } catch (err) {
      console.error("[BOMB BEFORE ERROR]:", err);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const isGroup = Boolean(ctx?.isGroup || ctx?.id?.endsWith("@g.us"));
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx?.prefix || ".";
      const senderJid = ctx?.sender || msg?.key?.participant;
      const senderName = ctx?.pushName || "Pemasang Bom";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const args = ctx?.args || [];
      const subCommand = (args[0] || "").trim().toLowerCase();
      if (!isGroup) {
        if (subCommand === "set") {
          const setupGame = Array.from(global.bombPvP.values()).find(g => g.status === "SETTING_UP" && g.planterJid === senderJid);
          if (!setupGame) {
            return ctx.reply("⚠️ Sesi penyetelan bom ini sudah selesai atau kedaluwarsa.");
          }
          const targetWire = (args[1] || "").trim().toLowerCase();
          return await applyWireSetup(sock, ctx, setupGame, targetWire);
        }
        return ctx.reply("❌ *Perintah ini harus dipanggil di dalam Grup!*");
      }
      const groupId = ctx.id;
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(senderJid, senderName);
      }
      const userData = global.db?.user?.[senderJid] || {};
      if (subCommand === "cut" || subCommand === "potong") {
        const game = global.bombPvP.get(groupId);
        if (!game || game.status !== "ARMED") {
          return ctx.reply("⚠️ Tidak ada bom aktif yang siap dijinakkan di grup ini!");
        }
        const targetWire = (args[1] || "").trim().toLowerCase();
        return await handleCutWire(sock, ctx, groupId, game, targetWire, senderJid, senderName, prefix, quotedMsg);
      }
      if (["surrender", "nyerah", "batal", "cancel"].includes(subCommand)) {
        if (!global.bombPvP.has(groupId)) {
          return ctx.reply("⚠️ Tidak ada sesi bom yang aktif saat ini.");
        }
        const game = global.bombPvP.get(groupId);
        if (game.planterJid !== senderJid) {
          return ctx.reply("❌ Hanya pemasang bom yang dapat membatalkannya.");
        }
        clearTimeout(game.timer);
        clearTimeout(game.setupTimer);
        global.bombPvP.delete(groupId);
        return ctx.reply("🛑 Sesi bom berhasil dibatalkan.");
      }
      if (global.bombPvP.has(groupId)) {
        const existing = global.bombPvP.get(groupId);
        if (existing.status === "SETTING_UP") {
          return ctx.reply(`⏳ @${existing.planterJid.split("@")[0]} sedang menyetel kabel bom di Private Chat!`, {
            mentions: [existing.planterJid]
          });
        }
        return ctx.reply("⚠️ Masih ada bom aktif di grup ini! Segera jinakkan sebelum meledak.");
      }
      const mentioned = ctx?.mentionedJid || [];
      const targetJid = mentioned[0] || null;
      let betAmount = 0;
      for (const arg of args) {
        const cleanNum = parseInt(arg.replace(/[^0-9]/g, ""));
        if (!isNaN(cleanNum) && cleanNum > 0 && !arg.startsWith("@")) {
          betAmount = cleanNum;
          break;
        }
      }
      if (betAmount > 0) {
        const pMoney = Number(userData.money) || 0;
        if (pMoney < betAmount) {
          return ctx.reply(`❌ Uangmu tidak cukup untuk taruhan sebesar *Rp ${betAmount.toLocaleString()}*! (Uangmu: Rp ${pMoney.toLocaleString()})`);
        }
      }
      await ctx.react("⏳");
      const setupTimer = setTimeout(async () => {
        if (global.bombPvP.has(groupId) && global.bombPvP.get(groupId).status === "SETTING_UP") {
          global.bombPvP.delete(groupId);
          await sock.sendMessage(groupId, {
            text: `⌛ *WAKTU PENYETELAN HABIS!*\nPemasang bom @${senderJid.split("@")[0]} tidak menyetel bom di Private Chat, sesi dibatalkan.`,
            mentions: [senderJid]
          });
        }
      }, 60 * 1e3);
      const newGame = {
        groupId: groupId,
        planterJid: senderJid,
        planterName: senderName,
        targetJid: targetJid,
        bet: betAmount,
        status: "SETTING_UP",
        detonateWire: null,
        defuseWire: null,
        cutWires: new Set(),
        expireTime: null,
        timer: null,
        setupTimer: setupTimer
      };
      global.bombPvP.set(groupId, newGame);
      const pcButtons = WIRE_COLORS.map(w => ({
        name: "quick_reply",
        display_text: `${w.num}. ${w.name}`,
        id: `${prefix}bomb set ${w.id}`
      }));
      let pcText = `💣 *PENGATURAN KABEL BOM RAHASIA* 💣\n\n`;
      pcText += `Pilih kabel yang ingin kamu jadikan *JEBAKAN PELEDAK (Detonator)*:\n`;
      WIRE_COLORS.forEach(w => {
        pcText += `[${w.num}] ${w.name}\n`;
      });
      if (betAmount > 0) pcText += `\n💰 *Taruhan:* Rp ${betAmount.toLocaleString()}`;
      pcText += `\n\n_💡 Tekan tombol di bawah atau langsung balas chat ini dengan angka (1 - 5) / nama warnanya._`;
      await sendBombCta(sock, ctx, senderJid, pcText, `${botName} • Secret Detonator Setup`, pcButtons);
      let groupAnnounce = `💣 *PERSIAPAN PEMASANGAN BOM!* 💣\n\n`;
      groupAnnounce += `👤 *Pemasang:* @${senderJid.split("@")[0]}\n`;
      if (targetJid) groupAnnounce += `🎯 *Target Penjinak:* @${targetJid.split("@")[0]}\n`;
      if (betAmount > 0) groupAnnounce += `💰 *Taruhan:* Rp ${betAmount.toLocaleString()}\n`;
      groupAnnounce += `\n📩 *Bot telah mengirim pesan ke Private Chat (PC) @${senderJid.split("@")[0]} untuk menyetel jebakan kabel.*\nMohon tunggu hingga bom aktif!`;
      const mentions = targetJid ? [senderJid, targetJid] : [senderJid];
      await sock.sendMessage(groupId, {
        text: groupAnnounce,
        mentions: mentions
      }, {
        quoted: quotedMsg
      });
    } catch (e) {
      console.error("[BOMB ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Terjadi kesalahan: ${e.message}`);
    }
  }
};
async function armBombInGroup(sock, ctx, game) {
  const groupId = game.groupId;
  const botName = global.bot?.name || "WudysoftBot";
  const prefix = ctx?.prefix || ".";
  game.timer = setTimeout(async () => {
    if (global.bombPvP.has(groupId) && global.bombPvP.get(groupId).status === "ARMED") {
      const g = global.bombPvP.get(groupId);
      global.bombPvP.delete(groupId);
      await distributeReward(g.planterJid, g.planterName, null, null, g.bet, "timeout");
      const boomTimeout = `⏰ *WAKTU HABIS! DUAAARRRRR!* 💥💥\n\n` + `💀 Bom meledak karena tidak ada yang berhasil menjinakkannya tepat waktu!\n` + `🏆 Pemasang bom @${g.planterJid.split("@")[0]} berhasil memenangkan game!\n` + `✂️ Kabel penjinak asli sebenarnya: *${WIRE_COLORS.find(w => w.id === g.defuseWire)?.name}*`;
      await sock.sendMessage(groupId, {
        text: boomTimeout,
        mentions: [g.planterJid]
      });
    }
  }, 60 * 1e3);
  const buttons = WIRE_COLORS.map(w => ({
    name: "quick_reply",
    display_text: `${w.num}. ${w.name}`,
    id: `${prefix}bomb cut ${w.id}`
  }));
  let armedText = `🚨 *BOM AKTIF & SIAP DIJINAKKAN!* 🚨\n\n`;
  armedText += `👤 *Pemasang:* @${game.planterJid.split("@")[0]}\n`;
  if (game.targetJid) armedText += `🎯 *Target Penjinak:* @${game.targetJid.split("@")[0]}\n`;
  if (game.bet > 0) armedText += `💰 *Total Hadiah Taruhan:* Rp ${(game.bet * 2).toLocaleString()}\n`;
  armedText += `⏳ *Waktu Tersisa:* 60 Detik\n\n`;
  armedText += `*Daftar Kabel Tersedia:*\n`;
  WIRE_COLORS.forEach(w => {
    armedText += `[${w.num}] ${w.name}\n`;
  });
  armedText += `\n*Petunjuk:*\n`;
  armedText += `• 1 Kabel = *Penjinak Bom* (Menang Hadiah 🎉)\n`;
  armedText += `• 1 Kabel = *Jebakan Peledak* (Duaaarrr! 💥)\n`;
  armedText += `• 3 Kabel = *Kabel Netral*\n\n`;
  armedText += `_Ketuk tombol di bawah atau ketik angka (1 - 5) / nama warnanya di chat!_`;
  const mentions = game.targetJid ? [game.planterJid, game.targetJid] : [game.planterJid];
  await sendBombCta(sock, ctx, groupId, armedText, `${botName} • 60 Detik Menuju Ledakan`, buttons, null, mentions);
}
async function handleCutWire(sock, ctx, groupId, game, wireInput, defuserJid, defuserName, prefix, quotedMsg) {
  const botName = global.bot?.name || "WudysoftBot";
  if (defuserJid === game.planterJid) {
    return ctx.reply("❌ Kamu yang memasang bom ini! Biarkan anggota lain yang menjinakkannya.");
  }
  if (game.targetJid && game.targetJid !== defuserJid) {
    return ctx.reply(`❌ Bom ini khusus ditujukan untuk dijinakkan oleh @${game.targetJid.split("@")[0]}!`, {
      mentions: [game.targetJid]
    });
  }
  const matched = WIRE_COLORS.find(w => w.id === wireInput || w.num === wireInput || wireInput.includes(w.id) || wireInput.includes(w.name.toLowerCase()));
  if (!matched) {
    return ctx.reply("⚠️ Pilihan tidak valid! Ketik angka 1 - 5 atau nama warnanya.");
  }
  const wireId = matched.id;
  if (game.cutWires.has(wireId)) {
    return ctx.reply(`⚠️ Kabel *${matched.name}* sudah pernah dipotong! Pilih kabel lainnya.`);
  }
  game.cutWires.add(wireId);
  const pickedColor = matched.name;
  if (wireId === game.defuseWire) {
    clearTimeout(game.timer);
    global.bombPvP.delete(groupId);
    const rewardMsg = await distributeReward(defuserJid, defuserName, game.planterJid, game.planterName, game.bet, "defuse");
    const winText = `🎉 *BOM BERHASIL DIJINAKKAN!* 🛠️✨\n\n` + `👤 *Pahlawan Penjinak:* @${defuserJid.split("@")[0]}\n` + `💣 *Pemasang Bom:* @${game.planterJid.split("@")[0]}\n` + `✂️ *Kabel Tepat:* ${pickedColor}\n\n` + `✨ *Reward:* ${rewardMsg}\n\n` + `_Ketik \`${prefix}bomb\` untuk memasang bom baru!_`;
    return await sendBombCta(sock, ctx, groupId, winText, `${botName} • Bomb Defused`, [{
      name: "quick_reply",
      display_text: "💣 Pasang Bom Baru",
      id: `${prefix}bomb`
    }], quotedMsg, [defuserJid, game.planterJid]);
  }
  if (wireId === game.detonateWire) {
    clearTimeout(game.timer);
    global.bombPvP.delete(groupId);
    const rewardMsg = await distributeReward(game.planterJid, game.planterName, defuserJid, defuserName, game.bet, "explode");
    const boomText = `💥💥 *BOOOOOOOOOMMMMM!!!* 💥💥\n\n` + `💀 @${defuserJid.split("@")[0]} memotong kabel *JEBAKAN DETONATOR*! (${pickedColor})\n` + `🏆 Pemasang bom @${game.planterJid.split("@")[0]} berhasil menjebak dan memenangkan game!\n\n` + `✨ *Reward:* ${rewardMsg}\n\n` + `_Kabel penjinak asli sebenarnya: ${WIRE_COLORS.find(w => w.id === game.defuseWire)?.name}_`;
    return await sendBombCta(sock, ctx, groupId, boomText, `${botName} • Bomb Exploded`, [{
      name: "quick_reply",
      display_text: "🔁 Coba Lagi",
      id: `${prefix}bomb`
    }], quotedMsg, [defuserJid, game.planterJid]);
  }
  const remainingWires = WIRE_COLORS.filter(w => !game.cutWires.has(w.id));
  const remainingSec = Math.max(1, Math.round((game.expireTime - Date.now()) / 1e3));
  const buttons = remainingWires.map(w => ({
    name: "quick_reply",
    display_text: `${w.num}. ${w.name}`,
    id: `${prefix}bomb cut ${w.id}`
  }));
  let neutralText = `✂️ *Kabel Netral Dipotong!* (${pickedColor})\n\n`;
  neutralText += `👤 *Dipotong oleh:* @${defuserJid.split("@")[0]}\n`;
  neutralText += `⚠️ Tidak ada yang terjadi! Bom masih berdetik!\n`;
  neutralText += `⏳ *Sisa Waktu:* ~${remainingSec} Detik lagi\n\n`;
  neutralText += `*Sisa Kabel yang Belum Dipotong:*\n`;
  remainingWires.forEach(w => {
    neutralText += `[${w.num}] ${w.name}\n`;
  });
  neutralText += `\n_Ayo pilih kabel berikutnya!_`;
  return await sendBombCta(sock, ctx, groupId, neutralText, `${botName} • Sisa Waktu: ${remainingSec}s`, buttons, quotedMsg, [defuserJid]);
}
async function distributeReward(winnerJid, winnerName, loserJid, loserName, bet, type) {
  if (typeof db?.ensureUser === "function") {
    if (winnerJid) db.ensureUser(winnerJid, winnerName);
    if (loserJid) db.ensureUser(loserJid, loserName);
  }
  const winner = global.db?.user?.[winnerJid];
  const loser = loserJid ? global.db?.user?.[loserJid] : null;
  let text = "";
  if (bet > 0) {
    if (winner && loser) {
      winner.money = (Number(winner.money) || 0) + bet;
      loser.money = Math.max(0, (Number(loser.money) || 0) - bet);
      winner.exp = (Number(winner.exp) || 0) + 50;
    } else if (winner) {
      winner.money = (Number(winner.money) || 0) + bet;
      winner.exp = (Number(winner.exp) || 0) + 50;
    }
    text = `Pemenang membawa pulang taruhan *Rp ${bet.toLocaleString()}* dan *+50 EXP*!`;
  } else {
    if (winner) {
      winner.money = (Number(winner.money) || 0) + 5e3;
      winner.exp = (Number(winner.exp) || 0) + 35;
    }
    text = `Hadiah kemenangan: *+Rp 5.000* & *+35 EXP*!`;
  }
  if (typeof db?.write === "function" && global.db) {
    db.write(global.db);
  }
  return text;
}