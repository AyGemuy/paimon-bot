import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/nsfw/eporner";

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1];
    let rawVal = match[2];
    let val = true;
    const lowerKey = key.toLowerCase();
    if (["url", "link", "id", "get", "play"].includes(lowerKey)) key = "url";
    if (["search", "q", "find", "s", "query"].includes(lowerKey)) key = "search";
    if (["quality", "res", "qual"].includes(lowerKey)) key = "quality";
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
  name: "eporner",
  aliases: ["ep", "epornerdl", "epornersearch"],
  description: "Cari dan download video Eporner HD (CTA Media List & Bottom Sheet)",
  category: "NSFW",
  limit: true,
  example: "eporner cosplay atau eporner --url https://www.eporner.com/video-...",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["eporner", "ep", "epornerdl", "epornersearch"].some(alias => firstWord.endsWith(alias))) {
          rawText = raw.slice(firstWord.length).trim();
        }
      }
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const {
        flags,
        cleanPrompt
      } = parseFlags(rawText);
      const sendVideoResult = async detail => {
        const downloads = Array.isArray(detail.download) ? detail.download : [];
        if (!downloads.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tautan download video tidak ditemukan.");
        }
        const qualityPref = (flags.quality || "").toLowerCase();
        let targetDownload = null;
        if (qualityPref) {
          targetDownload = downloads.find(d => d.quality?.toLowerCase().includes(qualityPref));
        }
        if (!targetDownload) {
          targetDownload = downloads.find(d => d.quality?.includes("720p")) || downloads.find(d => d.quality?.includes("480p")) || downloads.find(d => d.quality?.includes("1080p")) || downloads[0];
        }
        const videoUrl = targetDownload?.url;
        const title = detail.title || "Eporner Video";
        const desc = detail.description && detail.description !== "Meta Description Not Found" ? detail.description : "-";
        const image = detail.thumbnail || null;
        const caption = `🔞 *EPORNER VIDEO DOWNLOADER*\n\n` + `• *Judul:* ${title}\n` + `• *Kualitas:* ${targetDownload?.quality || "HD"}\n` + `• *Ukuran:* ${targetDownload?.size || "N/A"}\n` + `• *Info:* ${desc}\n\n` + `🔗 *Tautan:* ${flags.url || cleanPrompt}\n\n` + `_Mengirim video..._`;
        try {
          const {
            data: videoBuffer
          } = await axios.get(videoUrl, {
            responseType: "arraybuffer",
            timeout: 6e4,
            maxContentLength: 80 * 1024 * 1024
          });
          await sock.sendMessage(ctx.id, {
            video: Buffer.from(videoBuffer),
            caption: caption,
            mimetype: "video/mp4"
          }, {
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        } catch (mediaErr) {
          const fallbackText = caption + `\n⚠️ _Peringatan: Ruang penyimpanan disk server bot sedang penuh (ENOSPC). Video dapat diputar/diunduh langsung melalui tombol di bawah._`;
          const buttons = downloads.slice(0, 3).map(d => ({
            name: "cta_url",
            display_text: `📥 Download (${d.quality} - ${d.size})`,
            url: d.url
          }));
          if (typeof ctx.sendCta === "function") {
            await ctx.sendCta(fallbackText, `${botName} • Eporner Downloader`, buttons, {
              image: image || undefined,
              params: {
                bottom_sheet: {
                  in_thread_buttons_limit: 1,
                  divider_indices: [1],
                  list_title: `${botName} • Eporner Player`,
                  button_title: "Opsi Download"
                }
              },
              quoted: quotedMsg
            });
          } else {
            await ctx.reply(fallbackText, {
              quoted: quotedMsg
            });
          }
          await ctx.react("⚠️");
          return;
        }
      };
      const targetUrl = flags.url || (cleanPrompt.startsWith("http") ? cleanPrompt : null);
      if (targetUrl) {
        await ctx.react("⏳");
        const {
          data: res
        } = await axios.post(API_URL, {
          action: "detail",
          url: targetUrl
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 4e4
        });
        if (!res || res.status === false || res.error || !res.download?.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal memuat data video Eporner. Pastikan link video valid.");
        }
        return await sendVideoResult(res);
      }
      const searchQuery = flags.search || cleanPrompt;
      if (!searchQuery) {
        return ctx.reply(`🔞 *EPORNER SEARCH & DOWNLOADER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari video: \`${prefix}eporner cosplay\`\n` + `  👉 Unduh via URL: \`${prefix}eporner --url https://www.eporner.com/video-...\`\n\n` + `• *Opsi Flags:*\n` + `  • \`--quality <1080p/720p/480p>\` (Pilihan resolusi unduh)`);
      }
      await ctx.react("⏳");
      const {
        data: searchResults
      } = await axios.post(API_URL, {
        action: "search",
        query: searchQuery
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 4e4
      });
      const videoList = Array.isArray(searchResults) ? searchResults : searchResults?.result || [];
      if (!videoList.length || videoList.status === false || videoList.error) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video Eporner untuk: *"${searchQuery}"*`);
      }
      const firstThumbnail = videoList[0]?.thumbnail;
      const videoRows = videoList.slice(0, 15).map(v => {
        const title = v.title || "Eporner Video";
        return {
          title: title.slice(0, 24),
          description: `Kualitas: ${v.quality} • Durasi: ${v.duration} (Unduh Video)`,
          id: `${prefix}eporner --url ${v.url}`
        };
      });
      const sections = [{
        title: `🔞 HASIL PENCARIAN EPORNER`,
        rows: videoRows
      }];
      const bodyText = `🔞 *EPORNER SEARCH EXPLORER*\n\n` + `• *Kata Kunci:* "${searchQuery}"\n` + `• *Ditemukan:* ${videoList.length} Video\n\n` + `_Pilih video di bawah untuk mengunduh atau menonton langsung!_`;
      const footerText = `${botName} • Eporner Downloader`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: `🔞 Pilih Video (${videoRows.length})`,
          sections: sections
        })
      }];
      const options = {
        image: firstThumbnail || undefined,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Eporner Search`,
            button_title: "Lihat Video"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        let fallback = `🔞 *DAFTAR VIDEO EPORNER*\n\n`;
        fallback += videoRows.map(r => `• *${r.title}*\n  Perintah: \`${r.id}\``).join("\n\n");
        await ctx.reply(fallback);
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errMsg = error.message;
      if (error.response?.data) {
        errMsg = error.response.data?.error || error.response.data?.message || errMsg;
      }
      ctx.reply(`❌ Eporner Error: ${errMsg}`);
    }
  }
};