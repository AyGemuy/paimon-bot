import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = "https://wudysoft.my.id/api/ai/img2img/ghibli/v16";
const DEFAULT_TEMPLATE = "69270b334335d0214b9a5c28";

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
    if (["list", "l", "templates", "menu"].includes(lowerKey)) key = "list";
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
async function getTemplates() {
  const {
    data
  } = await axios.post(BASE_URL, {
    action: "templates"
  }, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    timeout: 3e4
  });
  return data?.result || data?.templates || data?.data || [];
}
export default {
  name: "liftstory",
  aliases: ["liftstoryai", "ghibliv16", "listtemplate", "listtemplates"],
  description: "AI Image-to-Image Styles & Templates via LiftStory Engine dengan CTA UI List",
  category: "AI",
  limit: true,
  example: "liftstory --template Lego atau reply gambar dengan caption liftstory --template Cyberpunk",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["liftstory", "liftstoryai", "ghibliv16", "listtemplate", "listtemplates"].some(a => firstWord.endsWith(a))) {
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
      const isListReq = flags.list || ["list", "templates", "template"].includes(cleanPrompt.toLowerCase()) || ["listtemplate", "listtemplates"].includes(ctx.command?.toLowerCase());
      if (isListReq) {
        await ctx.react("⏳");
        const templates = await getTemplates();
        if (!templates.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil daftar template dari server.");
        }
        const uniqueTemplates = [];
        const seen = new Set();
        for (const t of templates) {
          if (!seen.has(t.id)) {
            seen.add(t.id);
            uniqueTemplates.push(t);
          }
        }
        const categorized = {};
        for (const t of uniqueTemplates) {
          const catName = t.category || "General";
          if (!categorized[catName]) categorized[catName] = [];
          categorized[catName].push(t);
        }
        const sections = Object.keys(categorized).map(cat => ({
          title: `🎨 KATEGORI: ${cat.toUpperCase()}`,
          rows: categorized[cat].map(t => ({
            title: t.name.slice(0, 24),
            description: `ID: ${t.id} • Gunakan gaya ini`,
            id: `${prefix}liftstory --template ${t.id}`
          }))
        }));
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `🎨 PILIH TEMPLATE (${uniqueTemplates.length})`,
            sections: sections
          })
        }, {
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: "📌 Salin Default Template ID",
            id: "copy_default",
            copy_code: DEFAULT_TEMPLATE
          })
        }];
        const bodyText = `🖼️ *LIFTSTORY AI TEMPLATES LIST*\n\n` + `• *Total Template:* ${uniqueTemplates.length} Style\n` + `• *Total Kategori:* ${Object.keys(categorized).length} Kategori\n\n` + `_Pilih template pada menu di bawah untuk menyalin ID atau langsung menerapkan ke gambar:_`;
        const footerText = `${botName} • LiftStory AI Engine`;
        const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
        const options = {
          image: bannerMedia,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Select Style`,
              button_title: "🎨 Buka Daftar Template"
            },
            limited_time_offer: {
              text: `✦ ${botName} - LiftStory AI ✦`,
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
          let fallbackMsg = `🎨 *DAFTAR TEMPLATE LIFTSTORY AI*\n\n`;
          fallbackMsg += uniqueTemplates.map(t => `• *${t.name}* (${t.category})\n  ID: \`${t.id}\``).join("\n\n");
          await ctx.reply(fallbackMsg);
        }
        await ctx.react("✅");
        return;
      }
      if (!rawText && !isMedia) {
        return ctx.reply(`🖼️ *LIFTSTORY AI GENERATOR*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Reply/kirim gambar dengan caption: \`${prefix}liftstory --template Lego\`\n` + `  👉 Gunakan Template ID: \`${prefix}liftstory --template ${DEFAULT_TEMPLATE}\`\n\n` + `• *Lihat Daftar Template (CTA UI):*\n` + `  👉 \`${prefix}liftstory --list\` atau \`${prefix}listtemplates\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--template <nama|id>\` (Pilih gaya/style template)\n` + `  • \`--imageUrl <url>\` (Gunakan URL gambar langsung)\n` + `  • \`--body <json_string>\` (Override payload JSON)`);
      }
      let templateId = DEFAULT_TEMPLATE;
      let templateName = "Ghibli (Default)";
      const queryTemp = String(flags.template || cleanPrompt || "").trim();
      if (queryTemp) {
        const templates = await getTemplates().catch(() => []);
        const found = templates.find(t => t.id.toLowerCase() === queryTemp.toLowerCase() || t.name.toLowerCase() === queryTemp.toLowerCase() || t.name.toLowerCase().includes(queryTemp.toLowerCase()));
        if (found) {
          templateId = found.id;
          templateName = found.name;
        } else if (flags.template && flags.template.length > 15) {
          templateId = flags.template;
          templateName = "Custom Template ID";
        }
      }
      if (!isMedia && !flags.imageUrl) {
        const infoBody = `🎨 *TEMPLATE TERPILIH: ${templateName.toUpperCase()}*\n\n` + `╭───『 *DETAIL TEMPLATE* 』\n` + `│ 🏷️ *Nama:* ${templateName}\n` + `│ 🆔 *Template ID:* \`${templateId}\`\n` + `╰──────────────────\n\n` + `📸 *Langkah Selanjutnya:*\n` + `Kirim atau reply foto/gambar dengan caption:\n` + `👉 \`${prefix}liftstory --template ${templateId}\``;
        const infoButtons = [{
          name: "cta_copy",
          buttonParamsJson: JSON.stringify({
            display_text: `📋 Salin Template ID (${templateName})`,
            id: "copy_selected_id",
            copy_code: templateId
          })
        }, {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: "🎨 Pilih Template Lain",
            id: `${prefix}liftstory --list`
          })
        }];
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(infoBody, `${botName} • LiftStory AI`, infoButtons, {
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
          console.error("[LIFTSTORY] Invalid JSON in --body flag:", e.message);
        }
      }
      const requestPayload = {
        action: "generate",
        imageUrl: uploadedImageUrl,
        template: templateId,
        ...flags.token ? {
          token: flags.token
        } : {},
        ...flags,
        ...bodyOverride
      };
      const response = await axios.post(BASE_URL, requestPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 9e4
      });
      const resData = response.data;
      const resultUrl = resData?.result || resData?.data?.url || resData?.url;
      if (!resultUrl) {
        throw new Error(resData?.message || "Gagal mendapatkan URL gambar hasil dari server LiftStory.");
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
      const resultCaption = `🖼️ *LIFTSTORY AI IMAGE GENERATED*\n\n` + `╭───『 *INFORMASI HASIL* 』\n` + `│ 🎨 *Style:* ${templateName}\n` + `│ 🆔 *Template ID:* \`${templateId}\`\n` + `│ ⚡ *Task ID:* \`${resData?.id || "-"}\`\n` + `╰──────────────────\n\n` + `_${botName} • AI Image Transformation Engine_`;
      const resultButtons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: `📋 Salin Template ID (${templateName})`,
          id: "copy_template_id",
          copy_code: templateId
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🎨 Ganti Gaya Lain",
          id: `${prefix}liftstory --list`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(resultCaption, `${botName} • LiftStory AI`, resultButtons, {
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
      console.error("[LiftStory Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ LiftStory Error: ${errorMessage}`);
    }
  }
};