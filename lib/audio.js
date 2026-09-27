import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
import axios from "axios";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/audio");
async function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    await fs.promises.mkdir(TMP_DIR, {
      recursive: true
    });
  }
}
export const EIGHT_D_OPTIONS = ["-af", "apulsator=hz=0.125:mode=sine:width=1,extrastereo=m=1.2", "-vn", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "192k"];
export async function fetchAudioBuffer(url) {
  const {
    data
  } = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 6e4,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
  });
  return Buffer.from(data);
}
export async function toPTT(buffer) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_in.raw`);
  const outputPath = path.join(TMP_DIR, `${time}_out.ogg`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -c:a libopus -b:a 64k -vbr on -compression_level 10 -ar 48000 -ac 1 -avoid_negative_ts make_zero "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error("Gagal membuat output PTT OGG");
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}
export async function toMP3(buffer) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_in.raw`);
  const outputPath = path.join(TMP_DIR, `${time}_out.mp3`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -c:a libmp3lame -q:a 2 -ar 44100 "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error("Gagal membuat output MP3");
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}
export async function to8DAudio(buffer, customOptions = EIGHT_D_OPTIONS) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_8d_in.raw`);
  const outputPath = path.join(TMP_DIR, `${time}_8d_out.mp3`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" ${customOptions.join(" ")} "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error("Gagal membuat output 8D Audio");
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}
export async function applyAudioFilter(buffer, filterType = "bassboost") {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_af_in.raw`);
  const outputPath = path.join(TMP_DIR, `${time}_af_out.mp3`);
  let filter = "equalizer=f=60:width_type=h:width=50:g=10";
  if (filterType === "nightcore") {
    filter = "asetrate=44100*1.25,aresample=44100,atempo=1.05";
  } else if (filterType === "slowed") {
    filter = "asetrate=44100*0.85,aresample=44100,aecho=0.8:0.88:60:0.4";
  } else if (filterType === "reverse") {
    filter = "areverse";
  } else if (filterType === "robot") {
    filter = "flanger=delay=10:depth=10:regen=50:width=100:speed=0.5";
  }
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -vn -af "${filter}" -c:a libmp3lame -b:a 192k "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error(`Gagal menerapkan filter audio: ${filterType}`);
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}
export async function sendPTT(sock, targetJid, audioBufferOrUrl, quotedMsg = null) {
  let rawBuffer = Buffer.isBuffer(audioBufferOrUrl) ? audioBufferOrUrl : await fetchAudioBuffer(audioBufferOrUrl);
  try {
    const pttBuffer = await toPTT(rawBuffer);
    return await sock.sendMessage(targetJid, {
      audio: pttBuffer,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true
    }, {
      quoted: quotedMsg
    });
  } catch (err) {
    console.error("[sendPTT Fallback]:", err.message);
    return await sock.sendMessage(targetJid, {
      audio: rawBuffer,
      mimetype: "audio/mp4",
      ptt: true
    }, {
      quoted: quotedMsg
    });
  }
}