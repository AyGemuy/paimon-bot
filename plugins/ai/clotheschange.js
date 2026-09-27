import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "clotheschange",
  aliases: ["gantibaju", "changeclothes", "clothesai"],
  description: "AI Clothes Change / Ganti Pakaian pada Gambar",
  category: "AI",
  example: "Reply/kirim gambar dengan caption `clotheschange red hoodie`\n\n*Opsi Flag:*\n• `--clothes <deskripsi>` : Detail pakaian\n• `--ar <1:1|9:16|16:9>` : Aspect Ratio\n• `--res <1080p|hd>` : Resolusi\n• `--count <1-4>` : Jumlah output\n• `--model <nama_model>` : Model AI",
  execute: async (sock, ctx, msg) => {
    try {
      let text = ctx.args?.join(" ")?.trim() || "";
      if (!text && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("clotheschange") || firstWord.endsWith("gantibaju") || firstWord.endsWith("changeclothes") || firstWord.endsWith("clothesai")) {
          text = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      if (!text && !isMedia) {
        return ctx.reply(`👗 *CLOTHES CHANGE AI (GANTI BAJU)*\n\n` + `*Cara Penggunaan:*\n` + `• *Ganti Baju pada Foto:*\n` + `  └ Reply/kirim foto dengan caption: \`${ctx.prefix || "."}clotheschange wearing elegant black suit\`\n\n` + `• *Dengan Custom Style & Flags:*\n` + `  └ \`${ctx.prefix || "."}clotheschange a woman in garden --clothes red wedding dress --ar 9:16 --res hd\`\n\n` + `*Daftar Opsi Flag:*\n` + `• \`--clothes <deskripsi>\` : Detail jenis pakaian\n` + `• \`--clothes-img <url_gambar>\` : Referensi gambar baju\n` + `• \`--ar <1:1|9:16|16:9>\` : Aspect Ratio\n` + `• \`--res <1080p|hd>\` : Resolusi\n` + `• \`--count <1-4>\` : Jumlah gambar output\n` + `• \`--model <nama_model>\` : Model AI (Default: clothes_change_ai)`);
      }
      await ctx.react("⏳");
      let prompt = text;
      let clothes = "";
      let clothesImage = "";
      let model = "clothes_change_ai";
      let aspectRatio = "";
      let resolution = "";
      let outputCount = 1;
      if (prompt.includes("--clothes-img")) {
        const parts = prompt.split("--clothes-img");
        prompt = parts[0].trim();
        clothesImage = parts[1]?.trim().split(/\s+/)[0] || "";
      }
      if (prompt.includes("--clothes")) {
        const parts = prompt.split("--clothes");
        prompt = parts[0].trim();
        clothes = parts[1]?.trim().split("--")[0]?.trim() || "";
      }
      if (prompt.includes("--ar") || prompt.includes("--ratio")) {
        const flag = prompt.includes("--ar") ? "--ar" : "--ratio";
        const parts = prompt.split(flag);
        prompt = parts[0].trim();
        aspectRatio = parts[1]?.trim().split(/\s+/)[0] || "";
      }
      if (prompt.includes("--res") || prompt.includes("--resolution")) {
        const flag = prompt.includes("--res") ? "--res" : "--resolution";
        const parts = prompt.split(flag);
        prompt = parts[0].trim();
        resolution = parts[1]?.trim().split(/\s+/)[0] || "";
      }
      if (prompt.includes("--count")) {
        const parts = prompt.split("--count");
        prompt = parts[0].trim();
        outputCount = parseInt(parts[1]?.trim().split(/\s+/)[0]) || 1;
      }
      if (prompt.includes("--model")) {
        const parts = prompt.split("--model");
        prompt = parts[0].trim();
        model = parts[1]?.trim().split(/\s+/)[0] || "clothes_change_ai";
      }
      const body = {
        prompt: prompt || "change clothes",
        model: model,
        outputCount: outputCount
      };
      if (clothes) body.clothes = clothes;
      if (clothesImage) body.clothesImage = clothesImage;
      if (aspectRatio) body.aspectRatio = aspectRatio;
      if (resolution) body.resolution = resolution;
      if (isMedia) {
        const buffer = await ctx.download();
        if (!buffer || !Buffer.isBuffer(buffer)) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh media dari pesan.");
        }
        const uploadRes = await upload(buffer);
        if (!uploadRes?.status || !uploadRes?.url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengunggah gambar: ${uploadRes?.message || "Server upload error"}`);
        }
        body.image = uploadRes.url;
      }
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/clotheschange", body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 12e4
      });
      if (!data || !data.status || !data.result || data.result.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memproses ganti baju: ${data?.message || "API tidak mengembalikan hasil."}`);
      }
      let caption = `✅ *Clothes Change AI Selesai*\n\n`;
      if (prompt) caption += `📝 *Prompt:* ${prompt}\n`;
      if (clothes) caption += `👗 *Clothes:* ${clothes}\n`;
      if (aspectRatio) caption += `📐 *Aspect Ratio:* ${aspectRatio}\n`;
      if (resolution) caption += `🔍 *Resolution:* ${resolution}\n`;
      caption += `🤖 *Model:* ${model}\n`;
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const results = Array.isArray(data.result) ? data.result : [data.result];
      for (let i = 0; i < results.length; i++) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: results[i]
          },
          caption: i === 0 ? caption.trim() : ""
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Clothes Change Error: ${errMsg}`);
    }
  }
};