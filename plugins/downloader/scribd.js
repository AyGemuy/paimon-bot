import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_API = "https://www.wudysoft.my.id/api/download/scribd";

function formatSize(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function stripHtml(str = "") {
  return str.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}

function extractDocId(input = "") {
  if (!input) return null;
  if (/^\d{6,15}$/.test(input.trim())) return input.trim();
  const urlMatch = input.match(/scribd\.com\/(?:document|doc|presentation)\/(\d+)/i);
  if (urlMatch) return urlMatch[1];
  return null;
}
export default {
  name: "scribd",
  aliases: ["scribddl", "scribdsearch", "scrd"],
  description: "Cari dan unduh dokumen / PDF dari Scribd secara gratis",
  category: "Downloader",
  limit: false,
  example: "scribd mtk atau scribd 904240987 atau scribd https://www.scribd.com/document/904240987/pts-mtk",
  execute: async (sock, ctx, msg) => {
    try {
      const rawText = ctx.args?.join(" ")?.trim() || ctx.text?.trim() || "";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      if (!rawText) {
        return ctx.reply(`📚 *SCRIBD DOWNLOADER & SEARCH*\n\n` + `Gunakan perintah ini untuk mencari atau mendownload dokumen Scribd.\n\n` + `📖 *Cara Penggunaan:*\n` + `• Cari Dokumen: \`${prefix}scribd <kata kunci>\`\n` + `  _Contoh: \`${prefix}scribd rumus matematika\`_\n\n` + `• Download Dokumen: \`${prefix}scribd <Doc ID / Link Scribd>\`\n` + `  _Contoh: \`${prefix}scribd 904240987\`_\n` + `  _Contoh: \`${prefix}scribd https://www.scribd.com/document/904240987\`_`);
      }
      const docId = extractDocId(rawText);
      if (docId) {
        await ctx.react("⏳");
        let docTitle = `Scribd_Document_${docId}`;
        let docPages = "-";
        let docPublisher = "-";
        try {
          const detailRes = await axios.get(`${BASE_API}?action=detail&doc_id=${docId}`, {
            timeout: 1e4
          });
          const docData = detailRes.data?.result?.[0]?.doc;
          if (docData) {
            docTitle = docData.title || docTitle;
            docPages = docData.page_count || "-";
            docPublisher = docData.publisher?.name || docData.publisher?.username || "-";
          }
        } catch {}
        const downloadUrl = `${BASE_API}?action=download&doc_id=${docId}`;
        const fileResponse = await axios.get(downloadUrl, {
          responseType: "arraybuffer",
          timeout: 6e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const buffer = Buffer.from(fileResponse.data);
        if (!buffer || buffer.length === 0) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mengunduh file dokumen. File mungkin telah dihapus atau tidak tersedia.");
        }
        const safeFileName = `${docTitle.replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
        const caption = `📄 *SCRIBD DOCUMENT DOWNLOADER*\n\n` + `• *Judul:* ${docTitle}\n` + `• *ID:* \`${docId}\`\n` + `• *Pengunggah:* ${docPublisher}\n` + `• *Halaman:* 📑 ${docPages} Halaman\n` + `• *Ukuran:* 📦 ${formatSize(buffer.length)}\n\n` + `_File PDF sedang dikirimkan..._`;
        await sock.sendMessage(ctx.from, {
          document: buffer,
          mimetype: "application/pdf",
          fileName: safeFileName,
          caption: caption
        }, {
          quoted: quotedMsg
        });
        return await ctx.react("✅");
      }
      await ctx.react("🔍");
      const searchUrl = `${BASE_API}?action=search&query=${encodeURIComponent(rawText)}`;
      const {
        data: searchRes
      } = await axios.get(searchUrl, {
        timeout: 15e3
      });
      const items = searchRes?.result?.modules?.[0]?.items || [];
      if (!items.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan dokumen dengan kata kunci: *"${rawText}"*`);
      }
      const results = items.slice(0, 10).map((item, index) => {
        const doc = item.document || {};
        return {
          index: index + 1,
          id: doc.id,
          title: doc.title || "Untitled",
          pages: doc.page_count || 0,
          reads: doc.reads_count || 0,
          publisher: doc.publisher?.name || doc.publisher?.username || "Unknown",
          rating: doc.rating?.average_rating || 0
        };
      });
      const rows = results.map(r => ({
        title: `[${r.pages} Hlm] ${r.title}`.slice(0, 24),
        description: `Oleh: ${r.publisher} • Dibaca: ${r.reads}x`,
        id: `${prefix}scribd ${r.id}`
      }));
      const bodyText = `📚 *HASIL PENCARIAN SCRIBD*\n\n` + `🔎 *Query:* "${rawText}"\n` + `📊 *Total Ditemukan:* ${results.length} Dokumen\n\n` + `*Daftar Dokumen:*\n` + results.map(r => `*${r.index}. ${r.title}*\n` + `   • ID: \`${r.id}\`\n` + `   • Halaman: 📑 ${r.pages} | Dibaca: 👁️ ${r.reads}\n` + `   • Pengunggah: 👤 ${r.publisher}\n` + `   👉 *Download:* \`${prefix}scribd ${r.id}\``).join("\n\n") + `\n\n_Ketik \`${prefix}scribd <ID>\` atau pilih dari menu di bawah untuk mengunduh PDF._`;
      const footerText = "Scribd Document Downloader";
      if (typeof ctx.sendCta === "function") {
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "📥 Pilih Dokumen untuk Download",
            sections: [{
              title: "📑 PILIH DOKUMEN",
              rows: rows
            }]
          })
        }];
        await ctx.sendCta(bodyText, footerText, buttons, {
          quoted: quotedMsg
        });
      } else {
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan pada fitur Scribd: ${error?.message || error}`);
    }
  }
};