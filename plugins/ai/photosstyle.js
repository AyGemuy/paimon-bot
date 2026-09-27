import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = "https://wudysoft.my.id/api/ai/img2img/ghibli/v17";
const VALID_TEMPLATES = ["photo-to-ghibli-anime", "photo-to-cubism", "photo-to-rick-and-morty", "photo-to-gta", "photo-to-sims", "photo-to-south-park-character", "photo-to-claymation"];
const DEFAULT_TEMPLATE = "photo-to-ghibli-anime";

function formatTemplateTitle(str = "") {
  return str.replace(/^photo-to-/, "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["image", "img", "imageurl"].includes(lowerKey)) key = "imageUrl";
    if (["temp", "template_id", "style", "t"].includes(lowerKey)) key = "template";
    if (["ratio", "ar", "aspectratio"].includes(lowerKey)) key = "aspectRatio";
    if (["list", "l", "styles", "menu"].includes(lowerKey)) key = "list";
    if (["help", "h"].includes(lowerKey)) key = "help";
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

function matchTemplate(query = "") {
  if (!query) return DEFAULT_TEMPLATE;
  const q = query.toLowerCase().trim();
  if (VALID_TEMPLATES.includes(q)) return q;
  const found = VALID_TEMPLATES.find(t => {
    const clean = t.replace("photo-to-", "").replace(/-/g, "");
    const search = q.replace(/[-_\s]/g, "");
    return t.includes(search) || clean.includes(search);
  });
  return found || DEFAULT_TEMPLATE;
}
export default {
  name: "photosstyle",
  aliases: ["photostyle", "ghibliv17", "photosstylelist"],
  description: "AI Image-to-Image Styles (PhotosStyle v17) via Interactive CTA UI",
  category: "AI",
  limit: true,
  example: "photosstyle --template gta atau reply gambar dengan caption photosstyle --template rick-and-morty",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["photosstyle", "photostyle", "ghibliv17", "photosstylelist"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const isMedia = ctx.isMedia || ctx.quoted?.isMedia;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const isListReq = flags.list || ["list", "templates", "template", "styles"].includes(cleanPrompt.toLowerCase()) || ctx.command?.toLowerCase() === "photosstylelist";
      if (isListReq) {
        await ctx.react("⏳");
        const sections = [{
          title: `${botName} • PhotosStyle Templates`,
          rows: VALID_TEMPLATES.map(t => ({
            title: `🎨 ${formatTemplateTitle(t)}`,
            description: `ID: ${t} • Ketuk untuk memilih`,
            id: `${prefix}photosstyle --template ${t}`
          }))
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎨 PILIH STYLE (${VALID_TEMPLATES.length})`,
            sections: sections
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📌 Salin Default Style ID",
            id: "copy_default_style",
            copy_code: DEFAULT_TEMPLATE
          })
        }];
        const bodyText = `🖼️ *PHOTOSSTYLE AI TEMPLATES*\n\n` + `Pilih gaya / style di bawah untuk diubah dari foto kamu:\n` + `• *Total Style:* ${VALID_TEMPLATES.length} Template\n` + `• *Default Ratio:* \`2:3\`\n\n` + `_Klik tombol di bawah untuk memilih style secara langsung:_`;
        const footerText = `${botName} • PhotosStyle v17 Engine`;
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • PhotosStyle`,
              button_title: "🎨 Buka Daftar Style"
            },
            limited_time_offer: {
              text: `✦ ${botName} - PhotosStyle AI ✦`,
              url: "",
              copy_code: "",
              expiration_time: Date.now() + 3600 * 1e3
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyText, footerText, buttons, options);
        } else {
          let fallbackMsg = `🎨 *DAFTAR TEMPLATE PHOTOSSTYLE*\n\n`;
          fallbackMsg += VALID_TEMPLATES.map(t => `• *${formatTemplateTitle(t)}*\n  ID: \`${t}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      if (!rawText && !isMedia) {
        return ctx.reply(`🖼️ *PHOTOSSTYLE AI GENERATOR*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Reply/kirim gambar dengan caption: \`${prefix}photosstyle --template gta\`\n` + `  👉 Custom Ratio: \`${prefix}photosstyle --template cubism --ratio 1:1\`\n\n` + `• *Lihat Daftar Style (CTA UI):*\n` + `  👉 \`${prefix}photosstyle --list\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--template <nama|id>\` (Pilih style: gta, anime, cubism, dll)\n` + `  • \`--ratio <2:3|1:1|16:9>\` (Default: \`2:3\`)\n` + `  • \`--imageUrl <url>\` (Gunakan URL gambar langsung)\n` + `  • \`--body <json_string>\` (Override payload JSON)`);
      }
      const selectedTemplate = matchTemplate(flags.template || cleanPrompt);
      const selectedTitle = formatTemplateTitle(selectedTemplate);
      if (!isMedia && !flags.imageUrl) {
        const infoBody = `🎨 *STYLE TERPILIH: ${selectedTitle.toUpperCase()}*\n\n` + `╭───『 *DETAIL STYLE* 』\n` + `│ 🏷️ *Nama:* ${selectedTitle}\n` + `│ 🆔 *Style ID:* \`${selectedTemplate}\`\n` + `│ 📐 *Aspect Ratio:* \`${flags.aspectRatio || "2:3"}\`\n` + `╰──────────────────\n\n` + `📸 *Langkah Selanjutnya:*\n` + `Kirim atau reply foto/gambar Anda dengan caption:\n` + `👉 \`${prefix}photosstyle --template ${selectedTemplate}\``;
        const infoButtons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: `📋 Salin Style ID (${selectedTitle})`,
            id: "copy_selected_style_id",
            copy_code: selectedTemplate
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎨 Pilih Style Lain",
            id: `${prefix}photosstyle --list`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(infoBody, `${botName} • PhotosStyle AI`, infoButtons, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(infoBody);
        }
      }
      await ctx.react("⏳");
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
        return ctx.reply("❌ Gambar tidak valid. Kirim/reply gambar atau masukkan URL gambar via flag `--imageUrl <url>`.");
      }
      let bodyOverride = {};
      if (flags.body) {
        try {
          bodyOverride = typeof flags.body === "string" ? JSON.parse(flags.body) : flags.body;
          delete flags.body;
        } catch (e) {
          console.error("[PHOTOSSTYLE] Invalid JSON in --body flag:", e.message);
        }
      }
      const payload = {
        template: selectedTemplate,
        imageUrl: uploadedImageUrl,
        aspectRatio: flags.aspectRatio || "2:3",
        category: flags.category || selectedTemplate,
        credit: String(flags.credit || "1"),
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
      const resultUrl = resData?.imgUrl || resData?.result || resData?.data?.url;
      if (!resultUrl) {
        throw new Error(resData?.message || "Gagal mendapatkan URL hasil gambar dari PhotosStyle server.");
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
      const resultCaption = `🖼️ *PHOTOSSTYLE AI IMAGE GENERATED*\n\n` + `╭───『 *INFORMASI HASIL* 』\n` + `│ 🎨 *Style:* ${selectedTitle}\n` + `│ 🆔 *Style ID:* \`${selectedTemplate}\`\n` + `│ 📐 *Aspect Ratio:* \`${payload.aspectRatio}\`\n` + `│ ⚡ *Task ID:* \`${resData?.id || "-"}\`\n` + `╰──────────────────\n\n` + `_${botName} • AI Image Transformation Engine_`;
      const resultButtons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: `📋 Salin Style ID (${selectedTitle})`,
          id: "copy_style_id",
          copy_code: selectedTemplate
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎨 Ganti Style Lain",
          id: `${prefix}photosstyle --list`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(resultCaption, `${botName} • PhotosStyle AI`, resultButtons, {
          image: imageBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: imageBuffer,
          caption: resultCaption.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[PhotosStyle Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ PhotosStyle Error: ${errorMessage}`);
    }
  }
};