import fs from "fs";
import path from "path";
import axios from "axios";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
import {
  upload
} from "./upload.js";
import {
  convert
} from "./exif.js";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/media");
async function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    await fs.promises.mkdir(TMP_DIR, {
      recursive: true
    });
  }
}
export function isAnimatedWebp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 30) return false;
  return buffer.includes(Buffer.from("ANIM")) || buffer.includes(Buffer.from("ANMF"));
}
export async function webpToPNG(buffer) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_in.webp`);
  const outputPath = path.join(TMP_DIR, `${time}_out.png`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -vcodec png -f image2 "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      return await fs.promises.readFile(outputPath);
    }
    throw new Error("Gagal membuat output PNG lokal");
  } catch (err) {
    const uploadRes = await upload(buffer);
    if (uploadRes?.status && uploadRes?.url) {
      const convertRes = await convert({
        url: uploadRes.url,
        from: "webp",
        to: "png"
      });
      const resultUrl = convertRes?.result || convertRes?.url;
      if (resultUrl) {
        const dlRes = await axios.get(resultUrl, {
          responseType: "arraybuffer",
          timeout: 3e4
        });
        return Buffer.from(dlRes.data);
      }
    }
    throw new Error(`Gagal konversi WebP ke PNG: ${err?.message || err}`);
  } finally {
    await Promise.all([fs.promises.unlink(inputPath).catch(() => {}), fs.promises.unlink(outputPath).catch(() => {})]);
  }
}
export async function webpToMP4(buffer) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_anim.webp`);
  const outputPath = path.join(TMP_DIR, `${time}_anim.mp4`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -c:v libx264 -pix_fmt yuv420p -profile:v baseline -level 3.0 -movflags +faststart -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      const resultBuf = await fs.promises.readFile(outputPath);
      if (resultBuf.length > 0) return resultBuf;
    }
    throw new Error("FFmpeg menghasilkan buffer MP4 kosong");
  } catch (err) {
    console.warn("[FFmpeg webpToMP4 Gagal, mengalihkan ke Fallback API]:", err?.message || err);
    const uploadRes = await upload(buffer);
    if (uploadRes?.status && uploadRes?.url) {
      const convertRes = await convert({
        url: uploadRes.url,
        from: "webp",
        to: "mp4"
      });
      const videoUrl = convertRes?.result || convertRes?.url;
      if (videoUrl) {
        const dlRes = await axios.get(videoUrl, {
          responseType: "arraybuffer",
          timeout: 45e3
        });
        if (dlRes.data && dlRes.data.length > 0) {
          return Buffer.from(dlRes.data);
        }
      }
    }
    throw new Error("Gagal mengonversi stiker animasi ke MP4");
  } finally {
    await Promise.all([fs.promises.unlink(inputPath).catch(() => {}), fs.promises.unlink(outputPath).catch(() => {})]);
  }
}
export async function webpToGIF(buffer) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_anim.webp`);
  const outputPath = path.join(TMP_DIR, `${time}_anim.gif`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    await execAsync(`ffmpeg -y -i "${inputPath}" -vf "fps=15,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" "${outputPath}"`);
    if (fs.existsSync(outputPath)) {
      const resultBuf = await fs.promises.readFile(outputPath);
      if (resultBuf.length > 0) return resultBuf;
    }
    throw new Error("Gagal menghasilkan GIF");
  } catch (err) {
    const uploadRes = await upload(buffer);
    if (uploadRes?.status && uploadRes?.url) {
      const convertRes = await convert({
        url: uploadRes.url,
        from: "webp",
        to: "gif"
      });
      const gifUrl = convertRes?.result || convertRes?.url;
      if (gifUrl) {
        const dlRes = await axios.get(gifUrl, {
          responseType: "arraybuffer",
          timeout: 45e3
        });
        return Buffer.from(dlRes.data);
      }
    }
    throw new Error(`Gagal konversi WebP ke GIF: ${err?.message || err}`);
  } finally {
    await Promise.all([fs.promises.unlink(inputPath).catch(() => {}), fs.promises.unlink(outputPath).catch(() => {})]);
  }
}