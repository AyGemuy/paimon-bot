import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "githubsearch",
  aliases: ["ghsearch", "github", "gitsearch"],
  description: "Mencari repository di GitHub dengan tampilan Interactive List CTA",
  category: "Search",
  limit: true,
  example: "githubsearch baileys",
  execute: async (sock, ctx, msg) => {
    try {
      const query = (ctx.query || ctx.text || "").trim();
      if (!query) {
        return ctx.reply(`🐙 *GITHUB REPOSITORY SEARCH*\n\n` + `Silakan masukkan nama repositori yang ingin dicari!\n` + `👉 Contoh: \`${ctx.prefix || "."}githubsearch baileys\``);
      }
      await ctx.react("⏳");
      const res = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=10`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Node.js)",
          Accept: "application/vnd.github.v3+json"
        },
        timeout: 3e4
      });
      const list = res.data?.items;
      if (!list?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan repositori untuk kata kunci: *${query}*`);
      }
      const topRepo = list[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const prefix = ctx.prefix || ".";
      const updatedDate = topRepo.updated_at ? new Date(topRepo.updated_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const avatarUrl = topRepo.owner?.avatar_url || "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
      const actionRows = [{
        title: `📦 Git Clone ${topRepo.name}`,
        id: `${prefix}gitclone ${topRepo.clone_url}`,
        description: `Clone repo: git clone ${topRepo.clone_url}`
      }, {
        title: "🔍 Cari Kode di Repo Ini",
        id: `${prefix}codesearch ${topRepo.name}`,
        description: "Cari potongan kode di dalam repositori ini"
      }];
      const otherRepoRows = list.slice(1).map((repo, i) => ({
        title: `${i + 2}. ${repo.full_name.slice(0, 24)}`,
        id: `${prefix}githubsearch ${repo.full_name}`,
        description: `⭐ ${repo.stargazers_count.toLocaleString("id-ID")} | 🍴 ${repo.forks_count.toLocaleString("id-ID")} | 💻 ${repo.language || "Multi"}`.slice(0, 60)
      }));
      const listSections = [{
        title: `⚡ AKSI: ${topRepo.full_name}`,
        rows: actionRows
      }];
      if (otherRepoRows.length > 0) {
        listSections.push({
          title: `📂 REPOSITORI TERKAIT (${otherRepoRows.length})`,
          rows: otherRepoRows
        });
      }
      const bodyText = `🐙 *${topRepo.full_name}*\n\n` + `╭───『 *REPOSITORY DETAIL* 』\n` + `│ 👤 *Owner:* ${topRepo.owner?.login || "Unknown"}\n` + `│ ⭐ *Stars:* ${topRepo.stargazers_count.toLocaleString("id-ID")} bintang\n` + `│ 🍴 *Forks:* ${topRepo.forks_count.toLocaleString("id-ID")} fork\n` + `│ 💻 *Language:* ${topRepo.language || "Unknown"}\n` + `│ ⚖️ *License:* ${topRepo.license?.spdx_id || "None"}\n` + `│ 📅 *Pembaruan:* ${updatedDate}\n` + `╰──────────────────\n\n` + `📝 *Deskripsi:*\n` + `_${topRepo.description || "Tidak ada deskripsi yang tersedia."}_\n\n` + `💻 *Git Clone Command:*\n` + `\`\`\`bash\ngit clone ${topRepo.clone_url}\n\`\`\``;
      const footerText = `${global.bot?.name || "WudysoftBot"} • GitHub API`;
      const buttons = [{
        name: "single_select",
        title: "📂 PILIH REPOSITORI & AKSI",
        sections: listSections
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Git Clone",
        copy_code: `git clone ${topRepo.clone_url}`
      }, {
        name: "cta_url",
        display_text: "🌐 Buka di GitHub",
        url: topRepo.html_url
      }];
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 GITHUB REPO SEARCH 乂",
        subtitle: `Repo: ${topRepo.name}`,
        media: avatarUrl,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ GitHub Search Error: ${error.message}`);
    }
  }
};