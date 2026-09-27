import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = "https://wudysoft.my.id/api/ai/img2img/ghibli/v5";
const DEFAULT_PROMPT = "Ghibli art style";

function parseFlags(input) {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["image", "img", "imageurl"].includes(lowerKey)) key = "imageUrl";
    if (["prompt", "text", "caption"].includes(lowerKey)) key = "prompt";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanPrompt = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanPrompt: cleanPrompt
  };
}
export default {
  name: "ghibliart",
  aliases: ["ghibliartai", "ghibliv5"],
  description: "AI Ghibli Art Generator Direct Execution (v5 API)",
  category: "AI",
  limit: true,
  example: "ghibliart add hat --imageUrl https://... atau reply gambar dengan caption ghibliart convert to ghibli style",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["ghibliart", "ghibliartai", "ghibliv5"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`🎨 *GHIBLI ART GENERATOR*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Kirim/reply gambar dengan caption: \`${prefix}ghibliart add hat\`\n` + `  👉 Atau gunakan URL gambar: \`${prefix}ghibliart convert to anime --imageUrl <url>\`\n\n` + `• *Opsi Flag & Body Override:*\n` + `  • \`--prompt <teks_instruksi>\` (Instruksi perubahan pada gambar)\n` + `  • \`--imageUrl <url>\` (URL gambar langsung)\n` + `  • \`--body <json_string>\` (Override payload JSON secara eksplisit)`);
      }
      await ctx.react("⏳");
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      let uploadedImageUrl = flags.imageUrl || null;
      if (isMedia && !uploadedImageUrl) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
          } else {
            await ctx.react("❌");
            return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
          }
        }
      }
      if (!uploadedImageUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Kirim/reply gambar atau masukkan URL gambar via flag `--imageUrl <url>`.");
      }
      const userPrompt = flags.prompt || cleanPrompt || DEFAULT_PROMPT;
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[GHIBLIART] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        prompt: userPrompt,
        imageUrl: uploadedImageUrl,
        ...flags,
        ...bodyOverride
      };
      const response = await axios.post(BASE_URL, payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const resData = response.data;
      if (resData?.state === "fail" || resData?.failMsg) {
        throw new Error(resData?.failMsg || "Gagal memproses gambar pada GhibliArt server.");
      }
      const resultUrl = resData?.imageUrl || resData?.result;
      if (!resultUrl) {
        throw new Error("Tidak ada URL gambar hasil yang dikembalikan oleh server.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const imageBuffer = Buffer.from(imgRes.data);
      if (!imageBuffer || imageBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar hasil generasi kosong atau gagal diunduh.");
      }
      const caption = `🎨 *Ghibli Art AI Selesai*\n\n` + `📝 *Prompt:* ${userPrompt}\n` + `🆔 *UUID:* \`${resData?.uuid || "-"}\``;
      await sock.sendMessage(ctx.id, {
        image: imageBuffer,
        caption: caption.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.failMsg || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ GhibliArt Error: ${errorMessage}`);
    }
  }
};