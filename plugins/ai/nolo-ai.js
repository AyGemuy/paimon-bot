import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "noloai",
  aliases: ["noloai", "nolo"],
  description: "Chat dengan Nolo AI (Custom State & Direct Image Support) via CTA Response",
  category: "AI",
  limit: true,
  example: "noloai siapa presiden pertama indonesia? atau reply gambar dengan caption nolo analisis",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (firstWord.endsWith("noloai") || firstWord.endsWith("nolo")) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText && !isMedia) {
        return ctx.reply(`🤖 *NOLO AI ASSISTANT*\n\n` + `📌 *Format Standar:*\n` + `👉 \`${prefix}noloai <pertanyaan>\`\n\n` + `📌 *Format dengan Custom State:*\n` + `👉 \`${prefix}nolo <pertanyaan> --state <string_state>\`\n\n` + `🖼️ *Kirim/balas gambar dengan caption:*\n` + `👉 \`${prefix}nolo <analisis gambar>\``);
      }
      await ctx.react("💭");
      let state = null;
      let prompt = rawText;
      const stateMatch = rawText.match(/--state\s+([^\s]+)/i);
      if (stateMatch) {
        state = stateMatch[1];
        prompt = rawText.replace(stateMatch[0], "").trim();
      }
      const payload = {
        prompt: prompt || "Jelaskan gambar ini secara detail"
      };
      if (state) payload.state = state;
      let uploadedImageUrl = null;
      if (isMedia) {
        const buffer = await ctx.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            uploadedImageUrl = uploadRes.url;
            payload.image = uploadRes.url;
          } else {
            payload.image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
          }
        }
      }
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/ai/nolo-ai", payload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      if (!data || !data.status) {
        throw new Error(data?.message || "Gagal mendapatkan balasan dari Nolo AI.");
      }
      const answerText = data.result?.text || data.result?.job_result?.cleaned_text || "Tidak ada balasan.";
      const creditsLeft = data.result?.credits_left ?? "-";
      const title = data.result?.title || "Nolo AI Response";
      const returnedState = data.state || "";
      const usageChunk = data.chunks?.find(c => c.type === "usage");
      const promptTokens = usageChunk?.promptTokens ?? "-";
      const completionTokens = usageChunk?.completionTokens ?? "-";
      const bodyText = `🤖 *NOLO AI RESPONSE*\n\n` + `📌 *Judul:* ${title}\n` + `📊 *Credits Sisa:* ${creditsLeft}\n` + `🔢 *Tokens:* Prompt: ${promptTokens} | Completion: ${completionTokens}\n` + `────────────────────────\n\n` + `${answerText}\n\n` + `_💡 Klik tombol copy di bawah untuk melanjutkan sesi percakapan._`;
      const footerText = `${botName} • Nolo AI Assistant`;
      const buttons = [];
      if (returnedState && returnedState !== "-") {
        const nextCommand = `${prefix}nolo <tulis_pertanyaan_lanjutan> --state ${returnedState}`;
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Lanjutan Sesi",
          copy_code: nextCommand
        }, {
          name: "cta_copy",
          display_text: "🔑 Salin State Token",
          copy_code: returnedState
        });
      }
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, {
          title: `乂 NOLO AI - ${title.toUpperCase()} 乂`,
          subtitle: `Sisa Credits: ${creditsLeft}`,
          media: uploadedImageUrl || null,
          quoted: quotedMsg
        });
      } else if (uploadedImageUrl) {
        await sock.sendMessage(ctx.id, {
          image: {
            url: uploadedImageUrl
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          text: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✨");
    } catch (error) {
      await ctx.react("❌");
      const errMsg = error.response?.data?.message || error.response?.data?.error || (typeof error.response?.data === "string" ? error.response.data : null) || error.message;
      ctx.reply(`❌ Nolo AI Error: ${errMsg}`);
    }
  }
};