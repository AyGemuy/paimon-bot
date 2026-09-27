import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
const GITHUB_REGEX = /(?:https?:\/\/github\.com\/|git@github\.com:)?([a-zA-Z0-9_\-\.]+)\/([a-zA-Z0-9_\-\.]+)(?:\.git)?/i;
export default {
  name: "gitclone",
  aliases: ["git", "githubdl", "gcl", "clonerepo"],
  description: "Unduh repository GitHub sebagai file dokumen arsip .zip",
  category: "Downloader",
  limit: true,
  example: ".gitclone https://github.com/AyGemuy/paimon-bot",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawInput = (ctx.query || (ctx.args && ctx.args.length > 0 ? ctx.args.join(" ") : "") || ctx.quoted?.text || "").trim();
      if (!rawInput) {
        return ctx.reply(`📦 *GITHUB REPOSITORY CLONER*\n\n` + `Harap masukkan tautan / URL repositori GitHub yang ingin diunduh!\n\n` + `📌 *Format:* \`${prefix}gitclone <url_github>\`\n` + `💡 *Contoh:* \`${prefix}gitclone https://github.com/AyGemuy/paimon-bot\``);
      }
      const match = rawInput.match(GITHUB_REGEX);
      if (!match) {
        return ctx.reply("❌ URL GitHub tidak valid! Pastikan formatnya seperti:\n`https://github.com/username/repository`");
      }
      const [, user, repoRaw] = match;
      const repo = repoRaw.replace(/\.git$/i, "");
      await ctx.react("⏳");
      let repoInfo = null;
      let defaultBranch = "main";
      try {
        const {
          data
        } = await axios.get(`https://api.github.com/repos/${user}/${repo}`, {
          headers: {
            "User-Agent": "WhatsApp-Bot-Client"
          },
          timeout: 15e3
        });
        repoInfo = data;
        defaultBranch = data.default_branch || "main";
      } catch (err) {
        console.warn("[GitHub API Metadata Warning]:", err.message);
      }
      const zipUrl = `https://api.github.com/repos/${user}/${repo}/zipball/${defaultBranch}`;
      const response = await axios.get(zipUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent": "WhatsApp-Bot-Client"
        },
        timeout: 6e4,
        maxContentLength: 100 * 1024 * 1024
      });
      const buffer = Buffer.from(response.data);
      if (!buffer || buffer.length === 0) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mengunduh file ZIP dari repository tersebut.");
      }
      const fileName = `${repo}-${defaultBranch}.zip`;
      const fileSize = formatBytes(buffer.length);
      const desc = repoInfo?.description || "Tidak ada deskripsi";
      const stars = (repoInfo?.stargazers_count || 0).toLocaleString("id-ID");
      const forks = (repoInfo?.forks_count || 0).toLocaleString("id-ID");
      const captionText = `📦 *GITHUB REPOSITORY DOWNLOADER*\n\n` + `╭───『 *DETAIL REPO* 』\n` + `│ 🏷️ *Repo:* \`${user}/${repo}\`\n` + `│ 🌿 *Branch:* \`${defaultBranch}\`\n` + `│ 📊 *Ukuran File:* ${fileSize}\n` + `│ ⭐ *Stars:* ${stars} | 🍴 *Forks:* ${forks}\n` + `│ 📝 *Deskripsi:* ${desc}\n` + `╰──────────────────\n\n` + `_${botName} • Downloader Tools_`;
      await sock.sendMessage(ctx.id, {
        document: buffer,
        mimetype: "application/zip",
        fileName: fileName,
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[GITCLONE ERROR]:", e);
      await ctx.react("❌");
      const errorMsg = e.response?.status === 404 ? "Repository tidak ditemukan atau bersifat private." : e.message || String(e);
      ctx.reply(`❌ Gagal meng-clone repository: ${errorMsg}`);
    }
  }
};