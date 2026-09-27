import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/ai/music/soniva";
export default {
  name: "soniva",
  aliases: ["aimusic", "createsong", "sonivamusic", "bikinlagu"],
  description: "Buat musik & lagu AI via Soniva API",
  category: "AI",
  limit: true,
  example: "soniva <prompt> [--genre Pop] [--mood Happy] atau soniva --library <user_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = (ctx.query || ctx.text || "").trim();
      if (!text) {
        return ctx.reply(`🎵 *SONIVA AI MUSIC*\n\n` + `• *Generate Lagu:*\n` + `  👉 \`${ctx.prefix || "."}soniva sad lofi song in the club\`\n\n` + `• *Dengan Parameter:*\n` + `  👉 \`${ctx.prefix || "."}soniva lagu romantis --lyrics [verse] saat kau tersenyum --genre Pop --mood Romantic\`\n\n` + `• *Cek Library via User ID:*\n` + `  👉 \`${ctx.prefix || "."}soniva --library <user_id>\``);
      }
      await ctx.react("⏳");
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const libraryMatch = text.match(/--library(?:\s+([^\s]+))?/i);
      if (libraryMatch) {
        const targetUserId = libraryMatch[1] || text.replace(/--library/i, "").trim();
        if (!targetUserId) {
          await ctx.react("❌");
          return ctx.reply(`❌ Masukkan user_id!\nContoh: \`${ctx.prefix || "."}soniva --library 65c62ae3-51e9-4927-93a4-4693b547e6c0\``);
        }
        const {
          data: libRes
        } = await axios.post(API_BASE, {
          action: "library",
          user_id: targetUserId,
          page: 1,
          limit: 10
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        const songs = libRes?.data?.songs || [];
        if (!songs.length) {
          await ctx.react("❌");
          return ctx.reply(`📭 Tidak ada lagu ditemukan untuk user_id: \`${targetUserId}\``);
        }
        const topSong = songs[0];
        const songTitle = topSong.title || "AI Song";
        const songLyrics = (topSong.lyrics || "").trim();
        let caption = `📚 *SONIVA MUSIC LIBRARY*\n\n`;
        caption += `📌 *Judul:* ${songTitle}\n`;
        caption += `⏱️ *Durasi:* ${Math.round(topSong.duration || 0)}s\n`;
        caption += `👤 *User ID:* \`${targetUserId}\`\n`;
        if (topSong.share_url) caption += `🌐 *Player:* ${topSong.share_url}\n`;
        if (songLyrics && songLyrics !== "[null]") {
          const truncated = songLyrics.length > 300 ? songLyrics.substring(0, 300) + "\n\n...(lirik dipotong)" : songLyrics;
          caption += `\n📜 *Lirik:*\n\`\`\`\n${truncated}\n\`\`\``;
        }
        if (topSong.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: topSong.image_url
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption.trim());
        }
        if (topSong.audio_url) {
          await sock.sendMessage(ctx.id, {
            audio: {
              url: topSong.audio_url
            },
            mimetype: "audio/mp4",
            fileName: `${songTitle}.mp3`,
            ptt: false
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      let genre = "Pop";
      let mood = "Happy,Romantic";
      let lyrics = null;
      let title = "";
      const genreMatch = text.match(/--genre\s+([^\s]+)/i);
      if (genreMatch) {
        genre = genreMatch[1];
        text = text.replace(genreMatch[0], "").trim();
      }
      const moodMatch = text.match(/--mood\s+([^\s]+)/i);
      if (moodMatch) {
        mood = moodMatch[1];
        text = text.replace(moodMatch[0], "").trim();
      }
      const lyricsMatch = text.match(/--lyrics\s+([\s\S]+)/i);
      if (lyricsMatch) {
        lyrics = lyricsMatch[1].trim();
        text = text.replace(lyricsMatch[0], "").trim();
      }
      const prompt = text || "sad lofi song in the club";
      const genPayload = {
        action: "generate",
        prompt: prompt,
        genre: genre,
        mood: mood,
        has_vocal: true,
        vocal_gender: "random",
        is_dual: true,
        ...lyrics ? {
          lyrics: lyrics
        } : {},
        ...title ? {
          title: title
        } : {}
      };
      const {
        data: genRes
      } = await axios.post(API_BASE, genPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      if (!genRes || !genRes.success || !genRes.data) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal generate musik: ${genRes?.message || "Server error"}`);
      }
      const returnedUserId = genRes.user_id || genRes.data?.user_id;
      const {
        data: libRes
      } = await axios.post(API_BASE, {
        action: "library",
        user_id: returnedUserId,
        page: 1,
        limit: 10
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      const songs = libRes?.data?.songs || [];
      const song = songs[0];
      if (song && song.audio_url) {
        const songTitle = song.title || "AI Generated Song";
        const songLyrics = (song.lyrics || "").trim();
        let caption = `🎵 *SONIVA MUSIC GENERATED*\n\n`;
        caption += `📌 *Judul:* ${songTitle}\n`;
        caption += `⏱️ *Durasi:* ${Math.round(song.duration || 0)}s\n`;
        caption += `🎭 *Genre:* ${genre} | *Mood:* ${mood}\n`;
        caption += `👤 *User ID:* \`${returnedUserId}\`\n`;
        if (song.share_url) {
          caption += `🌐 *Player:* ${song.share_url}\n`;
        }
        if (songLyrics && songLyrics !== "[null]") {
          const truncatedLyrics = songLyrics.length > 300 ? songLyrics.substring(0, 300) + "\n\n...(lirik dipotong)" : songLyrics;
          caption += `\n📜 *Lirik:*\n\`\`\`\n${truncatedLyrics}\n\`\`\``;
        }
        if (song.image_url) {
          await sock.sendMessage(ctx.id, {
            image: {
              url: song.image_url
            },
            caption: caption.trim()
          }, {
            quoted: quotedMsg
          });
        } else {
          await ctx.reply(caption.trim());
        }
        await sock.sendMessage(ctx.id, {
          audio: {
            url: song.audio_url
          },
          mimetype: "audio/mp4",
          fileName: `${songTitle}.mp3`,
          ptt: false
        }, {
          quoted: quotedMsg
        });
      } else {
        let info = `🚀 *SONIVA JOB CREATED*\n\n`;
        info += `🆔 *Job ID:* \`${genRes.data.job_id || "-"}\`\n`;
        info += `👤 *User ID:* \`${returnedUserId}\`\n`;
        info += `⚙️ *Status:* \`${genRes.data.status || "created"}\`\n\n`;
        info += `_Ketik \`${ctx.prefix || "."}soniva --library ${returnedUserId}\` untuk mengambil lagu._`;
        await sock.sendMessage(ctx.id, {
          text: info.trim()
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Soniva Error: ${error.response?.data?.message || error.message}`);
    }
  }
};