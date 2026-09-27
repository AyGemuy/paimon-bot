import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  BASE_URL: "https://www.wudysoft.my.id/api/nsfw/bokeptod",
  TIMEOUT: 4e4,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:--|-)([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    const aliasMap = {
      tag: ["t", "kategori", "category"],
      home: ["h", "latest", "terbaru"],
      detail: ["d", "url", "link"],
      page: ["p", "pg"],
      version: ["v", "ver", "versi"],
      v1: ["1"],
      v2: ["2"]
    };
    for (const [realKey, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(key)) key = realKey;
    }
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
async function callBokeptodApi(action, payload = {}, version = "v1") {
  const targetVersion = ["v1", "v2"].includes(String(version).toLowerCase()) ? String(version).toLowerCase() : "v1";
  const targetEndpoint = `${CONFIG.BASE_URL}/${targetVersion}`;
  const res = await axios.post(targetEndpoint, {
    action: action,
    ...payload
  }, {
    headers: {
      "Content-Type": "application/json",
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
export default {
  name: "bokeptod",
  aliases: ["bkptd", "bktod", "todsearch"],
  description: "Pencarian dan streaming video dewasa dari Bokeptod (Default API V1, Opsi V2 via POST)",
  category: "NSFW",
  limit: true,
  nsfw: true,
  example: "bokeptod jepang\n" + "bokeptod viral indo --v2\n" + "bokeptod --tag bocil --page 2\n" + "bokeptod --home\n" + "bokeptod --detail <link_video>",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["bokeptod", "bkptd", "bktod", "todsearch"].some(a => firstWord.endsWith(a))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const quotedText = (ctx.quoted?.text || ctx.quoted?.caption || ctx.quoted?.body || ctx.quoted?.message?.conversation || ctx.quoted?.message?.extendedTextMessage?.text || ctx.quotedText || "").trim();
      const {
        flags,
        cleanPrompt: initialPrompt
      } = parseFlags(rawText);
      const query = initialPrompt || quotedText;
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const page = Number(flags.page) || 1;
      let apiVersion = "v1";
      if (flags.v2 || flags.version && String(flags.version).includes("2")) {
        apiVersion = "v2";
      } else if (flags.v1 || flags.version && String(flags.version).includes("1")) {
        apiVersion = "v1";
      }
      const urlRegex = /https?:\/\/[^\s]+bokeptod\.[^\s]+/i;
      const isUrl = urlRegex.test(query);
      if (!query && !flags.home && !flags.tag && !flags.detail) {
        return ctx.reply(`🔞 *BOKEPTOD SEARCH & STREAM SUITE (DEFAULT V1)*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 *Cari Video:* \`${prefix}bokeptod <kata_kunci>\`\n` + `  👉 *Gunakan API V2:* \`${prefix}bokeptod <kata_kunci> --v2\`\n` + `  👉 *Cari by Tag:* \`${prefix}bokeptod --tag <nama_tag>\`\n` + `  👉 *Feed Terbaru:* \`${prefix}bokeptod --home\`\n` + `  👉 *Detail Video:* \`${prefix}bokeptod --detail <url_video>\`\n` + `  👉 *Reply Chat:* Balas pesan dengan \`${prefix}bokeptod\`\n\n` + `📌 *Contoh Perintah:*\n` + `• \`${prefix}bokeptod viral indo\`\n` + `• \`${prefix}bokeptod jepang --v2\`\n` + `• \`${prefix}bokeptod --tag bocil --page 2\`\n` + `• \`${prefix}bokeptod --home\``);
      }
      await ctx.react("⏳");
      if (flags.detail || isUrl) {
        const targetUrl = flags.detail ? String(flags.detail) : query;
        const data = await callBokeptodApi("detail", {
          url: targetUrl
        }, apiVersion);
        if (!data?.status || !data?.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat detail video dari tautan tersebut.");
        }
        const v = data.result;
        const categories = (Array.isArray(v.categories) ? v.categories.map(c => c.name || c) : []).join(", ") || "-";
        const tags = (Array.isArray(v.tags) ? v.tags.map(t => t.name || t) : []).join(", ") || "-";
        const videoStreamUrl = v.embed_url || v.video_url || "-";
        const detailCaption = `🔞 *DETAIL VIDEO BOKEPTOD (${apiVersion.toUpperCase()})*\n\n` + `• *Judul:* ${v.title}\n` + `• *Durasi:* ${v.duration || v.duration_raw || "-"}\n` + `• *Views:* 👁️ ${v.views_text || v.views_count || v.views || 0}\n` + `• *Rating:* ⭐ ${v.rating || "-"}\n` + `• *Suka / Tidak:* 👍 ${v.likes || 0} | 👎 ${v.dislikes || 0}\n` + `• *Kategori:* ${categories}\n` + `• *Tags:* _${tags}_\n` + `• *Uploader:* ${v.author || v.uploader || "Admin"}\n` + `• *Tanggal:* ${v.date || v.upload_date || "-"}\n\n` + `🔗 *Stream/Embed:* ${videoStreamUrl}\n` + `🌐 *URL Halaman:* ${v.url}`;
        const thumbUrl = v.thumbnail || v.poster || "https://files.catbox.moe/g2e6i5.jpg";
        if (typeof ctx.sendCta === "function") {
          const buttons = [];
          if (videoStreamUrl !== "-") {
            buttons.push({
              name: "cta_url",
              display_text: "▶️ Tonton / Stream Video",
              url: videoStreamUrl
            });
          }
          buttons.push({
            name: "cta_url",
            display_text: "🌐 Halaman Sumber",
            url: v.url
          });
          await ctx.sendCta(detailCaption, `${botName} • Bokeptod ${apiVersion.toUpperCase()}`, buttons, {
            image: thumbUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: thumbUrl
            },
            caption: detailCaption
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react("✅");
      }
      if (flags.tag) {
        const tagSlug = String(flags.tag === true ? query : flags.tag).trim();
        const data = await callBokeptodApi("tag", {
          slug: tagSlug,
          page: page
        }, apiVersion);
        const items = Array.isArray(data?.result?.items) ? data.result.items : Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || !items.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak ditemukan video pada tag/kategori "${tagSlug}".`);
        }
        const totalItems = data.result?.total_items || items.length;
        const totalPages = data.result?.pagination?.total_pages || 1;
        const actionRows = items.slice(0, 10).map((item, i) => ({
          title: `#${i + 1} ${(item.title || "Video").slice(0, 30)}`,
          id: `${prefix}bokeptod --detail ${item.url} --${apiVersion}`,
          description: `⏱️ ${item.duration || "-"} | 👁️ ${item.views_text || item.views_count || 0} | ⭐ ${item.rating || "-"}`
        }));
        const bodyText = `🏷️ *HASIL TAG BOKEPTOD (${apiVersion.toUpperCase()}): ${tagSlug.toUpperCase()}*\n\n` + `• *Total Video:* ${totalItems} Video\n` + `• *Halaman:* ${page}/${totalPages}\n\n` + `_Pilih salah satu video di menu bawah untuk melihat link streaming:_`;
        const bannerImage = items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg";
        if (typeof ctx.sendCta === "function") {
          const listSections = [{
            title: `🎬 DAFTAR VIDEO TAG`,
            rows: actionRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH VIDEO`,
              sections: listSections
            })
          }];
          if (page > 1) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `⬅️ Hal ${page - 1}`,
                id: `${prefix}bokeptod --tag ${tagSlug} -p ${page - 1} --${apiVersion}`
              })
            });
          }
          if (page < totalPages) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `➡️ Hal ${page + 1}`,
                id: `${prefix}bokeptod --tag ${tagSlug} -p ${page + 1} --${apiVersion}`
              })
            });
          }
          await ctx.sendCta(bodyText, `${botName} • Bokeptod Tag`, buttons, {
            image: bannerImage,
            quoted: quotedMsg
          });
        } else {
          let listMsg = `${bodyText}\n\n`;
          actionRows.forEach((r, idx) => {
            listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   🔗 \`${r.id}\`\n\n`;
          });
          await ctx.reply(listMsg.trim());
        }
        return ctx.react("✅");
      }
      if (flags.home) {
        const data = await callBokeptodApi("home", {
          page: page,
          filter: "latest"
        }, apiVersion);
        const items = Array.isArray(data?.result?.items) ? data.result.items : Array.isArray(data?.result) ? data.result : [];
        if (!data?.status || !items.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat feed video terbaru.");
        }
        const totalItems = data.result?.total_items || items.length;
        const totalPages = data.result?.pagination?.total_pages || 1;
        const actionRows = items.slice(0, 10).map((item, i) => ({
          title: `#${i + 1} ${(item.title || "Video").slice(0, 30)}`,
          id: `${prefix}bokeptod --detail ${item.url} --${apiVersion}`,
          description: `⏱️ ${item.duration || "-"} | 👁️ ${item.views_text || item.views_count || 0} | ⭐ ${item.rating || "-"}`
        }));
        const bodyText = `🔥 *VIDEO TERBARU BOKEPTOD (${apiVersion.toUpperCase()})*\n\n` + `• *Total Video:* ${totalItems} Konten\n` + `• *Halaman:* ${page}/${totalPages}\n\n` + `_Pilih video di bawah ini untuk membuka detail pemutar:_`;
        const bannerImage = items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg";
        if (typeof ctx.sendCta === "function") {
          const listSections = [{
            title: `🔥 VIDEO TERBARU`,
            rows: actionRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH VIDEO TERBARU`,
              sections: listSections
            })
          }];
          if (page > 1) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `⬅️ Hal ${page - 1}`,
                id: `${prefix}bokeptod --home -p ${page - 1} --${apiVersion}`
              })
            });
          }
          if (page < totalPages) {
            buttons.push({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: `➡️ Hal ${page + 1}`,
                id: `${prefix}bokeptod --home -p ${page + 1} --${apiVersion}`
              })
            });
          }
          await ctx.sendCta(bodyText, `${botName} • Bokeptod Home`, buttons, {
            image: bannerImage,
            quoted: quotedMsg
          });
        } else {
          let listMsg = `${bodyText}\n\n`;
          actionRows.forEach((r, idx) => {
            listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   🔗 \`${r.id}\`\n\n`;
          });
          await ctx.reply(listMsg.trim());
        }
        return ctx.react("✅");
      }
      const data = await callBokeptodApi("search", {
        query: query,
        page: page
      }, apiVersion);
      const items = Array.isArray(data?.result?.items) ? data.result.items : Array.isArray(data?.result) ? data.result : [];
      if (!data?.status || !items.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video dengan kata kunci "${query}".`);
      }
      const totalItems = data.result?.total_items || items.length;
      const totalPages = data.result?.pagination?.total_pages || 1;
      const searchRows = items.slice(0, 10).map((item, i) => ({
        title: `#${i + 1} ${(item.title || "Video").slice(0, 30)}`,
        id: `${prefix}bokeptod --detail ${item.url} --${apiVersion}`,
        description: `⏱️ ${item.duration || "-"} | 👁️ ${item.views_text || item.views_count || 0} | ⭐ ${item.rating || "-"}`
      }));
      const bodyText = `🔍 *HASIL PENCARIAN BOKEPTOD (${apiVersion.toUpperCase()})*\n\n` + `• *Kata Kunci:* \`${query}\`\n` + `• *Total Ditemukan:* ${totalItems} Video\n` + `• *Halaman:* ${page}/${totalPages}\n\n` + `_Pilih video di bawah untuk memuat informasi dan link pemutar video:_`;
      const bannerImage = items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg";
      if (typeof ctx.sendCta === "function") {
        const listSections = [{
          title: `🎬 HASIL PENCARIAN`,
          rows: searchRows
        }];
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 PILIH VIDEO`,
            sections: listSections
          })
        }];
        if (page > 1) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⬅️ Hal ${page - 1}`,
              id: `${prefix}bokeptod ${query} -p ${page - 1} --${apiVersion}`
            })
          });
        }
        if (page < totalPages) {
          buttons.push({
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `➡️ Hal ${page + 1}`,
              id: `${prefix}bokeptod ${query} -p ${page + 1} --${apiVersion}`
            })
          });
        }
        await ctx.sendCta(bodyText, `${botName} • Bokeptod Search`, buttons, {
          image: bannerImage,
          quoted: quotedMsg
        });
      } else {
        let listMsg = `${bodyText}\n\n`;
        searchRows.forEach((r, idx) => {
          listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   🔗 \`${r.id}\`\n\n`;
        });
        await ctx.reply(listMsg.trim());
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Bokeptod Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan saat memproses Bokeptod: ${errorMessage}`);
    }
  }
};