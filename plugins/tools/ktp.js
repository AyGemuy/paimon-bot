import axios from "axios";
import {
  upload
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://wudysoft.my.id/api/maker/ktp/v1";
const DEFAULT_AVATAR = "https://files.catbox.moe/8ugr9a.jpg";

function generateRandomNIK() {
  const prov = "33";
  const kab = "74";
  const kec = "01";
  const date = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const year = String(Math.floor(Math.random() * 40) + 60);
  const randomQueue = String(Math.floor(Math.random() * 9e3) + 1e3);
  return `${prov}${kab}${kec}${date}${month}${year}${randomQueue}`;
}

function parseKtpFlags(input = "") {
  const flags = {};
  const flagRegex = /--([a-zA-Z0-9_-]+)(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = match[1].toLowerCase();
    let rawVal = match[2];
    let val = true;
    if (["nama", "name", "n"].includes(key)) key = "nama";
    if (["nik", "id"].includes(key)) key = "nik";
    if (["prov", "provinsi"].includes(key)) key = "provinsi";
    if (["kab", "kabupaten", "kota"].includes(key)) key = "kabupaten";
    if (["ttl", "lahir"].includes(key)) key = "ttl";
    if (["gender", "jk", "kelamin", "sex"].includes(key)) key = "gender";
    if (["darah", "goldar"].includes(key)) key = "darah";
    if (["alamat", "address"].includes(key)) key = "alamat";
    if (["rt", "rw", "rtrw"].includes(key)) key = "rt";
    if (["desa", "kelurahan"].includes(key)) key = "desa";
    if (["kec", "kecamatan"].includes(key)) key = "kecamatan";
    if (["agama", "religion"].includes(key)) key = "agama";
    if (["status", "kawin"].includes(key)) key = "status";
    if (["pekerjaan", "job", "kerja"].includes(key)) key = "pekerjaan";
    if (["kewarganegaraan", "warga", "wni"].includes(key)) key = "kewarganegaraan";
    if (["berlaku"].includes(key)) key = "berlaku";
    if (["dibuat"].includes(key)) key = "dibuat";
    if (["terbuat", "tanggal"].includes(key)) key = "terbuat";
    if (["sign", "ttd", "signature"].includes(key)) key = "sign";
    if (["model", "template", "m"].includes(key)) key = "model";
    if (["type", "v"].includes(key)) key = "type";
    if (["photo", "foto", "img", "image"].includes(key)) key = "photo";
    if (["help", "h"].includes(key)) key = "help";
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (!isNaN(rawVal) && rawVal.trim() !== "" && ["model"].includes(key)) {
        val = Number(rawVal);
      } else {
        val = rawVal;
      }
    }
    flags[key] = val;
  }
  const cleanText = input.replace(flagRegex, "").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "ktp",
  aliases: ["ktpmaker", "makektp", "fakektp"],
  description: "Buat KTP Indonesia custom (Model 1 - 4, auto foto profil / upload foto)",
  category: "Maker",
  limit: true,
  example: "ktp Joko Widodo atau ktp --nama 'Budi Santoso' --model 2 atau reply foto dengan .ktp",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const rawQuery = (ctx.query || ctx.args?.join(" ") || "").trim();
      const {
        flags,
        cleanText
      } = parseKtpFlags(rawQuery);
      if (flags.help) {
        return ctx.reply(`🇮🇩 *INDONESIA KTP GENERATOR*\n\n` + `• *Cara Penggunaan Instan:*\n` + `  👉 Foto Sendiri: \`${prefix}ktp Joko Widodo\`\n` + `  👉 Mention Orang: \`${prefix}ktp @user\`\n` + `  👉 Reply Foto: Balas foto lalu ketik \`${prefix}ktp Budi Santoso\`\n\n` + `• *Opsi Kustomisasi Flags Lengkap:*\n` + `  • \`--model <1-4>\` (Pilih template model KTP 1 s/d 4)\n` + `  • \`--nama <nama>\` (Nama Lengkap)\n` + `  • \`--nik <16 digit>\` (Nomor Induk Kependudukan)\n` + `  • \`--provinsi <nama>\` (Contoh: JAWA TENGAH)\n` + `  • \`--kabupaten <nama>\` (Contoh: SEMARANG)\n` + `  • \`--ttl <kota, tgl bln thn>\` (Contoh: Surakarta, 21 Juni 1961)\n` + `  • \`--gender <Laki-laki/Perempuan>\`\n` + `  • \`--darah <A/B/AB/O/A+>\`\n` + `  • \`--alamat <alamat>\`\n` + `  • \`--rt <001/002>\`\n` + `  • \`--desa <kelurahan>\`\n` + `  • \`--kecamatan <kecamatan>\`\n` + `  • \`--agama <Islam/Kristen/dsb>\`\n` + `  • \`--status <Belum Kawin/Kawin>\`\n` + `  • \`--pekerjaan <profesi>\`\n` + `  • \`--sign <nama ttd>\` (Nama tanda tangan)`);
      }
      await ctx.react("⏳");
      let photoUrl = flags.photo || null;
      const urlMatch = cleanText.match(/https?:\/\/[^\s]+/i);
      if (!photoUrl && urlMatch) {
        photoUrl = urlMatch[0];
      }
      const hasMedia = ctx.isMedia || ctx.quoted?.isMedia || Boolean(ctx.msg?.imageMessage || ctx.quoted?.msg?.imageMessage);
      if (!photoUrl && hasMedia) {
        let buffer = null;
        if (typeof ctx.download === "function") {
          buffer = await ctx.download();
        } else if (typeof ctx.quoted?.download === "function") {
          buffer = await ctx.quoted.download();
        }
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer).catch(() => null);
          if (uploadRes?.status && uploadRes?.url) {
            photoUrl = uploadRes.url;
          }
        }
      }
      let targetJid = ctx.userPhoneJid || ctx.sender;
      if (ctx.mentionedJid && ctx.mentionedJid.length > 0) {
        targetJid = ctx.mentionedJid[0];
      } else if (ctx.quoted?.sender) {
        targetJid = ctx.quoted.sender;
      }
      if (!photoUrl) {
        try {
          photoUrl = await sock.profilePictureUrl(targetJid, "image");
        } catch {
          photoUrl = DEFAULT_AVATAR;
        }
      }
      const fallbackName = (typeof ctx.getName === "function" ? ctx.getName(targetJid) : null) || ctx.pushname || "Warga Negara";
      const cleanInputName = cleanText.replace(/https?:\/\/[^\s]+/gi, "").replace(/@\d+/g, "").trim();
      const nama = flags.nama || cleanInputName || fallbackName;
      const modelNum = Math.min(Math.max(Number(flags.model) || 1, 1), 4);
      const signName = flags.sign || nama.split(" ")[0] || "TandaTangan";
      const ktpPayload = {
        photo: photoUrl,
        provinsi: String(flags.provinsi || "JAWA TENGAH").toUpperCase(),
        kabupaten: String(flags.kabupaten || "SEMARANG").toUpperCase(),
        nik: String(flags.nik || generateRandomNIK()),
        nama: String(nama),
        ttl: String(flags.ttl || "Semarang, 17 Agustus 1998"),
        gender: String(flags.gender || "Laki-laki"),
        darah: String(flags.darah || "O"),
        alamat: String(flags.alamat || "Jl. Merdeka No. 45"),
        rt: String(flags.rt || "001/002"),
        desa: String(flags.desa || "Mekar Jaya"),
        kecamatan: String(flags.kecamatan || "Semarang Tengah"),
        agama: String(flags.agama || "Islam"),
        status: String(flags.status || "Belum Kawin"),
        pekerjaan: String(flags.pekerjaan || "Karyawan Swasta"),
        kewarganegaraan: String(flags.kewarganegaraan || "WNI"),
        berlaku: String(flags.berlaku || "SEUMUR HIDUP"),
        dibuat: String(flags.dibuat || flags.kabupaten || "Semarang"),
        terbuat: String(flags.terbuat || new Date().toLocaleDateString("id-ID")),
        sign: String(signName),
        model: modelNum,
        type: String(flags.type || "v5")
      };
      const response = await axios.post(API_URL, ktpPayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 6e4
      });
      const resData = response.data;
      const resultUrl = resData?.result || resData?.url || resData?.data?.url || resData?.image;
      if (!resultUrl) {
        throw new Error(resData?.message || "Server gagal menghasilkan gambar KTP.");
      }
      const imgRes = await axios.get(resultUrl, {
        responseType: "arraybuffer",
        timeout: 6e4
      });
      const ktpBuffer = Buffer.from(imgRes.data);
      if (!ktpBuffer || ktpBuffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gambar KTP kosong atau gagal diunduh.");
      }
      const caption = `🇮🇩 *KARTU TANDA PENDUDUK (REPUBLIK INDONESIA)*\n\n` + `╭───『 *DATA IDENTITAS* 』\n` + `│ 🆔 *NIK:* \`${ktpPayload.nik}\`\n` + `│ 👤 *Nama:* ${ktpPayload.nama}\n` + `│ 📅 *TTL:* ${ktpPayload.ttl}\n` + `│ 📍 *Alamat:* ${ktpPayload.alamat} (RT ${ktpPayload.rt})\n` + `│ 🏛️ *Wilayah:* ${ktpPayload.kabupaten}, ${ktpPayload.provinsi}\n` + `│ 🎨 *Model Template:* Model ${modelNum}\n` + `╰──────────────────\n\n` + `_${botName} • KTP Maker Generator_`;
      const buttons = [{
        name: "cta_copy",
        buttonParamsJson: JSON.stringify({
          display_text: "📋 Salin NIK",
          id: "copy_nik",
          copy_code: ktpPayload.nik
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: `🎨 Coba Model ${modelNum === 4 ? 1 : modelNum + 1}`,
          id: `${prefix}ktp --nama "${ktpPayload.nama}" --model ${modelNum === 4 ? 1 : modelNum + 1}`
        })
      }];
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(caption, `${botName} • Indonesia Identity`, buttons, {
          image: ktpBuffer,
          quoted: quotedMsg
        });
      } else {
        await sock.sendMessage(ctx.id, {
          image: ktpBuffer,
          caption: caption
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      console.error("[KTP Maker Error]:", error?.message || error);
      await ctx.react("❌");
      let errorMessage = error.message;
      if (error.response?.data) {
        try {
          const parsed = typeof error.response.data === "string" ? JSON.parse(error.response.data) : error.response.data;
          errorMessage = parsed.message || parsed.error || errorMessage;
        } catch {}
      }
      ctx.reply(`❌ KTP Maker Error: ${errorMessage}`);
    }
  }
};