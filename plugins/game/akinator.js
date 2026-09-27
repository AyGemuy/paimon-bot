import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
global.akinatorSession = global.akinatorSession || new Map();
const API_URL = "https://wudysoft.my.id/api/game/akinator/v1";
const AKINATOR_AVATAR = "https://en.akinator.com/bundles/elokencesite/images/akitude_defaut.png";
async function fetchMediaBuffer(url) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 15e3
    });
    if (res.data) return Buffer.from(res.data);
  } catch (err) {
    console.error("[Fetch Media Buffer Error]:", err.message);
  }
  return null;
}

function getAnswerId(input) {
  const text = String(input || "").trim().toLowerCase();
  if (["0", "iya", "ya", "yes", "y"].includes(text)) return "0";
  if (["1", "tidak", "bukan", "no", "t", "ga", "gak"].includes(text)) return "1";
  if (["2", "tidak tahu", "tidak tau", "gatau", "gatahu", "dont know", "unknown"].includes(text)) return "2";
  if (["3", "mungkin", "bisa jadi", "probably"].includes(text)) return "3";
  if (["4", "mungkin tidak", "kayaknya bukan", "probably not"].includes(text)) return "4";
  return null;
}
async function sendAkinatorQuestion(sock, ctx, chatId, session, quotedMsg, prefix = ".") {
  const choices = session.choices && session.choices.length > 0 ? session.choices : [{
    id: "0",
    text: "Iya"
  }, {
    id: "1",
    text: "Tidak"
  }, {
    id: "2",
    text: "Tidak tahu"
  }, {
    id: "3",
    text: "Mungkin"
  }, {
    id: "4",
    text: "Mungkin tidak"
  }];
  const choiceRows = choices.map(c => ({
    title: `[${c.id}] ${c.text}`,
    id: `${prefix}akinator ${c.id}`,
    description: `Pilih opsi jawaban: ${c.text}`
  }));
  const listSections = [{
    title: "🔮 DAFTAR PILIHAN JAWABAN",
    rows: choiceRows
  }];
  const progressPercent = Math.min(Math.round(parseFloat(session.progression || 0)), 100);
  const bodyText = `🧞‍♂️ *AKINATOR - THE GENIE GUESSER*\n\n` + `╭───『 *PERTANYAAN #${(session.step || 0) + 1}* 』\n` + `│ ❓ *${session.question}*\n` + `│ 📊 *Progres Tebakan:* ${progressPercent}%\n` + `╰──────────────────\n\n` + `📋 *Pilihan Jawaban:*\n` + `• *0* ➔ Iya\n` + `• *1* ➔ Tidak\n` + `• *2* ➔ Tidak tahu\n` + `• *3* ➔ Mungkin\n` + `• *4* ➔ Mungkin tidak\n\n` + `👉 *Reply pesan ini dengan angka 0-4 atau gunakan tombol di bawah:*`;
  const footerText = `${global.bot?.name || "WudysoftBot"} • Step ${(session.step || 0) + 1} • Progres ${progressPercent}%`;
  const buttons = [{
    name: "single_select",
    title: "🔮 PILIH JAWABAN",
    sections: listSections
  }, {
    name: "quick_reply",
    display_text: "👍 Iya",
    id: `${prefix}akinator 0`
  }, {
    name: "quick_reply",
    display_text: "👎 Tidak",
    id: `${prefix}akinator 1`
  }, {
    name: "quick_reply",
    display_text: "🚪 Akhiri",
    id: `${prefix}akinator --end`
  }];
  const avatarBuffer = await fetchMediaBuffer(AKINATOR_AVATAR);
  let sentMsg = null;
  if (typeof ctx?.sendCta === "function") {
    sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
      title: "乂 AKINATOR GENIE 乂",
      subtitle: `Progres: ${progressPercent}%`,
      ...avatarBuffer ? {
        media: avatarBuffer,
        mediaType: "image"
      } : {},
      quoted: quotedMsg
    });
  } else {
    sentMsg = await sock.sendMessage(chatId, {
      text: bodyText
    }, {
      quoted: quotedMsg
    });
  }
  if (sentMsg) {
    session.questionMsg = sentMsg;
    session.questionMsgId = sentMsg?.key?.id;
  }
  return sentMsg;
}
export default {
  name: "akinator",
  aliases: ["aki", "tebakkarakter", "genie"],
  description: "Akinator Jin Jenius yang dapat menebak karakter/tokoh yang Anda pikirkan",
  category: "Game",
  limit: true,
  example: "akinator atau akinator 0 (untuk menjawab)",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const chatId = ctx?.id || msg?.key?.remoteJid;
      if (!chatId || !global.akinatorSession.has(chatId)) return;
      const isFromMe = Boolean(msg?.key?.fromMe || ctx?.isFromMe);
      if (isFromMe) return;
      const session = global.akinatorSession.get(chatId);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (!quotedStanzaId || quotedStanzaId !== session.questionMsgId) {
        return;
      }
      const userText = (ctx?.text || ctx?.query || msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || "").trim().toLowerCase();
      if (userText.startsWith(`${ctx?.prefix || "."}akinator`)) return;
      const choiceId = getAnswerId(userText);
      if (choiceId === null) {
        if (typeof ctx?.react === "function") await ctx.react("❓");
        await sock.sendMessage(chatId, {
          text: `❌ *Pilihan tidak valid!*\nKetik angka *0* sampai *4* (atau: ya, tidak, tidak tahu, mungkin, mungkin tidak).`
        }, {
          quoted: msg
        });
        return true;
      }
      if (typeof ctx?.react === "function") await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "step",
        id: session.id,
        answer: choiceId
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (data?.finished === true) {
        clearTimeout(session.timer);
        global.akinatorSession.delete(chatId);
        const charName = data.name_proposition || "Karakter Tidak Diketahui";
        const charDesc = data.description_proposition || "-";
        const charPhoto = data.photo || "";
        const winMessage = `🧞‍♂️ *AKINATOR TELAH MENEBAK KARAKTERMU!*\n\n` + `╭───『 *HASIL TEBAKAN* 』\n` + `│ 👤 *Nama:* *${charName}*\n` + `│ 📝 *Deskripsi:* _${charDesc}_\n` + `│ 🔢 *Total Langkah:* ${data.step || session.step} pertanyaan\n` + `╰──────────────────\n\n` + `✨ *Apakah tebakan Akinator tepat sasaran? Hebat kan!*`;
        const photoBuffer = await fetchMediaBuffer(charPhoto);
        if (photoBuffer) {
          await sock.sendMessage(chatId, {
            image: photoBuffer,
            caption: winMessage
          }, {
            quoted: session.questionMsg || msg
          });
        } else {
          await sock.sendMessage(chatId, {
            text: winMessage
          }, {
            quoted: session.questionMsg || msg
          });
        }
        if (typeof ctx?.react === "function") await ctx.react("🧞‍♂️");
        return true;
      }
      if (data?.question) {
        clearTimeout(session.timer);
        const newTimer = setTimeout(async () => {
          if (global.akinatorSession.has(chatId)) {
            const currentSession = global.akinatorSession.get(chatId);
            global.akinatorSession.delete(chatId);
            await sock.sendMessage(chatId, {
              text: `⏰ *Waktu Bermain Akinator Habis!*\nSesi permainan ditutup karena tidak ada respon.`
            }, {
              quoted: currentSession?.questionMsg || null
            });
          }
        }, 180 * 1e3);
        session.step = data.step;
        session.question = data.question;
        session.progression = data.progression;
        session.choices = data.choices || session.choices;
        session.timer = newTimer;
        await sendAkinatorQuestion(sock, ctx, chatId, session, session.questionMsg || msg, ctx?.prefix || ".");
        if (typeof ctx?.react === "function") await ctx.react("✨");
        return true;
      }
    } catch (e) {
      console.error("[AKINATOR BEFORE ERROR]:", e.message);
    }
  },
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim().toLowerCase();
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const chatId = ctx.id;
      if (rawText.includes("--end") || rawText.includes("--batal") || rawText.includes("--reset") || rawText.includes("nyerah") || rawText.includes("stop")) {
        if (global.akinatorSession.has(chatId)) {
          const session = global.akinatorSession.get(chatId);
          clearTimeout(session.timer);
          global.akinatorSession.delete(chatId);
          return await sock.sendMessage(chatId, {
            text: "🚪 *Permainan Akinator berhasil dihentikan.*"
          }, {
            quoted: session.questionMsg || quotedMsg
          });
        }
        return ctx.reply("❌ Tidak ada sesi permainan Akinator yang sedang aktif.");
      }
      const choiceId = getAnswerId(rawText);
      if (global.akinatorSession.has(chatId) && choiceId !== null) {
        await ctx.react("⏳");
        const session = global.akinatorSession.get(chatId);
        const {
          data
        } = await axios.post(API_URL, {
          action: "step",
          id: session.id,
          answer: choiceId
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (data?.finished === true) {
          clearTimeout(session.timer);
          global.akinatorSession.delete(chatId);
          const charName = data.name_proposition || "Karakter";
          const charDesc = data.description_proposition || "-";
          const charPhoto = data.photo || "";
          const winMessage = `🧞‍♂️ *AKINATOR TELAH MENEBAK KARAKTERMU!*\n\n` + `╭───『 *HASIL TEBAKAN* 』\n` + `│ 👤 *Nama:* *${charName}*\n` + `│ 📝 *Deskripsi:* _${charDesc}_\n` + `│ 🔢 *Total Langkah:* ${data.step || session.step} pertanyaan\n` + `╰──────────────────\n\n` + `✨ *Tebakan Akinator tepat sasaran!*`;
          const photoBuffer = await fetchMediaBuffer(charPhoto);
          if (photoBuffer) {
            await sock.sendMessage(chatId, {
              image: photoBuffer,
              caption: winMessage
            }, {
              quoted: session.questionMsg || quotedMsg
            });
          } else {
            await sock.sendMessage(chatId, {
              text: winMessage
            }, {
              quoted: session.questionMsg || quotedMsg
            });
          }
          await ctx.react("🎉");
          return;
        }
        if (data?.question) {
          clearTimeout(session.timer);
          const newTimer = setTimeout(async () => {
            if (global.akinatorSession.has(chatId)) {
              const currentSession = global.akinatorSession.get(chatId);
              global.akinatorSession.delete(chatId);
              await sock.sendMessage(chatId, {
                text: `⏰ *Waktu Bermain Akinator Habis!*\nSesi ditutup karena tidak ada respon.`
              }, {
                quoted: currentSession?.questionMsg || null
              });
            }
          }, 180 * 1e3);
          session.step = data.step;
          session.question = data.question;
          session.progression = data.progression;
          session.choices = data.choices || session.choices;
          session.timer = newTimer;
          await sendAkinatorQuestion(sock, ctx, chatId, session, session.questionMsg || quotedMsg, prefix);
          await ctx.react("✅");
          return;
        }
      }
      if (global.akinatorSession.has(chatId)) {
        const session = global.akinatorSession.get(chatId);
        const warningBody = `⚠️ *Masih ada sesi Akinator yang sedang aktif!*\n\n` + `❓ *Pertanyaan:* ${session.question}\n` + `👉 *Reply pesan soal* dengan angka 0-4 atau gunakan tombol di bawah:`;
        const warningButtons = [{
          name: "quick_reply",
          display_text: "👍 Iya",
          id: `${prefix}akinator 0`
        }, {
          name: "quick_reply",
          display_text: "👎 Tidak",
          id: `${prefix}akinator 1`
        }, {
          name: "quick_reply",
          display_text: "🚪 Akhiri Game",
          id: `${prefix}akinator --end`
        }];
        return await ctx.sendCta(warningBody, `${global.bot?.name || "WudysoftBot"} • Game Sedang Berjalan`, warningButtons, {
          title: "乂 AKINATOR SEDANG BERJALAN 乂",
          quoted: session.questionMsg || quotedMsg
        });
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "start"
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data?.id || !data?.question) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memulai sesi Akinator dari server. Silakan coba lagi.");
      }
      const TIMEOUT_SECONDS = 180;
      const timer = setTimeout(async () => {
        if (global.akinatorSession.has(chatId)) {
          const activeSession = global.akinatorSession.get(chatId);
          global.akinatorSession.delete(chatId);
          await sock.sendMessage(chatId, {
            text: `⏰ *Waktu Bermain Akinator Habis!*\nSesi ditutup karena tidak ada aktivitas.`
          }, {
            quoted: activeSession?.questionMsg || null
          });
        }
      }, TIMEOUT_SECONDS * 1e3);
      const sessionObj = {
        id: data.id,
        step: data.step || 0,
        question: data.question,
        progression: data.progression || 0,
        choices: data.choices || [],
        timer: timer
      };
      global.akinatorSession.set(chatId, sessionObj);
      await sendAkinatorQuestion(sock, ctx, chatId, sessionObj, quotedMsg, prefix);
      await ctx.react("🧞‍♂️");
    } catch (error) {
      console.error("[Akinator Execute Error]:", error);
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Akinator Error: ${errMsg}`);
    }
  }
};