import {
  ffmpeg
} from "../../lib/exif.js";
import {
  downloadMediaNode
} from "../../core/serialize.js";
global.audioFxSessions = global.audioFxSessions || new Map();
const FILTERS = {
  slowreverb: {
    title: "🌌 Slowed + Reverb",
    desc: "Tempo lambat santai dengan gema ruang luas",
    args: ["-vn", "-af", "asetrate=44100*0.85,aresample=44100,aecho=0.8:0.88:60:0.4", "-f", "mp3"]
  },
  eightd: {
    title: "🎧 8D Audio (Surround 360°)",
    desc: "Efek suara berputar kiri-kanan (Gunakan Headset)",
    args: ["-vn", "-af", "apulsator=hz=0.125", "-f", "mp3"]
  },
  nightcore: {
    title: "⚡ Nightcore",
    desc: "Tempo cepat dengan nada vokal tinggi anime style",
    args: ["-vn", "-af", "asetrate=44100*1.25,atempo=1.05", "-f", "mp3"]
  },
  bassboost: {
    title: "🔊 Extreme Bassboost",
    desc: "Meningkatkan dentuman bass secara maksimal",
    args: ["-vn", "-af", "equalizer=f=60:width_type=h:width=50:g=15,volume=1.3", "-f", "mp3"]
  },
  chipmunk: {
    title: "🐿️ Chipmunk (Alvin)",
    desc: "Suara karakter tupai lucu berkecepatan tinggi",
    args: ["-vn", "-af", "asetrate=44100*1.45", "-f", "mp3"]
  },
  robot: {
    title: "🤖 Robot Synthesizer",
    desc: "Modulasi vokal robotik futuristik",
    args: ["-vn", "-af", "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75", "-f", "mp3"]
  },
  underwater: {
    title: "🌊 Under Water (Dalam Air)",
    desc: "Efek suara teredam di kedalaman air",
    args: ["-vn", "-af", "lowpass=f=450", "-f", "mp3"]
  },
  reverse: {
    title: "🔄 Reverse Audio (Mundur)",
    desc: "Memutar rekaman suara dari belakang ke depan",
    args: ["-vn", "-af", "areverse", "-f", "mp3"]
  },
  tovn: {
    title: "🎙️ Konversi ke Voice Note (PTT)",
    desc: "Ubah audio biasa menjadi rekaman suara WhatsApp",
    args: ["-vn", "-c:a", "libopus", "-b:a", "128k", "-f", "opus"],
    isPtt: true
  }
};

function resolveAudioEffectKey(input = "") {
  if (!input || typeof input !== "string") return null;
  const clean = input.toLowerCase().trim();
  if (!clean || clean.length === 0) return null;
  if (FILTERS[clean]) return clean;
  for (const [key, val] of Object.entries(FILTERS)) {
    if (val.title.toLowerCase().includes(clean) || clean.includes(key)) {
      return key;
    }
  }
  if (clean.includes("slow") || clean.includes("reverb")) return "slowreverb";
  if (clean.includes("8d") || clean.includes("surround")) return "eightd";
  if (clean.includes("nightcore")) return "nightcore";
  if (clean.includes("bass") || clean.includes("boost")) return "bassboost";
  if (clean.includes("chipmunk") || clean.includes("alvin") || clean.includes("tupai")) return "chipmunk";
  if (clean.includes("robot")) return "robot";
  if (clean.includes("water") || clean.includes("air")) return "underwater";
  if (clean.includes("reverse") || clean.includes("mundur")) return "reverse";
  if (clean.includes("vn") || clean.includes("ptt") || clean.includes("voicenote")) return "tovn";
  return null;
}
export default {
  name: "audiofx",
  aliases: ["audiofx", "filteraudio", "vcedit"],
  description: "Audio Effect Studio & Voice Changer via Buffer FFmpeg Engine",
  category: "Media",
  execute: async (sock, ctx, msg, {
    args,
    prefix,
    query
  }) => {
    const sessionKey = `${ctx.chat}_${ctx.senderNumber || ctx.sender}`;
    const rawEffectInput = (args[0] || query || "").trim();
    let effectKey = resolveAudioEffectKey(rawEffectInput);
    let mediaTarget = null;
    let mime = "";
    const candidateNodes = [ctx.quoted?.msg || ctx.quoted, ctx.quoted?.quoted?.msg || ctx.quoted?.quoted, ctx.msg || ctx].filter(Boolean);
    for (const node of candidateNodes) {
      const candidateMime = node.mimetype || node.msg && node.msg.mimetype || "";
      if (/audio|video/.test(candidateMime)) {
        mediaTarget = node;
        mime = candidateMime;
        break;
      }
    }
    const cachedSession = global.audioFxSessions.get(sessionKey);
    const hasValidSession = cachedSession && Date.now() - cachedSession.time < 5 * 60 * 1e3;
    if (!mediaTarget && !hasValidSession) {
      const helpText = `╭───『 🎛️ *PANDUAN AUDIO FX* 』\n` + `│ \n` + `│ Ubah suara audio, voice note, atau video\n` + `│ dengan preset efek DSP & synthesizer.\n` + `│ \n` + `│ 📌 *Cara Penggunaan:*\n` + `│ 1. Kirim / Balas (reply) *Audio / VN / Video*\n` + `│ 2. Ketik perintah: \`${prefix}audiofx\`\n` + `│ 3. Pilih efek audio dari menu yang muncul\n` + `│ \n` + `│ 💡 *Tips Singkat:*\n` + `│ Anda juga bisa langsung memilih efek:\n` + `│ \`${prefix}audiofx slowreverb\` (sambil reply audio)\n` + `╰────────────────────────`;
      return await ctx.reply(helpText);
    }
    if (!effectKey || !FILTERS[effectKey]) {
      await ctx.react("📥");
      const downloadedBuffer = await downloadMediaNode(mediaTarget);
      if (!downloadedBuffer) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh audio dari pesan yang Anda balas.");
      }
      global.audioFxSessions.set(sessionKey, {
        buffer: downloadedBuffer,
        mime: mime,
        time: Date.now()
      });
      await ctx.react("🎚️");
      const rows = Object.entries(FILTERS).map(([key, val]) => ({
        title: val.title,
        description: val.desc,
        id: `${prefix}audiofx ${key}`
      }));
      const bodyText = `╭───『 🎛️ *AUDIO FX & DSP STUDIO* 』\n` + `│ ✅ *Audio Berhasil Diunduh!*\n` + `│ 🎵 Format: \`${mime}\`\n` + `╰──────────────────\n\n` + `_Silakan pilih preset efek suara di bawah untuk memproses audio:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "🎚️ Pilih Efek Audio",
          sections: [{
            title: "Preset Efek Suara",
            rows: rows
          }],
          has_multiple_buttons: true
        })
      }];
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${global.bot?.name || "Audio Engine"} • DSP Studio`, buttons, {
          quoted: msg
        });
      }
      return await ctx.reply(bodyText);
    }
    await ctx.react("⏳");
    const selected = FILTERS[effectKey];
    const finalBuffer = hasValidSession ? cachedSession.buffer : await downloadMediaNode(mediaTarget);
    if (!finalBuffer) {
      await ctx.react("❌");
      return ctx.reply("❌ Gagal memproses audio. Silakan balas ulang file audionya.");
    }
    try {
      const outBuffer = await ffmpeg(finalBuffer, selected.args);
      await ctx.react("✅");
      await sock.sendMessage(ctx.id, {
        audio: outBuffer,
        mimetype: selected.isPtt ? "audio/ogg; codecs=opus" : "audio/mp4",
        ptt: Boolean(selected.isPtt)
      }, {
        quoted: msg
      });
      global.audioFxSessions.delete(sessionKey);
    } catch (err) {
      console.error("[FFMPEG AUDIO FX ERROR]:", err);
      await ctx.react("❌");
      ctx.reply("❌ Gagal memproses efek audio pada media ini.");
    }
  }
};