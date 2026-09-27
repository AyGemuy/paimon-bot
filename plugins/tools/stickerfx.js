import {
  writeExif
} from "../../lib/exif.js";
import {
  downloadMediaNode
} from "../../core/serialize.js";
global.stickerFxSessions = global.stickerFxSessions || new Map();
const STICKER_EFFECTS = {
  circle: {
    title: "⚪ Circle Crop (Bulat)",
    desc: "Potong foto/video menjadi stiker lingkaran rapi",
    opts: {
      circle: true
    }
  },
  nobg: {
    title: "✂️ Remove Background (No-BG)",
    desc: "Hapus latar belakang foto secara otomatis",
    opts: {
      nobg: true
    }
  },
  pixel: {
    title: "👾 8-Bit Pixelate (Retro)",
    desc: "Ubah stiker menjadi gaya pixel art game",
    opts: {
      pixel: 10
    }
  },
  blur: {
    title: "🌫️ Soft Blur Effect",
    desc: "Berikan efek buram artistik pada stiker",
    opts: {
      blur: 8
    }
  },
  sepia: {
    title: "🎞️ Vintage Sepia (Klasik)",
    desc: "Nuansa foto jadul hangat kecokelatan",
    opts: {
      sepia: true
    }
  },
  invert: {
    title: "🔮 Invert Colors (Negative)",
    desc: "Membalik warna stiker seperti klise film",
    opts: {
      invert: true
    }
  },
  fast: {
    title: "⏩ Fast Motion 2x (Video/GIF)",
    desc: "Percepat animasi stiker video 2 kali lipat",
    opts: {
      speed: 2
    }
  },
  reverse: {
    title: "🔄 Reverse Motion (Video/GIF)",
    desc: "Putar balik animasi stiker dari akhir ke awal",
    opts: {
      reverse: true
    }
  }
};

function resolveEffectKey(input = "") {
  if (!input || typeof input !== "string") return null;
  const clean = input.toLowerCase().trim();
  if (!clean || clean.length === 0) return null;
  if (STICKER_EFFECTS[clean]) return clean;
  for (const [key, val] of Object.entries(STICKER_EFFECTS)) {
    if (val.title.toLowerCase().includes(clean) || clean.includes(key)) {
      return key;
    }
  }
  if (clean.includes("pixel") || clean.includes("8-bit") || clean.includes("retro")) return "pixel";
  if (clean.includes("circle") || clean.includes("bulat")) return "circle";
  if (clean.includes("nobg") || clean.includes("remove") || clean.includes("hapus")) return "nobg";
  if (clean.includes("blur") || clean.includes("buram")) return "blur";
  if (clean.includes("sepia") || clean.includes("vintage") || clean.includes("klasik")) return "sepia";
  if (clean.includes("invert") || clean.includes("negative") || clean.includes("klise")) return "invert";
  if (clean.includes("fast") || clean.includes("cepat") || clean.includes("2x")) return "fast";
  if (clean.includes("reverse") || clean.includes("balik") || clean.includes("putar")) return "reverse";
  return null;
}
export default {
  name: "stickerfx",
  aliases: ["stikerefek", "editstiker"],
  description: "Pembuat Stiker dengan Filter Eksklusif via lib/exif Engine",
  category: "Tools",
  execute: async (sock, ctx, msg, {
    args,
    prefix,
    query
  }) => {
    const sessionKey = `${ctx.chat}_${ctx.senderNumber || ctx.sender}`;
    const rawEffectInput = (args[0] || query || "").trim();
    let effectKey = resolveEffectKey(rawEffectInput);
    let mediaTarget = null;
    let mime = "";
    const candidateNodes = [ctx.quoted?.msg || ctx.quoted, ctx.quoted?.quoted?.msg || ctx.quoted?.quoted, ctx.msg || ctx].filter(Boolean);
    for (const node of candidateNodes) {
      const candidateMime = node.mimetype || node.msg && node.msg.mimetype || "";
      if (/image|video|webp/.test(candidateMime)) {
        mediaTarget = node;
        mime = candidateMime;
        break;
      }
    }
    const cachedSession = global.stickerFxSessions.get(sessionKey);
    const hasValidSession = cachedSession && Date.now() - cachedSession.time < 5 * 60 * 1e3;
    if (!mediaTarget && !hasValidSession) {
      const helpText = `╭───『 🎨 *PANDUAN STICKER FX* 』\n` + `│ \n` + `│ Gunakan fitur ini untuk menambahkan filter\n` + `│ dan efek visual unik pada stiker kamu.\n` + `│ \n` + `│ 📌 *Cara Penggunaan:*\n` + `│ 1. Kirim / Balas (reply) *Foto / Video / Stiker*\n` + `│ 2. Ketik perintah: \`${prefix}stickerfx\`\n` + `│ 3. Pilih efek filter yang diinginkan dari menu\n` + `│ \n` + `│ 💡 *Tips Singkat:*\n` + `│ Anda juga bisa langsung memilih efek:\n` + `│ \`${prefix}stickerfx pixel\` (sambil reply media)\n` + `╰────────────────────────`;
      return await ctx.reply(helpText);
    }
    if (!effectKey || !STICKER_EFFECTS[effectKey]) {
      await ctx.react("📥");
      const downloadedBuffer = await downloadMediaNode(mediaTarget);
      if (!downloadedBuffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh media dari pesan yang Anda balas.");
      }
      global.stickerFxSessions.set(sessionKey, {
        buffer: downloadedBuffer,
        mime: mime,
        time: Date.now()
      });
      await ctx.react("✨");
      const rows = Object.entries(STICKER_EFFECTS).map(([key, val]) => ({
        title: val.title,
        description: val.desc,
        id: `${prefix}stickerfx ${key}`
      }));
      const bodyText = `╭───『 🎨 *STICKER FX STUDIO* 』\n` + `│ ✅ *Media Berhasil Diunduh!*\n` + `│ 🖼️ Format: \`${mime}\`\n` + `╰──────────────────\n\n` + `_Silakan pilih efek stiker yang ingin Anda buat di bawah ini:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎨 Pilih Filter Stiker",
          sections: [{
            title: "Daftar Efek Visual Stiker",
            rows: rows
          }],
          has_multiple_buttons: true
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${global.bot?.name || "Sticker Engine"} • EXIF Studio`, buttons, {
          quoted: msg
        });
      }
      return await ctx.reply(bodyText);
    }
    await ctx.react("⏳");
    const selected = STICKER_EFFECTS[effectKey];
    const finalBuffer = hasValidSession ? cachedSession.buffer : await downloadMediaNode(mediaTarget);
    const finalMime = hasValidSession ? cachedSession.mime : mime;
    if (!finalBuffer) {
      await ctx.react("❌");
      return ctx.reply("❌ Gagal memproses media stiker. Silakan reply ulang medianya.");
    }
    try {
      const metadata = {
        packname: global.bot?.packname || "Paimon Bot",
        author: global.bot?.author || "Wudysoft"
      };
      const stickerBuffer = await writeExif({
        data: finalBuffer,
        mimetype: finalMime
      }, metadata, selected.opts);
      await ctx.react("✅");
      await sock.sendMessage(ctx.id, {
        sticker: stickerBuffer
      }, {
        quoted: msg
      });
      global.stickerFxSessions.delete(sessionKey);
    } catch (err) {
      console.error("[STICKER FX ERROR]:", err);
      await ctx.react("❌");
      ctx.reply("❌ Gagal membuat stiker dengan efek tersebut.");
    }
  }
};