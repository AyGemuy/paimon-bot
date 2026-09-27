import axios from "axios";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL_STATIC = "https://wudysoft.my.id/api/maker/brat/v1";
const BASE_URL_VIDEO = "https://wudysoft.my.id/api/maker/brat/video";

function parseBratFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["video", "vid", "anim", "animated", "gif", "v"].includes(key)) key = "video";
    if (["host", "server", "h"].includes(key)) key = "host";
    if (["pack", "packname", "p"].includes(key)) key = "pack";
    if (["author", "wm", "a"].includes(key)) key = "author";
    if (["emojis", "emoji", "e"].includes(key)) key = "emojis";
    if (["fps", "frame"].includes(key)) key = "fps";
    if (["help"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (!isNaN(rawVal) && rawVal.trim() !== "" && ["host", "fps"].includes(key)) {
        val = Number(rawVal);
      } else {
        val = rawVal;
      }
    }
    flags[key] = val;
  }
  const cleanText = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "brat",
  aliases: ["sbrat", "bratvideo", "bratvid", "bratanim", "bratgif"],
  description: "Buat stiker gaya Brat (Statis & Animasi Video bergerak)",
  category: "Maker",
  limit: true,
  example: "brat text kamu atau brat text kamu --video atau brat text --host 2",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const cmd = (ctx.command || ctx.cmd || "").toLowerCase();
      let rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      if (!rawQuery && ctx.quoted?.text) {
        rawQuery = ctx.quoted.text.trim();
      }
      const {
        flags,
        cleanText
      } = parseBratFlags(rawQuery);
      const isVideoAlias = ["bratvideo", "bratvid", "bratanim", "bratgif"].includes(cmd);
      const isVideoMode = Boolean(flags.video || isVideoAlias);
      if (!cleanText || flags.help) {
        return ctx.reply(`🟩 *BRAT STICKER GENERATOR*\n\n` + `• *Brat Statis (Gambar):*\n` + `  👉 \`${prefix}brat teks kamu di sini\`\n` + `  👉 \`${prefix}brat teks kamu --host 1\` (Host 1-6)\n\n` + `• *Brat Animasi / Video (Bergerak):*\n` + `  👉 \`${prefix}bratvid teks kata demi kata\`\n` + `  👉 \`${prefix}brat teks kamu --video\`\n` + `  👉 \`${prefix}brat teks kamu --video --host 2\` (Host 1-7)\n\n` + `• *Kustom Watermark:*\n` + `  👉 \`${prefix}brat teks kamu | Packname | Author\``);
      }
      await ctx.react("⏳");
      let [mainText, customPack, customAuthor] = cleanText.split("|").map(s => s.trim());
      if (!mainText) mainText = cleanText;
      const exif = {
        packname: flags.pack || customPack || global.bot?.name || "Wudysoft Bot",
        author: flags.author || customAuthor || global.bot?.author?.name || "Brat Maker",
        categories: flags.emojis ? String(flags.emojis).split(",") : ["🟩"]
      };
      let mediaBuffer = null;
      if (isVideoMode) {
        const hostNum = Number(flags.host) || 1;
        const res = await axios.post(BASE_URL_VIDEO, {
          text: mainText,
          host: hostNum
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 6e4
        });
        mediaBuffer = Buffer.from(res.data);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat video Brat dari server.");
        }
        const stickerBuffer = await writeExifVid(mediaBuffer, exif, {
          fps: flags.fps || 16,
          ...flags
        });
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer
        }, {
          quoted: quotedMsg
        });
      } else {
        const hostNum = Number(flags.host) || 1;
        const res = await axios.post(BASE_URL_STATIC, {
          text: mainText,
          host: hostNum
        }, {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        mediaBuffer = Buffer.from(res.data);
        if (!mediaBuffer || mediaBuffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat gambar Brat dari server.");
        }
        const stickerBuffer = await writeExifImg(mediaBuffer, exif, flags);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuffer
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Brat Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Brat Error: ${errorMessage}`);
    }
  }
};