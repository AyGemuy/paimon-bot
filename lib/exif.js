import axios from "axios";
import crypto from "crypto";
import {
  spawn
} from "child_process";
import webp from "node-webpmux";
import {
  upload
} from "./upload.js";
const EZGIF_URL = "https://wudysoft.my.id/api/tools/ezgif";
const PRIMARY_REMOVEBG_API = "https://wudysoft.my.id/api/tools/remove-bg/v18";
const FALLBACK_REMOVEBG_API = "https://wudysoft.my.id/api/tools/remove-bg/v12";

function isWebpBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  return buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
}

function isAnimatedWebp(buf) {
  if (!isWebpBuffer(buf)) return false;
  return buf.indexOf("ANIM") !== -1;
}

function isGifBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return false;
  const header = buf.subarray(0, 4).toString("ascii");
  return header === "GIF8";
}

function isMp4Buffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
  return buf.subarray(4, 8).toString("ascii") === "ftyp";
}
const spawnFFmpeg = (buffer, args = []) => {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-y", "-i", "pipe:0", ...args, "pipe:1"]);
    const buffers = [];
    let stderr = "";
    ff.stdout.on("data", chunk => buffers.push(chunk));
    ff.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    ff.stdin.on("error", err => {
      if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
        console.warn("[FFmpeg stdin Warning]:", err.message);
      }
    });
    ff.on("close", code => {
      if (code === 0) {
        resolve(Buffer.concat(buffers));
      } else {
        console.error("[FFmpeg Error Details]:", stderr.slice(-300));
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    ff.on("error", reject);
    try {
      ff.stdin.write(buffer);
      ff.stdin.end();
    } catch (e) {
      if (e.code !== "ERR_STREAM_DESTROYED") reject(e);
    }
  });
};
async function convertToWebpViaApi(buffer, isVideo = false) {
  try {
    console.warn("[FFmpeg fallback] Mengalihkan konversi ke Online Ezgif API...");
    const uploadRes = await upload(buffer);
    if (!uploadRes?.status || !uploadRes?.url) {
      throw new Error("Gagal mengunggah media untuk API fallback");
    }
    const fileUrl = uploadRes.url;
    const type = isVideo ? "video-to-webp" : "image-to-webp";
    const res = await axios.post(EZGIF_URL, {
      type: type,
      url: fileUrl
    }, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 45e3
    });
    let resultUrl = res.data?.result || res.data?.url || res.data?.data;
    if (!resultUrl && !isVideo) {
      const retryRes = await axios.post(EZGIF_URL, {
        type: "png-to-webp",
        url: fileUrl
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 45e3
      });
      resultUrl = retryRes.data?.result || retryRes.data?.url || retryRes.data?.data;
    }
    if (!resultUrl) {
      throw new Error(res.data?.message || "Ezgif API tidak mengembalikan link WebP");
    }
    const dlRes = await axios.get(resultUrl, {
      responseType: "arraybuffer",
      timeout: 45e3
    });
    if (dlRes.data && dlRes.data.length > 0) {
      const webpBuf = Buffer.from(dlRes.data);
      if (isWebpBuffer(webpBuf)) return webpBuf;
    }
    throw new Error("Hasil download API bukan WebP valid");
  } catch (error) {
    console.error("[convertToWebpViaApi Error]:", error?.message || error);
    throw error;
  }
}
async function removeBgBuffer(buffer) {
  try {
    const uploadRes = await upload(buffer);
    if (!uploadRes?.status || !uploadRes?.url) return buffer;
    const imageUrl = uploadRes.url;
    let transparentUrl = null;
    try {
      const res = await axios.get(PRIMARY_REMOVEBG_API, {
        params: {
          imageUrl: imageUrl
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      transparentUrl = res.data?.result?.output?.[0];
    } catch (err) {
      console.warn("[RemoveBG v18 Error, beralih ke Fallback v12]:", err.message);
    }
    if (!transparentUrl) {
      try {
        const resFallback = await axios.get(FALLBACK_REMOVEBG_API, {
          params: {
            imageUrl: imageUrl
          },
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          timeout: 45e3
        });
        transparentUrl = resFallback.data?.transformed || resFallback.data?.result || resFallback.data?.image;
      } catch (errFallback) {
        console.warn("[RemoveBG v12 Fallback Error]:", errFallback.message);
      }
    }
    if (transparentUrl) {
      const imgRes = await axios.get(transparentUrl, {
        responseType: "arraybuffer",
        timeout: 3e4
      });
      if (imgRes.data && imgRes.data.length > 500) {
        return Buffer.from(imgRes.data);
      }
    }
  } catch (e) {
    console.warn("[removeBgBuffer Warning]:", e?.message || e);
  }
  return buffer;
}

function buildVideoFilters(opts = {}, isVideo = false) {
  const filters = [];
  const size = Math.min(Math.max(Number(opts.scale) || 512, 128), 512);
  if (isVideo) {
    const fps = Math.min(Math.max(Number(opts.fps) || 15, 1), 30);
    filters.push(`fps=${fps}`);
  }
  if (isVideo && opts.speed && !isNaN(opts.speed) && Number(opts.speed) > 0) {
    filters.push(`setpts=(PTS/${Number(opts.speed)})`);
  }
  if (isVideo && opts.reverse) {
    filters.push("reverse");
  }
  if (opts.rotate) {
    const rot = Number(opts.rotate);
    if (rot === 90) filters.push("transpose=1");
    else if (rot === 180) filters.push("hflip,vflip");
    else if (rot === 270) filters.push("transpose=2");
  }
  if (opts.flip) {
    const fl = String(opts.flip).toLowerCase();
    if (fl === "h" || fl === "horizontal") filters.push("hflip");
    else if (fl === "v" || fl === "vertical") filters.push("vflip");
  }
  if (opts.gray || opts.grayscale) {
    filters.push("hue=s=0");
  }
  if (opts.invert) {
    filters.push("negate");
  }
  if (opts.sepia) {
    filters.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131");
  }
  if (opts.bright || opts.contrast || opts.sat) {
    const b = Number(opts.bright) || 0;
    const c = Number(opts.contrast) || 1;
    const s = Number(opts.sat) || 1;
    filters.push(`eq=brightness=${b}:contrast=${c}:saturation=${s}`);
  }
  if (opts.blur) {
    const sigma = Math.min(Math.max(Number(opts.blur) || 5, 1), 30);
    filters.push(`gblur=sigma=${sigma}`);
  }
  if (opts.pixel || opts.pixelate) {
    const p = Math.min(Math.max(Number(opts.pixel || opts.pixelate) || 8, 2), 32);
    filters.push(`scale=iw/${p}:ih/${p}:flags=neighbor,scale=iw*${p}:ih*${p}:flags=neighbor`);
  }
  if (opts.vignette) {
    filters.push("vignette=PI/4");
  }
  if (opts.colorkey) {
    const color = String(opts.colorkey).startsWith("0x") ? opts.colorkey : `0x${opts.colorkey}`;
    filters.push(`colorkey=${color}:0.3:0.1`);
  }
  if (opts.crop) {
    const cropVal = String(opts.crop).toLowerCase().trim();
    if (cropVal === "square" || cropVal === "1:1") {
      filters.push("crop=min(iw\\,ih):min(iw\\,ih)");
    } else if (cropVal.includes("x")) {
      const [w, h] = cropVal.split("x");
      if (w && h) filters.push(`crop=${w}:${h}`);
    } else if (cropVal.includes(":")) {
      filters.push(`crop=${cropVal}`);
    }
  }
  if (opts.circle || opts.round || String(opts.crop).toLowerCase() === "circle") {
    filters.push("format=rgba");
    filters.push("crop=min(iw\\,ih):min(iw\\,ih)");
    filters.push("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-W/2\\,Y-H/2)\\,W/2)\\,255\\,0)'");
  }
  if (opts.stretch) {
    filters.push(`scale=${size}:${size}`);
  } else {
    filters.push(`scale='if(gt(a,1),${size},-1)':'if(gt(a,1),-1,${size})':flags=lanczos`, `pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`);
  }
  filters.push("format=yuva420p");
  return filters.join(",");
}

function buildFullExif(metadata = {}) {
  const botConfig = global.bot || {};
  const hasPackname = "packname" in metadata || "packName" in metadata || "title" in metadata;
  const hasAuthor = "author" in metadata || "publisher" in metadata || "creator" in metadata;
  const packname = hasPackname ? metadata.packname ?? metadata.packName ?? metadata.title ?? "" : botConfig.packname || botConfig.name || "";
  const author = hasAuthor ? metadata.author ?? metadata.publisher ?? metadata.creator ?? "" : botConfig.author?.name || botConfig.author || "";
  const packId = metadata.packId || metadata.id || metadata["sticker-pack-id"] || crypto.randomBytes(16).toString("hex");
  let emojis = [""];
  if (Array.isArray(metadata.categories || metadata.emojis)) {
    emojis = metadata.categories || metadata.emojis;
  } else if (typeof(metadata.categories || metadata.emojis) === "string") {
    emojis = (metadata.categories || metadata.emojis).split(",").map(e => e.trim()).filter(Boolean);
  }
  const json = {
    "sticker-pack-id": String(packId),
    "sticker-pack-name": String(packname),
    "sticker-pack-publisher": String(author),
    "sticker-pack-publisher-email": metadata.email || metadata.publisherEmail || "",
    "sticker-pack-publisher-website": metadata.website || metadata.url || botConfig.utils?.source_urls || "",
    "android-app-store-link": metadata.androidApp || metadata.androidStoreLink || "https://play.google.com/store/apps/details?id=com.whatsapp",
    "ios-app-store-link": metadata.iosApp || metadata.iosStoreLink || "https://apps.apple.com/app/whatsapp-messenger/id310633997",
    emojis: emojis.length ? emojis : [""],
    "is-avatar-sticker": metadata.isAvatar ? 1 : 0,
    "is-ai-sticker": metadata.isAi ? 1 : 0
  };
  const exifAttr = Buffer.from([73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 65, 87, 7, 0, 0, 0, 0, 0, 22, 0, 0, 0]);
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  return exif;
}
async function injectExif(webpBuffer, metadata = {}) {
  try {
    let finalBuffer = webpBuffer;
    if (!isWebpBuffer(finalBuffer)) {
      finalBuffer = await imageToWebp(finalBuffer);
    }
    const img = new webp.Image();
    await img.load(finalBuffer);
    img.exif = buildFullExif(metadata);
    return await img.save(null);
  } catch (error) {
    console.error("[injectExif Error]:", error?.message || error);
    if (isWebpBuffer(webpBuffer)) return webpBuffer;
    throw error;
  }
}
async function imageToWebp(media, opts = {}) {
  let sourceMedia = media;
  if (opts.nobg || opts.removebg) {
    sourceMedia = await removeBgBuffer(media);
  }
  try {
    const filterChain = buildVideoFilters(opts, false);
    const quality = Math.min(Math.max(Number(opts.quality) || 75, 1), 100);
    const args = ["-vcodec", "libwebp", "-vf", filterChain, "-preset", "default", "-loop", "0", "-vsync", "0", "-q:v", String(quality), "-f", "webp"];
    const resBuf = await spawnFFmpeg(sourceMedia, args);
    if (isWebpBuffer(resBuf)) return resBuf;
    throw new Error("FFmpeg output is not a valid WebP buffer");
  } catch (localError) {
    console.warn("[FFmpeg Image Gagal, beralih ke Fallback Online API]:", localError?.message || localError);
    return await convertToWebpViaApi(sourceMedia, false);
  }
}
async function videoToWebp(media, opts = {}) {
  try {
    const filterChain = buildVideoFilters(opts, true);
    const quality = Math.min(Math.max(Number(opts.quality) || 55, 1), 100);
    const args = [];
    if (opts.ss || opts.start) {
      args.push("-ss", String(opts.ss || opts.start));
    }
    const duration = opts.t || opts.duration || "6";
    args.push("-t", String(duration));
    args.push("-vcodec", "libwebp", "-vf", filterChain, "-loop", "0", "-preset", "default", "-an", "-vsync", "0", "-lossless", "0", "-compression_level", "4", "-q:v", String(quality), "-f", "webp");
    const resBuf = await spawnFFmpeg(media, args);
    if (isWebpBuffer(resBuf)) return resBuf;
    throw new Error("FFmpeg output is not a valid WebP buffer");
  } catch (localError) {
    console.warn("[FFmpeg Video Gagal, beralih ke Fallback Online API]:", localError?.message || localError);
    return await convertToWebpViaApi(media, true);
  }
}
async function writeExifImg(media, metadata = {}, opts = {}) {
  try {
    const isConverted = typeof opts === "boolean" ? opts : false;
    const options = typeof opts === "object" && opts !== null ? opts : {};
    const wMedia = isConverted && isWebpBuffer(media) ? media : await imageToWebp(media, options);
    return await injectExif(wMedia, metadata);
  } catch (error) {
    console.error("[writeExifImg Error]:", error?.message || error);
    throw error;
  }
}
async function writeExifVid(media, metadata = {}, opts = {}) {
  try {
    const isConverted = typeof opts === "boolean" ? opts : false;
    const options = typeof opts === "object" && opts !== null ? opts : {};
    const wMedia = isConverted && isWebpBuffer(media) ? media : await videoToWebp(media, options);
    return await injectExif(wMedia, metadata);
  } catch (error) {
    console.error("[writeExifVid Error]:", error?.message || error);
    throw error;
  }
}
async function writeExif(media, metadata = {}, opts = {}) {
  try {
    const buffer = media?.data || media;
    const mime = (media?.mimetype || "").toLowerCase();
    const options = typeof opts === "object" && opts !== null ? opts : {};
    if (Buffer.isBuffer(buffer)) {
      const isWebp = isWebpBuffer(buffer);
      const isAnim = isAnimatedWebp(buffer);
      const isGif = isGifBuffer(buffer);
      const isMp4 = isMp4Buffer(buffer);
      const isVideoMime = /video|gif|mp4|mov|webm/.test(mime);
      const hasCustomFilter = Object.keys(options).some(k => ["crop", "fps", "circle", "round", "speed", "rotate", "flip", "gray", "invert", "stretch", "scale", "nobg", "removebg", "blur", "pixel", "pixelate", "sepia", "vignette", "bright", "contrast", "sat", "colorkey"].includes(k));
      if (isWebp && !hasCustomFilter) {
        return await injectExif(buffer, metadata);
      }
      if (isVideoMime || isMp4 || isGif || isWebp && isAnim) {
        return await writeExifVid(buffer, metadata, options);
      }
      return await writeExifImg(buffer, metadata, options);
    }
    return await writeExifImg(buffer, metadata, options);
  } catch (error) {
    console.error("[writeExif Error]:", error?.message || error);
    throw error;
  }
}
async function convert({
  url,
  from = "",
  to = ""
} = {}) {
  try {
    if (!url) throw new Error("Parameter 'url' is required");
    let type = `${from}-to-${to}`.toLowerCase();
    if (from === "mp4" || from === "video") type = "video-to-webp";
    if (to === "mp4") type = "webp-to-mp4";
    if (from === "image" || from === "png" || from === "jpg" || from === "jpeg") type = "image-to-webp";
    const res = await axios.post(EZGIF_URL, {
      type: type,
      url: url
    }, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 45e3
    });
    const resultUrl = res.data?.result || res.data?.url || res.data?.data;
    if (resultUrl) return {
      status: true,
      result: resultUrl
    };
    return {
      status: false,
      error: res.data?.message || "Gagal mengonversi via Ezgif API"
    };
  } catch (error) {
    console.error(`[Convert Error ${from}->${to}]:`, error?.message || error);
    return {
      status: false,
      error: error?.message || String(error)
    };
  }
}
async function getWebpUrl(fileUrl) {
  if (typeof fileUrl === "string" && fileUrl.endsWith(".tgs")) {
    try {
      const convertRes = await axios.post(EZGIF_URL, {
        type: "tgs-to-webp",
        url: fileUrl
      }, {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 3e4
      });
      if (convertRes.data?.result) return convertRes.data.result;
    } catch (e) {
      console.warn("[getWebpUrl TGS Warning]:", e.message);
    }
  }
  return fileUrl;
}
export {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
  writeExif,
  buildFullExif,
  injectExif,
  convert,
  getWebpUrl,
  spawnFFmpeg as ffmpeg,
  removeBgBuffer,
  convertToWebpViaApi
};