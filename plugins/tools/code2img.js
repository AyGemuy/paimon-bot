import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function parseBodyFlags(rawText) {
  const rest = {};
  let version = "6";
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g;
  let match;
  while ((match = flagRegex.exec(rawText)) !== null) {
    const key = match[1];
    let val = match[2] ? match[2].trim() : true;
    if (typeof val === "string" && (val.startsWith('"') || val.startsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (typeof val === "string" && !isNaN(val) && val !== "") val = Number(val);
    const vMatch = key.match(/^v(\d+)$/i);
    if (vMatch) {
      version = vMatch[1];
    } else if (key.toLowerCase() === "version") {
      version = String(val);
    } else {
      rest[key] = val;
    }
  }
  const code = rawText.replace(/--([a-zA-Z0-9_-]+)(?:\s+("[^"]*"|'[^']*'|[^\s--]+))?/g, "").trim();
  return {
    version: version,
    rest: rest,
    code: code
  };
}
export default {
  name: "code2img",
  aliases: ["carbon", "carboncode", "c2img", "codeimage"],
  description: "Mengubah potongan kode menjadi gambar estetik dengan full body override (--flag)",
  category: "Maker",
  limit: true,
  example: "code2img --v6 --theme dracula console.log('Hello World')",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = (ctx.query || ctx.text || "").trim();
      const quotedText = ctx.quoted?.text || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        version,
        rest,
        code
      } = parseBodyFlags(rawText);
      const codeText = code || quotedText.trim();
      if (!codeText) {
        return ctx.reply(`💻 *CODE TO IMAGE GENERATOR (CARBON)*\n\n` + `*Cara Penggunaan:*\n` + `• Default (Versi v6):\n` + `  \`${prefix}code2img <kode_di_sini>\`\n` + `  \`${prefix}code2img console.log("Hello World")\`\n\n` + `• Override Body Parameter via Flag \`--\`:\n` + `  \`${prefix}code2img --v6 --theme dracula <kode>\`\n` + `  \`${prefix}code2img --v7 --theme monokai --language javascript --lineNumbers true <kode>\`\n\n` + `• *Atau balas/reply pesan teks berisi kode dengan caption:* \`${prefix}code2img\``);
      }
      await ctx.react("⏳");
      const apiUrl = `https://wudysoft.my.id/api/maker/carbon/v${version}`;
      const bodyPayload = {
        code: codeText,
        ...rest
      };
      const res = await axios.post(apiUrl, bodyPayload, {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const bufferImage = Buffer.from(res.data);
      const overrideKeys = Object.keys(rest);
      const overrideInfo = overrideKeys.length > 0 ? overrideKeys.map(k => `│ ⚙️ *${k}:* ${rest[k]}`).join("\n") : "│ 🎨 *Tema:* Default";
      const captionText = `💻 *CARBON CODE TO IMAGE*\n\n` + `╭───『 *INFORMASI PAYLOAD* 』\n` + `│ 🏷️ *Versi API:* Carbon v${version}\n` + `${overrideInfo}\n` + `│ 📝 *Total Karakter:* ${codeText.length} huruf\n` + `╰──────────────────`;
      await sock.sendMessage(ctx.id, {
        image: bufferImage,
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Code2Img Error: ${errMsg}`);
    }
  }
};