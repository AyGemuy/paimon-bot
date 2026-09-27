import fs from "fs";
import path from "path";
import {
  exec
} from "child_process";
import {
  promisify
} from "util";
const execAsync = promisify(exec);
const TMP_DIR = path.resolve("./tmp/video");
async function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    await fs.promises.mkdir(TMP_DIR, {
      recursive: true
    });
  }
}
export const HD_VIDEO_OPTIONS = ["-vf", "hqdn3d=1.5:1.5:4:4,scale=w='min(1920,trunc(iw*1.2/2)*2)':h='min(1080,trunc(ih*1.2/2)*2)':flags=lanczos,unsharp=5:5:0.8:5:5:0.0,eq=brightness=0.03:contrast=1.12:saturation=1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-preset", "medium", "-crf", "20", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"];
export async function enhanceHDVideo(buffer, customOptions = HD_VIDEO_OPTIONS) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_in.mp4`);
  const outputPath = path.join(TMP_DIR, `${time}_hd_out.mp4`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" ${customOptions.join(" ")} "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 100
    });
    if (fs.existsSync(outputPath)) {
      const outputBuffer = await fs.promises.readFile(outputPath);
      if (outputBuffer.length > 0) return outputBuffer;
    }
    throw new Error("Gagal merender output video HD.");
  } catch (error) {
    console.error("[enhanceHDVideo Error]:", error?.message || error);
    throw error;
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}
export async function compressVideo(buffer, targetCrf = 28) {
  await ensureTmpDir();
  const time = Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const inputPath = path.join(TMP_DIR, `${time}_in.mp4`);
  const outputPath = path.join(TMP_DIR, `${time}_comp_out.mp4`);
  await fs.promises.writeFile(inputPath, buffer);
  try {
    const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -crf ${targetCrf} -preset faster -vf "scale='min(720,trunc(iw/2)*2)':-2:flags=bicubic" -c:a aac -b:a 96k -movflags +faststart "${outputPath}"`;
    await execAsync(ffmpegCmd, {
      maxBuffer: 1024 * 1024 * 50
    });
    if (fs.existsSync(outputPath)) {
      const outputBuffer = await fs.promises.readFile(outputPath);
      if (outputBuffer.length > 0) return outputBuffer;
    }
    throw new Error("Gagal melakukan kompresi video.");
  } finally {
    await Promise.allSettled([fs.promises.unlink(inputPath), fs.promises.unlink(outputPath)]);
  }
}