import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const CONFIG = {
  API_URL: "https://wudysoft.my.id/api/search/kwai",
  TIMEOUT: 35e3,
  USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
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
      profile: ["p", "user", "u", "creator"],
      home: ["h", "discover", "trending", "feed"],
      detail: ["d", "url", "video"],
      audio: ["a", "mp3", "sound", "musik"]
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
async function callKwaiApi(action, payload = {}) {
  const res = await axios.post(CONFIG.API_URL, {
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
  name: "kwai",
  aliases: ["kwaivideo", "kwaidl", "kwaidownload", "kwaiprofile", "kwaiapp"],
  description: "Download video Kwai HD tanpa watermark, pencarian video, cek profil, & trending feed via POST API",
  category: "Downloader",
  limit: true,
  example: "kwai https://www.kwai.com/@snapdouyin/video/5238680903365743246\n" + "kwai Jedag Jedug\n" + "kwai --user snapdouyin\n" + "kwai --home",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["kwai", "kwaivideo", "kwaidl", "kwaidownload", "kwaiprofile", "kwaiapp"].some(a => firstWord.endsWith(a))) {
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
      const kwaiUrlRegex = /(https?:\/\/(?:www\.|v\.)?(?:kwai\.com|kwai-video\.com|kwaiapp\.com)[^\s]+|\b\d{15,}\b)/i;
      const matchUrl = query.match(kwaiUrlRegex);
      const videoUrlOrId = matchUrl ? matchUrl[0] : null;
      if (!query && !flags.home && !flags.profile) {
        return ctx.reply(`🎬 *KWAI DOWNLOADER & SEARCH SUITE*\n\n` + `• *Cara Penggunaan:*\n` + `  👉 *Download Video:* \`${prefix}kwai <link_kwai>\` atau reply link dengan \`${prefix}kwai\`\n` + `  👉 *Download Audio/MP3:* \`${prefix}kwai <link_kwai> --audio\`\n` + `  👉 *Cari Video:* \`${prefix}kwai <kata kunci pencarian>\`\n` + `  👉 *Cek Profil Kreator:* \`${prefix}kwai --user <username_kwai>\`\n` + `  👉 *Jelajahi Feed Trending:* \`${prefix}kwai --home\`\n\n` + `📌 *Contoh Perintah:*\n` + `• \`${prefix}kwai https://www.kwai.com/@snapdouyin/video/5238680903365743246\`\n` + `• \`${prefix}kwai slowmo anime\`\n` + `• \`${prefix}kwai --user snapdouyin\``);
      }
      await ctx.react("⏳");
      if (videoUrlOrId || flags.detail) {
        const targetUrl = videoUrlOrId || String(flags.detail);
        const data = await callKwaiApi("detail", {
          url: targetUrl
        });
        if (!data?.status || !data?.result?.video_url) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengambil video dari link tersebut. Pastikan link video publik dan valid.`);
        }
        const res = data.result;
        const captionText = `🎬 *KWAI VIDEO DOWNLOADER*\n\n` + `• *Kreator:* ${res.author?.name || res.author?.username || "Unknown"}\n` + `• *Deskripsi:* ${res.caption || "-"}\n` + `• *Hashtags:* ${res.hashtags?.join(" ") || "-"}\n` + `• *Statistik:* ❤️ ${res.stats?.likes || "0"} | 💬 ${res.stats?.comments || "0"} | 🔄 ${res.stats?.shares || "0"}\n` + `• *AI Generated:* ${res.is_ai_generated ? "Ya 🤖" : "Tidak"}\n` + `• *Sumber:* ${res.url || targetUrl}`;
        if (flags.audio) {
          await sock.sendMessage(ctx.id, {
            audio: {
              url: res.video_url
            },
            mimetype: "audio/mp4",
            fileName: `kwai_${res.video_id || Date.now()}.mp3`
          }, {
            quoted: quotedMsg
          });
          return ctx.react("✅");
        }
        await sock.sendMessage(ctx.id, {
          video: {
            url: res.video_url
          },
          caption: captionText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (flags.profile) {
        const username = String(flags.profile === true ? query : flags.profile).replace(/^@/, "").trim();
        if (!username) {
          await ctx.react("❌");
          return ctx.reply(`❌ Harap masukkan username kreator yang ingin dicek.`);
        }
        const data = await callKwaiApi("profile", {
          name: username
        });
        if (!data?.status || !data?.result) {
          await ctx.react("❌");
          return ctx.reply(`❌ Profil kreator "@${username}" tidak ditemukan di Kwai.`);
        }
        const u = data.result;
        const profileCaption = `👤 *PROFIL KREATOR KWAI*\n\n` + `• *Nama:* ${u.name}\n` + `• *Username:* @${u.username}\n` + `• *User ID:* \`${u.user_id}\`\n` + `• *Gender:* ${u.gender || "Tidak diketahui"}\n` + `• *Bio:* ${u.bio || "-"}\n\n` + `📊 *Statistik Akun:*\n` + `• *Followers:* ${u.stats?.followers || "0"}\n` + `• *Mengikuti:* ${u.stats?.following || "0"}\n` + `• *Total Likes:* ${u.stats?.likes || "0"}\n` + `• *Total Postingan:* ${u.stats?.total_posts || "0"}\n` + `• *Total Playlist:* ${u.playlists?.length || "0"} Album`;
        const avatarUrl = u.avatar || "https://files.catbox.moe/g2e6i5.jpg";
        const postRows = (u.posts || []).slice(0, 8).map((p, i) => ({
          title: `📹 Video #${i + 1} (${p.likes} Likes)`,
          id: `${prefix}kwai ${p.url || p.video_id}`,
          description: `Download video ini (${p.video_id})`
        }));
        if (postRows.length && typeof ctx.sendCta === "function") {
          const listSections = [{
            title: `📹 POSTINGAN TERBARU`,
            rows: postRows
          }];
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 DAFTAR VIDEO`,
              sections: listSections
            })
          }, {
            name: "cta_url",
            display_text: "🌐 Buka Profil Kwai",
            url: `https://www.kwai.com/@${u.username}`
          }];
          await ctx.sendCta(profileCaption, `${botName} • Kwai Profile`, buttons, {
            image: avatarUrl,
            quoted: quotedMsg
          });
        } else {
          await sock.sendMessage(ctx.id, {
            image: {
              url: avatarUrl
            },
            caption: profileCaption
          }, {
            quoted: quotedMsg
          });
        }
        return ctx.react("✅");
      }
      if (flags.home) {
        const data = await callKwaiApi("home");
        const items = data?.result?.items || [];
        if (!items.length) {
          await ctx.react("❌");
          return ctx.reply("❌ Tidak ada konten trending yang ditemukan saat ini.");
        }
        const feedRows = items.slice(0, 10).map((v, i) => ({
          title: `🔥 #${i + 1} ${v.author?.name || "Kwai User"}`,
          id: `${prefix}kwai ${v.url || v.video_id}`,
          description: `${(v.caption || "Tonton Video").slice(0, 45)}... (❤️ ${v.stats?.likes || "0"})`
        }));
        const bodyText = `🔥 *KWAI TRENDING / DISCOVER FEED*\n\n` + `Ditemukan *${items.length} konten populer* di Kwai hari ini.\n` + `Pilih salah satu video di bawah untuk langsung mengunduh:`;
        if (typeof ctx.sendCta === "function") {
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH VIDEO TRENDING`,
              sections: [{
                title: `🔥 POPULER SAAT INI`,
                rows: feedRows
              }]
            })
          }];
          await ctx.sendCta(bodyText, `${botName} • Kwai Feed`, buttons, {
            image: items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg",
            quoted: quotedMsg
          });
        } else {
          let listMsg = `${bodyText}\n\n`;
          feedRows.forEach((r, idx) => {
            listMsg += `*${idx + 1}.* ${r.title}\n   ${r.description}\n   🔗 \`${r.id}\`\n\n`;
          });
          await ctx.reply(listMsg.trim());
        }
        return ctx.react("✅");
      }
      const data = await callKwaiApi("search", {
        query: query
      });
      const items = data?.result?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan video Kwai dengan kata kunci "${query}".`);
      }
      const searchRows = items.slice(0, 10).map((v, i) => ({
        title: `🎬 #${i + 1} ${v.author?.name || "Kwai Video"}`,
        id: `${prefix}kwai ${v.url || v.video_id}`,
        description: `${(v.caption || "Tanpa Judul").slice(0, 45)}... (❤️ ${v.stats?.likes || "0"})`
      }));
      const bodyText = `🔍 *HASIL PENCARIAN KWAI*\n\n` + `• *Kata Kunci:* \`${query}\`\n` + `• *Total Ditemukan:* ${items.length} Video\n\n` + `_Pilih video di menu bawah untuk langsung mengunduh tanpa watermark:_`;
      if (typeof ctx.sendCta === "function") {
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: `📂 PILIH HASIL PENCARIAN`,
            sections: [{
              title: `🎬 HASIL PENCARIAN`,
              rows: searchRows
            }]
          })
        }];
        await ctx.sendCta(bodyText, `${botName} • Kwai Search`, buttons, {
          image: items[0]?.thumbnail || "https://files.catbox.moe/g2e6i5.jpg",
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
      console.error("[Kwai Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan saat memproses Kwai: ${errorMessage}`);
    }
  }
};