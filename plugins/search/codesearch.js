import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "codesearch",
  aliases: ["searchcode", "ghcode", "gitcode", "caricode"],
  description: "Cari potongan kode dan repositori di GitHub dengan tampilan List interaktif",
  category: "Search",
  limit: true,
  example: "codesearch <keyword>",
  execute: async (sock, ctx, msg) => {
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        return ctx.reply(`💻 *GITHUB CODE SEARCH*\n\n` + `Silakan masukkan kata kunci kode yang ingin dicari!\n` + `👉 Contoh: \`${ctx.prefix || "."}codesearch AyGemuy\``);
      }
      await ctx.react("⏳");
      const {
        data
      } = await axios.post("https://wudysoft.my.id/api/search/code/v2", {
        query: query
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 3e4
      });
      if (!data || data.status !== "success" && !data.status || !data.results || data.results.length === 0) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan hasil kode untuk kata kunci: *${query}*`);
      }
      const total = data.total || data.results.length;
      const topResult = data.results[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let previewCode = (topResult.preview_code || "").trim();
      if (previewCode.length > 300) {
        previewCode = previewCode.substring(0, 300) + "\n// ... (dipotong)";
      }
      const rows = data.results.slice(0, 10).map((item, index) => {
        const fileName = item.file?.name || item.path?.split("/").pop() || `File #${index + 1}`;
        const repoName = item.repository?.full_name || item.repo || "Unknown Repo";
        const filePath = item.file?.path || item.path || "Unknown Path";
        const author = item.author?.username || item.repository?.owner || "Unknown";
        return {
          title: `${index + 1}. ${fileName}`,
          id: `${ctx.prefix || "."}codesearch ${query} ${fileName}`,
          description: `📁 Repo: ${repoName} | 👤 By: ${author}\n📄 Path: ${filePath}`.slice(0, 70)
        };
      });
      const listSections = [{
        title: `Hasil Pencarian (${data.results.length} File)`,
        rows: rows
      }];
      const headerTitle = "💻 GITHUB CODE SEARCH";
      const bodyText = `🔍 *Kata Kunci:* \`${query}\`\n` + `📊 *Total Ditemukan:* ${total} file\n\n` + `📌 *Hasil Utama:* \`${topResult.file?.name || "Code File"}\`\n` + `📁 *Repo:* ${topResult.repository?.full_name || "Unknown"}\n` + `👤 *Author:* @${topResult.author?.username || "Unknown"}\n\n` + `💻 *Code Preview:*\n` + `\`\`\`${topResult.file?.extension || ""}\n` + `${previewCode || "// Preview code tidak tersedia"}\n` + `\`\`\`\n\n` + `Silakan tekan tombol di bawah untuk melihat daftar file lainnya.`;
      const footerText = "Pilih salah satu file untuk detail lebih lanjut";
      await ctx.sendList(headerTitle, bodyText, footerText, "📋 Pilih Hasil File", listSections, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Code Search Error: ${error.response?.data?.message || error.message}`);
    }
  }
};