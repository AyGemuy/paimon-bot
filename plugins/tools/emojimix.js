import axios from "axios";
import {
  writeExifImg
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function splitEmojis(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", {
      granularity: "grapheme"
    });
    return [...segmenter.segment(text)].map(s => s.segment);
  }
  return Array.from(text);
}

function extractEmojis(text) {
  if (!text || typeof text !== "string") return [];
  const graphemes = splitEmojis(text);
  const emojiRegex = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/u;
  return graphemes.filter(char => emojiRegex.test(char) && !/^[\w\s\d.,!?:;@#$%^&*()_+=~`|\\/[\]{}<>-]$/.test(char));
}
export default {
  name: "emojimix",
  aliases: ["mix", "emomix", "semojimix", "mixemoji"],
  description: "Kombinasikan emoji menjadi stiker WhatsApp (Support Reply / Input)",
  category: "Sticker",
  example: "emojimix 😭+😂 atau reply emoji dengan .mix 😎",
  execute: async (sock, ctx, msg) => {
    const bot = global.bot || {};
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
    const chatId = ctx.chat || ctx.id;
    const argsRaw = (ctx.query || (ctx.args ? ctx.args.join("") : "")).replace(/\+/g, "").trim();
    const argsEmojis = extractEmojis(argsRaw);
    const quotedText = ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.msg?.caption || ctx.quoted?.msg?.text || "";
    const quotedEmojis = extractEmojis(quotedText);
    let targetEmojis = [];
    if (quotedEmojis.length > 0 && argsEmojis.length > 0) {
      targetEmojis = [quotedEmojis[0], argsEmojis[0]];
    } else if (argsEmojis.length > 0) {
      targetEmojis = argsEmojis;
    } else if (quotedEmojis.length > 0) {
      targetEmojis = quotedEmojis;
    }
    if (targetEmojis.length === 0) {
      return ctx.reply(`🎨 *EMOJI MIX MAKER*\n\n` + `Silakan masukkan emoji atau reply pesan yang ada emojinya!\n\n` + `👉 *Contoh Penggunaan:*\n` + `• \`${prefix}emojimix 😁\` _(Otomatis digandakan jadi 😁😁)_\n` + `• \`${prefix}emojimix 😭+😂\` _(Kombinasi 2 emoji)_\n` + `• _Reply pesan emoji lalu ketik:_ \`${prefix}mix\`\n` + `• _Reply pesan emoji (misal: 😭) lalu ketik:_ \`${prefix}mix 😎\` _(Jadi 😭 + 😎)_\n\n` + `_${bot.footer || "Wudysoft Bot • Multi-Device"}_`);
    }
    if (targetEmojis.length === 1) {
      targetEmojis = [targetEmojis[0], targetEmojis[0]];
    }
    const finalEmoji = targetEmojis.slice(0, 2).join("");
    try {
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const res = await axios.get(`https://wudysoft.my.id/api/misc/emojimix/v4?emoji=${encodeURIComponent(finalEmoji)}`, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "Mozilla/5.0"
        },
        timeout: 2e4
      });
      const buffer = Buffer.from(res.data);
      const exif = {
        packname: bot.sticker?.packname || bot.name || "Wudysoft Bot",
        author: bot.sticker?.author || (bot.author?.number ? `wa.me/${bot.author.number}` : "Wudysoft Bot"),
        categories: ["🎨", "🤖"]
      };
      const sticker = await writeExifImg(buffer, exif, false);
      await sock.sendMessage(chatId, {
        sticker: sticker,
        contextInfo: bot.utils?.contextInfo || undefined
      }, {
        quoted: quotedMsg
      });
      if (typeof ctx.react === "function") await ctx.react("✅");
    } catch (error) {
      console.error("[Emojimix Error]:", error);
      if (typeof ctx.react === "function") await ctx.react("❌");
      return ctx.reply(`❌ Gagal membuat emojimix: Kombinasi emoji *${targetEmojis.slice(0, 2).join(" + ")}* tidak tersedia atau tidak didukung oleh sistem Google Kitchen.`);
    }
  }
};