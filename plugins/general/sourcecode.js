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
export default {
  name: "script",
  aliases: ["sc", "sourcecode", "source", "repo", "github"],
  description: "Menampilkan informasi dan link source code resmi bot dari GitHub",
  category: "Info",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const repoTarget = "AyGemuy/paimon-bot";
      const githubApiUrl = `https://api.github.com/repos/${repoTarget}`;
      const {
        data
      } = await axios.get(githubApiUrl, {
        headers: {
          "User-Agent": "WhatsApp-Bot-Client"
        },
        timeout: 15e3
      });
      const repoName = data.name || "paimon-bot";
      const repoFullName = data.full_name || repoTarget;
      const repoDesc = data.description || "WhatsApp Automation Bot Engine";
      const repoUrl = data.html_url || `https://github.com/${repoTarget}`;
      const stars = (data.stargazers_count || 0).toLocaleString("id-ID");
      const forks = (data.forks_count || 0).toLocaleString("id-ID");
      const watchers = (data.watchers_count || 0).toLocaleString("id-ID");
      const openIssues = (data.open_issues_count || 0).toLocaleString("id-ID");
      const language = data.language || "JavaScript";
      const defaultBranch = data.default_branch || "main";
      const repoSize = formatBytes((data.size || 0) * 1024);
      const license = data.license?.name || "MIT License";
      const ownerName = data.owner?.login || "AyGemuy";
      const avatarUrl = data.owner?.avatar_url || "https://files.catbox.moe/8ugr9a.jpg";
      const updatedAt = data.updated_at ? new Date(data.updated_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "Baru saja";
      const createdAt = data.created_at ? new Date(data.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const bodyText = `📦 *OFFICIAL BOT SOURCE CODE*\n\n` + `Hai *${ctx.pushname || "User"}*, source code bot ini open-source dan dapat kamu unduh secara gratis di GitHub!\n\n` + `╭───『 *REPOSITORY INFO* 』\n` + `│ 🏷️ *Nama Repo:* \`${repoFullName}\`\n` + `│ 👤 *Owner / Author:* ${ownerName}\n` + `│ 📝 *Deskripsi:* ${repoDesc}\n` + `│ 💻 *Bahasa Utama:* \`${language}\`\n` + `│ 📜 *Lisensi:* \`${license}\`\n` + `│ 🌿 *Default Branch:* \`${defaultBranch}\`\n` + `╰──────────────────\n\n` + `╭───『 *STATISTIK GITHUB* 』\n` + `│ ⭐ *Stars:* ${stars} Bintang\n` + `│ 🍴 *Forks:* ${forks} Fork\n` + `│ 👁️ *Watchers:* ${watchers} Pengawas\n` + `│ 📌 *Open Issues:* ${openIssues}\n` + `│ 📊 *Ukuran Repo:* ${repoSize}\n` + `│ 🕒 *Update Terakhir:* ${updatedAt}\n` + `│ 📅 *Dibuat Sejak:* ${createdAt}\n` + `╰──────────────────\n\n` + `_Ketuk tombol di bawah untuk membuka repository atau menyalin perintah git clone:_`;
      const footerText = `${botName} • Open Source WhatsApp Bot`;
      const buttons = [{
        name: "cta_url",
        display_text: "🌐 Buka GitHub Repository",
        url: repoUrl
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Perintah Git Clone",
        copy_code: `git clone ${repoUrl}.git`
      }, {
        name: "single_select",
        title: "⚡ NAVIGASI BOT",
        sections: [{
          title: `${botName} • Quick Shortcuts`,
          rows: [{
            title: "🏠 Menu Utama",
            description: "Buka menu utama dan daftar fitur bot",
            id: `${prefix}menu`
          }, {
            title: "👑 Kontak Developer",
            description: "Hubungi pembuat dan pengembang bot",
            id: `${prefix}owner`
          }, {
            title: "⚡ Ping & Server Speed",
            description: "Cek latensi dan status kecepatan server",
            id: `${prefix}ping`
          }]
        }]
      }];
      const options = {
        image: avatarUrl,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [2],
            list_title: `${botName} • Source Code Info`,
            button_title: "📦 Buka Source Code"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, footerText, buttons, options);
      } else {
        await ctx.reply(`${bodyText}\n\n🔗 *Link:* ${repoUrl}`, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[SCRIPT CMD ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil data repository: ${e.message}`);
    }
  }
};