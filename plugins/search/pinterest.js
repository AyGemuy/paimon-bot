import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://www.wudysoft.my.id/api/search/pinterest/v1";
async function albumMessage(sock, jid, medias, m, options = {}) {
  try {
    if (typeof jid !== "string") {
      throw new TypeError(`jid harus string, diterima: ${typeof jid}`);
    }
    if (!Array.isArray(medias) || medias.length < 2) {
      throw new RangeError(`Minimal 2 media diperlukan untuk album. Diterima: ${medias?.length || 0}`);
    }
    const {
      caption = "",
        mentions = [],
        quoted,
        ephemeralExpiration
    } = options;
    const albumContent = [];
    for (const media of medias) {
      if (media.type === "image") {
        albumContent.push({
          image: media.data
        });
      } else if (media.type === "video") {
        albumContent.push({
          video: media.data
        });
      }
    }
    if (albumContent.length < 2) {
      throw new RangeError(`Tidak cukup media yang valid (gambar/video) untuk membentuk album. Item valid: ${albumContent.length}`);
    }
    const messageContent = {
      text: caption,
      mentions: mentions,
      album: albumContent
    };
    const sendOptions = {
      quoted: m || quoted || null,
      ephemeralExpiration: ephemeralExpiration || null
    };
    const result = await sock.sendMessage(jid, messageContent, sendOptions);
    return result;
  } catch (error) {
    throw error;
  }
}

function parseFlags(input = "") {
  const flags = {};
  const flagRegex = /(?:^|\s)(?:--([a-zA-Z0-9_-]+)|-([a-zA-Z]))(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = (match[1] || match[2]).toLowerCase();
    let rawVal = match[3];
    let val = true;
    if (["url", "download", "dl", "d", "u", "link"].includes(key)) key = "url";
    if (["search", "q", "find", "s"].includes(key)) key = "search";
    if (["profile", "user", "p", "profil"].includes(key)) key = "profile";
    if (["limit", "l"].includes(key)) key = "limit";
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
  const cleanPrompt = input.replace(flagRegex, "").replace(/\s+/g, " ").trim();
  let urlFromPrompt = null;
  const urlMatch = cleanPrompt.match(/https?:\/\/(?:[a-zA-Z0-9_-]+\.)?pinterest\.[a-z]{2,4}\/pin\/[^\s]+|https?:\/\/pin\.it\/[^\s]+/i);
  if (urlMatch) {
    urlFromPrompt = urlMatch[0];
  }
  return {
    flags: flags,
    cleanPrompt: cleanPrompt,
    urlFromPrompt: urlFromPrompt
  };
}
export default {
  name: "pinterest",
  aliases: ["pin", "pinsearch", "pinterestsearch"],
  description: "Cari gambar aesthetic, download pin, dan lihat profil Pinterest via Flags & Album",
  category: "Search",
  limit: true,
  example: "pinterest anime aesthetic atau pinterest --url https://pin.it/xxx",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanPrompt,
        urlFromPrompt
      } = parseFlags(rawText);
      const pinUrl = flags.url || urlFromPrompt || (cleanPrompt.startsWith("dl ") ? cleanPrompt.slice(3).trim() : null);
      const profileUser = flags.profile || (cleanPrompt.startsWith("profil ") || cleanPrompt.startsWith("profile ") ? cleanPrompt.split(/\s+/)[1]?.replace("@", "") : null);
      const searchKeyword = flags.search || (!pinUrl && !profileUser && cleanPrompt ? cleanPrompt : null);
      const limit = Number(flags.limit) || 8;
      if (pinUrl) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_URL, {
          action: "download",
          url: pinUrl
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mendownload detail media dari link Pinterest tersebut.");
        }
        const res = data.result;
        const mediaUrl = res.media_urls?.[0]?.url || res.media_urls?.[1]?.url;
        const isVideo = res.type === "video" || /mp4|video/i.test(mediaUrl || "");
        const captionText = `📥 *PINTEREST DOWNLOADER*\n\n` + `• *Judul:* ${res.title || "Tanpa Judul"}\n` + `• *Uploader:* ${res.uploader?.full_name || res.uploader?.username || "Unknown"}\n` + `• *Saves:* ${res.statistics?.saves || 0}\n` + `• *Comments:* ${res.statistics?.comments || 0}\n` + `• *Board:* ${res.board?.name || "-"}`;
        await ctx.react("✅");
        if (mediaUrl) {
          if (isVideo) {
            return await sock.sendMessage(ctx.chat, {
              video: {
                url: mediaUrl
              },
              caption: captionText,
              mimetype: "video/mp4"
            }, {
              quoted: quotedMsg
            });
          } else {
            return await sock.sendMessage(ctx.chat, {
              image: {
                url: mediaUrl
              },
              caption: captionText
            }, {
              quoted: quotedMsg
            });
          }
        } else {
          return ctx.reply(captionText);
        }
      }
      if (profileUser) {
        await ctx.react("⏳");
        const {
          data
        } = await axios.post(API_URL, {
          action: "profile",
          username: profileUser
        }, {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 3e4
        });
        if (!data || !data.status || !data.result) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengambil data profil Pinterest.");
        }
        const p = data.result;
        const profileText = `👤 *PINTEREST PROFILE*\n\n` + `• *Nama:* ${p.full_name || "-"} (@${p.username})\n` + `• *Bio:* ${p.bio || "Tidak ada bio"}\n` + `• *Lokasi:* ${p.location || "-"}\n` + `• *Followers:* ${p.stats?.followers || 0}\n` + `• *Following:* ${p.stats?.following || 0}\n` + `• *Total Pins:* ${p.stats?.pins || 0}\n` + `• *Boards:* ${p.stats?.boards || 0}\n` + `• *Profil:* ${p.profile_url}`;
        await ctx.react("✅");
        const avatarUrl = p.image?.original || p.image?.large || p.image?.medium;
        if (avatarUrl) {
          return await sock.sendMessage(ctx.chat, {
            image: {
              url: avatarUrl
            },
            caption: profileText
          }, {
            quoted: quotedMsg
          });
        } else {
          return ctx.reply(profileText);
        }
      }
      if (!rawText && !searchKeyword && !pinUrl && !profileUser) {
        return ctx.reply(`📌 *PINTEREST SEARCH & DOWNLOADER*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 Cari gambar aesthetic: \`${prefix}pinterest anime aesthetic\`\n` + `  👉 Unduh media pin spesifik: \`${prefix}pinterest --url https://pin.it/...\`\n` + `  👉 Lihat profil uploader: \`${prefix}pinterest --profile wudysoft\`\n\n` + `• *Opsi Flag Kustomisasi:*\n` + `  • \`--search <query>\` (Cari gambar berdasarkan kata kunci)\n` + `  • \`--url <link>\` (Unduh langsung media dari URL Pinterest)\n` + `  • \`--profile <username>\` (Lihat detail profil pengguna)\n` + `  • \`--limit <jumlah>\` (Batas jumlah gambar dalam album, default: \`8\`)`);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post(API_URL, {
        action: "search",
        query: searchKeyword
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || !data.status || !data.result?.pins || data.result.pins.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan hasil pencarian untuk: *"${searchKeyword}"*`);
      }
      const pins = data.result.pins;
      const medias = [];
      for (const pin of pins) {
        const images = pin.media?.images;
        const imageUrl = images?.orig?.url || images?.large?.url || images?.medium?.url || images?.small?.url;
        if (imageUrl) {
          medias.push({
            type: "image",
            data: {
              url: imageUrl
            }
          });
        }
        if (medias.length >= limit) break;
      }
      if (medias.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat gambar dari hasil pencarian Pinterest.");
      }
      if (medias.length === 1) {
        const singleCaption = `🔍 *PINTEREST SEARCH*\n\n` + `📌 *Query:* \`${searchKeyword}\`\n` + `📊 *Total Hasil:* ${pins.length} pin\n\n` + `_Ketik \`${prefix}pinterest <url_pin>\` untuk unduh detail pin._`;
        await sock.sendMessage(ctx.chat, {
          image: medias[0].data,
          caption: singleCaption
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const albumCaption = `🔍 *PINTEREST SEARCH*\n\n` + `📌 *Query:* \`${searchKeyword}\`\n` + `📊 *Total Hasil:* ${pins.length} pin\n` + `🖼️ *Ditampilkan:* ${medias.length} gambar dalam album\n\n` + `_Ketik \`${prefix}pinterest <url_pin>\` untuk unduh detail pin._`;
      await albumMessage(sock, ctx.chat, medias, quotedMsg, {
        caption: albumCaption
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Pinterest Error: ${errorMessage}`);
    }
  }
};