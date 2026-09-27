import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
const CONFIG = {
  API_URL: "https://www.wudysoft.my.id/api/search/lahelu",
  TIMEOUT: 3e4,
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
      user: ["u", "creator", "pengguna", "profile"],
      fyp: ["f", "rec", "recommendation", "trending", "trend"],
      sticker: ["s", "stiker", "wm"],
      id: ["postid", "pid", "post"],
      page: ["p", "pg"],
      help: ["h", "bantuan", "guide", "?"]
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
async function callLaheluApi(action, params = {}) {
  const res = await axios.get(CONFIG.API_URL, {
    params: {
      action: action,
      ...params
    },
    headers: {
      "User-Agent": CONFIG.USER_AGENT
    },
    timeout: CONFIG.TIMEOUT
  });
  return res?.data;
}
async function sendLaheluHelpMenu(sock, ctx, chatId, quotedMsg, prefix = ".") {
  const botName = global.bot?.name || "WudysoftBot";
  const bannerImage = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
  const guideText = `🎭 *PANDUAN FITUR LAHELU MEME*\n\n` + `Jelajahi ribuan meme lokal Indonesia, video lucu, dan kreator terpopuler di Lahelu!\n\n` + `╭───『 *PANDUAN PERINTAH* 』\n` + `│ 🔥 *FYP Rekomendasi:* \`${prefix}lahelu\` atau \`${prefix}lahelu --fyp\`\n` + `│ 🔍 *Cari Meme:* \`${prefix}lahelu <kata_kunci>\`\n` + `│ 🆔 *Detail by Post ID:* \`${prefix}lahelu --id <post_id>\`\n` + `│ 🏷️ *Jadikan Stiker WA:* \`${prefix}lahelu <kata_kunci> --sticker\`\n` + `│ 👤 *Cari Profil Kreator:* \`${prefix}lahelu --user <username>\`\n` + `│ 📖 *Bantuan Fitur:* \`${prefix}lahelu --help\`\n` + `╰──────────────────\n\n` + `_Pilih salah satu kategori cepat di bawah ini untuk langsung memuat konten:_`;
  const footerText = `${botName} • Pusat Meme Indonesia`;
  const quickRows = [{
    title: "🔥 FYP / Rekomendasi Hari Ini",
    id: `${prefix}lahelu --fyp`,
    description: "Ambil meme terpopuler & teratas saat ini"
  }, {
    title: "🗿 Meme Absurd & Random",
    id: `${prefix}lahelu absurd`,
    description: "Kumpulan meme absurd dan random bikin ngakak"
  }, {
    title: "🎮 Meme Gaming & Gamer",
    id: `${prefix}lahelu gaming`,
    description: "Meme seputar game, Minecraft, GTA, & Roblox"
  }, {
    title: "😏 Meme Sarcasm & Sarkas",
    id: `${prefix}lahelu sarcasm`,
    description: "Meme sindiran halus dan sarkasme lokal"
  }, {
    title: "🎌 Meme Wibu & Anime",
    id: `${prefix}lahelu anime`,
    description: "Meme anime relate dan kehidupan wibu"
  }, {
    title: "🐱 Meme Hewan / Kucing",
    id: `${prefix}lahelu kucing`,
    description: "Tingkah lucu kucing dan hewan peliharaan"
  }];
  const buttons = [{
    name: "single_select",
    buttonParamsJson: JSON.stringify({
      title: `📂 PILIH KATEGORI MEME`,
      sections: [{
        title: `${botName} • Aksi Cepat Lahelu`,
        rows: quickRows
      }]
    })
  }, {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: "🔥 Ambil FYP Sekarang",
      id: `${prefix}lahelu --fyp`
    })
  }];
  const options = {
    image: bannerImage,
    params: {
      bottom_sheet: {
        in_thread_buttons_limit: 1,
        divider_indices: [1],
        list_title: `${botName} • Menu Lahelu`,
        button_title: "Menu Kategori"
      }
    },
    contextInfo: {
      forwardingScore: 0,
      isForwarded: false
    },
    quoted: quotedMsg || undefined
  };
  if (typeof ctx?.sendCta === "function" && chatId === ctx.id) {
    return await ctx.sendCta(guideText, footerText, buttons, options);
  }
  return await sock.sendMessage(chatId, {
    image: {
      url: bannerImage
    },
    caption: `${guideText}\n\n_${footerText}_`
  }, {
    quoted: quotedMsg
  });
}
export default {
  name: "lahelu",
  aliases: ["memeindo", "lahelumeme", "lhl", "memelahelu"],
  description: "Jelajahi & cari meme kocak, gambar, video, atau kreator dari platform Lahelu",
  category: "Fun",
  limit: true,
  example: "lahelu\n" + "lahelu wkwk\n" + "lahelu --id P3hLe7Tq4\n" + "lahelu minecraft --sticker\n" + "lahelu --user wolvies",
  execute: async (sock, ctx, msg) => {
    try {
      let rawText = ctx.args?.join(" ")?.trim() || "";
      if (!rawText && ctx.text) {
        const raw = ctx.text.trim();
        const firstWord = raw.split(/\s+/)[0].toLowerCase();
        if (["lahelu", "memeindo", "lahelumeme", "lhl", "memelahelu"].some(a => firstWord.endsWith(a))) {
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
      if (flags.help || query.toLowerCase() === "help" || query.toLowerCase() === "bantuan") {
        return await sendLaheluHelpMenu(sock, ctx, ctx.id, quotedMsg, prefix);
      }
      await ctx.react("⏳");
      if (flags.user) {
        const searchUser = String(flags.user === true ? query : flags.user).replace(/^@/, "").trim();
        if (!searchUser) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan nama pengguna yang ingin dicari. Contoh: \`${prefix}lahelu --user wolvies\``);
        }
        const data = await callLaheluApi("search", {
          mode: "user",
          query: searchUser
        });
        const userList = data?.userInfos || [];
        if (!userList.length) {
          await ctx.react("❌");
          return ctx.reply(`❌ Pengguna Lahelu dengan nama "${searchUser}" tidak ditemukan.`);
        }
        let userMsg = `👤 *HASIL PENCARIAN PENGGUNA LAHELU*\n\n`;
        userList.slice(0, 8).forEach((u, i) => {
          userMsg += `*${i + 1}. @${u.username}*\n`;
          userMsg += `   • *ID:* \`${u.userId}\`\n`;
          userMsg += `   • *Total Post:* ${u.totalPosts || 0} Meme\n`;
          userMsg += `   • *Upvotes:* 👍 ${u.totalUpvotes || 0} | 👎 ${u.totalDownvotes || 0}\n`;
          if (u.description) userMsg += `   • *Bio:* _${u.description}_\n`;
          userMsg += `\n`;
        });
        const avatar = userList[0]?.visual?.[0]?.value || userList[0]?.avatar || "https://lahelu.com/icon.png";
        await sock.sendMessage(ctx.id, {
          image: {
            url: avatar
          },
          caption: userMsg.trim()
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      let postList = [];
      let feedTitle = "";
      const isPostIdPattern = query && /^P[a-zA-Z0-9_-]{7,10}$/i.test(query.trim());
      const targetPostId = flags.id ? String(flags.id).trim() : isPostIdPattern ? query.trim() : null;
      if (targetPostId) {
        const data = await callLaheluApi("search", {
          query: targetPostId,
          mode: "post"
        });
        postList = data?.postInfos || [];
        feedTitle = `🆔 *DETAIL MEME LAHELU: ${targetPostId}*`;
      } else if (query && !flags.fyp) {
        const data = await callLaheluApi("search", {
          query: query,
          mode: "post"
        });
        postList = data?.postInfos || [];
        feedTitle = `🔍 *HASIL PENCARIAN LAHELU: "${query}"*`;
      } else {
        const data = await callLaheluApi("recommendation");
        postList = data?.postInfos || [];
        feedTitle = `🔥 *LAHELU FYP / MEME REKOMENDASI*`;
      }
      if (!postList.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ada meme yang ditemukan untuk "${targetPostId || query || "Rekomendasi"}".\nKetik \`${prefix}lahelu --help\` untuk panduan.`);
      }
      let meme = postList[0];
      if (targetPostId) {
        const foundExact = postList.find(p => (p.postId || p.postID) === targetPostId);
        if (foundExact) meme = foundExact;
      }
      const mediaUrl = meme.media || meme.content?.find(c => c.value?.startsWith("http"))?.value || meme.mediaThumbnail;
      if (!mediaUrl) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal memuat file media meme dari Lahelu.");
      }
      const tags = meme.hashtags?.length ? meme.hashtags.map(t => `#${t}`).join(" ") : "-";
      const isVideo = meme.mediaType === 4 || meme.type === 1 || mediaUrl.endsWith(".mp4");
      const currentPostId = meme.postId || meme.postID || targetPostId || "-";
      const captionText = `${feedTitle}\n\n` + `📝 *Judul:* ${meme.title || "Tanpa Judul"}\n` + `👤 *Pembuat:* @${meme.userUsername || meme.userInfo?.username || "Anonim"}\n` + `🏷️ *Topik/Tag:* ${meme.topicTitle ? `[${meme.topicTitle}] ` : ""}${tags}\n` + `📊 *Statistik:* 👍 ${meme.totalUpvotes || 0} | 👎 ${meme.totalDownvotes || 0} | 💬 ${meme.totalComments || 0}\n` + `🔞 *Sensitif:* ${meme.isSensitive ? "Ya ⚠️" : "Tidak"}\n` + `🔗 *Post ID:* \`${currentPostId}\``;
      if (flags.sticker) {
        const mediaRes = await axios.get(mediaUrl, {
          responseType: "arraybuffer"
        });
        const mediaBuffer = Buffer.from(mediaRes.data);
        const exif = {
          packname: `Lahelu: ${(meme.title || "Meme").slice(0, 25)}`,
          author: `@${meme.userUsername || "Lahelu"}`
        };
        const stickerBuf = isVideo ? await writeExifVid(mediaBuffer, exif) : await writeExifImg(mediaBuffer, exif);
        await sock.sendMessage(ctx.id, {
          sticker: stickerBuf
        }, {
          quoted: quotedMsg
        });
        return ctx.react("✅");
      }
      if (isVideo) {
        await sock.sendMessage(ctx.id, {
          video: {
            url: mediaUrl
          },
          caption: captionText,
          mimetype: "video/mp4"
        }, {
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: mediaUrl
          },
          caption: captionText
        }, {
          quoted: quotedMsg
        });
      }
      if (postList.length > 1 && typeof ctx.sendCta === "function") {
        const otherRows = postList.filter(p => (p.postId || p.postID) !== currentPostId).slice(0, 8).map((p, i) => {
          const pid = p.postId || p.postID;
          return {
            title: `Meme #${i + 2}: ${(p.title || "Tanpa Judul").slice(0, 26)}`,
            id: `${prefix}lahelu --id ${pid}`,
            description: `👍 ${p.totalUpvotes || 0} | @${p.userUsername || "Anonim"} [${pid}]`
          };
        });
        if (otherRows.length > 0) {
          const buttons = [{
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: `📂 PILIH MEME LAINNYA`,
              sections: [{
                title: `🎭 REKOMENDASI TERKAIT`,
                rows: otherRows
              }]
            })
          }, {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: "📖 Bantuan & Kategori",
              id: `${prefix}lahelu --help`
            })
          }];
          await ctx.sendCta(`_Ditemukan ${postList.length} meme terkait di Lahelu. Klik tombol di bawah untuk membuka meme pilihan lainnya secara instan:_`, `${botName} • Lahelu Meme`, buttons, {
            quoted: quotedMsg
          });
        }
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[Lahelu Plugin Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error?.message || "Terjadi kesalahan";
      if (error?.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ Terjadi kesalahan saat memproses Lahelu: ${errorMessage}`);
    }
  }
};