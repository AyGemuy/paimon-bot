import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "npmjs",
  aliases: ["npm", "npmsearch", "npmdl", "npmpkg", "npms"],
  description: "Mencari package di NPM dan langsung mengunduh file tarball/source code (.tgz).",
  category: "Search",
  limit: true,
  example: "npmjs baileys\nnpmjs --download axios",
  execute: async (sock, ctx, msg) => {
    try {
      const rawQuery = (ctx.query || ctx.text || "").trim();
      if (!rawQuery) {
        return ctx.reply(`📦 *NPMJS PACKAGE SEARCH & DOWNLOADER*\n\n` + `Silakan masukkan nama package yang ingin dicari/didownload!\n` + `👉 Contoh: \`${ctx.prefix || "."}npmjs baileys\``);
      }
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const targetJid = ctx.chat || ctx.id;
      const isDownloadTrigger = rawQuery.startsWith("--download") || rawQuery.startsWith("--dl") || rawQuery.startsWith("-d");
      if (isDownloadTrigger) {
        const pkgName = rawQuery.replace(/^(--download|--dl|-d)\s*/i, "").trim();
        if (!pkgName) {
          return ctx.reply("❌ Masukkan nama package yang valid untuk diunduh!");
        }
        await ctx.react("⏳");
        const formattedPkg = pkgName.startsWith("@") ? `@${encodeURIComponent(pkgName.slice(1))}` : encodeURIComponent(pkgName);
        const {
          data: pkgData
        } = await axios.get(`https://registry.npmjs.org/${formattedPkg}`, {
          timeout: 3e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const latestVersion = pkgData["dist-tags"]?.latest || Object.keys(pkgData.versions || {}).pop();
        if (!latestVersion || !pkgData.versions?.[latestVersion]) {
          await ctx.react("❌");
          return ctx.reply(`❌ Tidak dapat menemukan versi rilis untuk package: *${pkgName}*`);
        }
        const versionData = pkgData.versions[latestVersion];
        const tarballUrl = versionData.dist?.tarball;
        if (!tarballUrl) {
          await ctx.react("❌");
          return ctx.reply(`❌ File tarball (.tgz) tidak ditemukan untuk package: *${pkgName}*`);
        }
        const response = await axios.get(tarballUrl, {
          responseType: "arraybuffer",
          timeout: 6e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          }
        });
        const fileBuffer = Buffer.from(response.data);
        const cleanFileName = `${pkgName.replace(/[@/]/g, "-")}-${latestVersion}.tgz`;
        const caption = `📦 *NPM SOURCE CODE DOWNLOADED*\n\n` + `• 🏷️ *Package:* ${pkgData.name}\n` + `• 🔖 *Versi:* v${latestVersion}\n` + `• ⚖️ *Lisensi:* ${versionData.license || pkgData.license || "MIT"}\n` + `• 🌐 *NPM:* https://www.npmjs.com/package/${pkgData.name}\n\n` + `💡 _Ekstrak file \`.tgz\` menggunakan WinRAR / 7-Zip / tar command._`;
        await sock.sendMessage(targetJid, {
          document: fileBuffer,
          mimetype: "application/gzip",
          fileName: cleanFileName,
          caption: caption
        }, {
          quoted: quotedMsg
        });
        await ctx.react("📦");
        return;
      }
      await ctx.react("⏳");
      const res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(rawQuery)}&size=10`, {
        timeout: 3e4
      });
      const list = res.data?.objects;
      if (!list?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Tidak ditemukan package NPM untuk kata kunci: *${rawQuery}*`);
      }
      const topItem = list[0];
      const topPkg = topItem.package;
      const authorName = topPkg.publisher?.username || topPkg.author?.name || "Unknown";
      const score = Math.round((topItem.score?.final || 0) * 100);
      const updateDate = topPkg.date ? new Date(topPkg.date).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }) : "-";
      const npmUrl = topPkg.links?.npm || `https://www.npmjs.com/package/${topPkg.name}`;
      const downloadRows = [{
        title: `📥 Download v${topPkg.version} (.tgz)`,
        id: `${prefix}npmjs --download ${topPkg.name}`,
        description: `Unduh file source code arsip tarball ${topPkg.name}`
      }];
      const otherPackageRows = list.slice(1).map((item, i) => {
        const p = item.package;
        return {
          title: `${i + 2}. ${p.name.slice(0, 24)} (v${p.version})`,
          id: `${prefix}npmjs --download ${p.name}`,
          description: `Download .tgz (${p.description || "Source code"}`.slice(0, 60)
        };
      });
      const listSections = [{
        title: `📥 UNDUH SOURCE CODE: ${topPkg.name}`,
        rows: downloadRows
      }];
      if (otherPackageRows.length > 0) {
        listSections.push({
          title: `📦 UNDUH PACKAGE LAINNYA (${otherPackageRows.length})`,
          rows: otherPackageRows
        });
      }
      const bodyText = `📦 *${topPkg.name}* (v${topPkg.version})\n\n` + `╭───『 *PACKAGE DETAIL* 』\n` + `│ 🏷️ *Versi:* v${topPkg.version}\n` + `│ 👤 *Author:* ${authorName}\n` + `│ 📊 *Skor Kualitas:* ${score}%\n` + `│ 📅 *Pembaruan:* ${updateDate}\n` + `│ 🔗 *Lisensi:* ${topPkg.license || "MIT"}\n` + `╰──────────────────\n\n` + `📝 *Deskripsi:*\n` + `_${topPkg.description || "Tidak ada deskripsi yang tersedia."}_\n\n` + `💻 *Perintah Install:*\n` + `\`\`\`bash\nnpm i ${topPkg.name}\n\`\`\`\n\n` + `👇 _Pilih dropdown menu di bawah untuk langsung mendownload source code (.tgz)_`;
      const footerText = `${global.bot?.name || "WudysoftBot"} • NPM Registry Downloader`;
      const npmLogo = "https://raw.githubusercontent.com/npm/logos/master/npm%20square/n-64.png";
      const buttons = [{
        name: "single_select",
        title: "📥 DOWNLOAD SOURCE (.TGZ)",
        sections: listSections
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Perintah Install",
        copy_code: `npm i ${topPkg.name}`
      }, {
        name: "cta_url",
        display_text: "🌐 Buka di Web NPM",
        url: npmUrl
      }];
      await ctx.sendCta(bodyText, footerText, buttons, {
        title: "乂 NPMJS SEARCH & DOWNLOADER 乂",
        subtitle: `Package: ${topPkg.name}`,
        media: npmLogo,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[NPMJS Error]:", error);
      await ctx.react("❌");
      ctx.reply(`❌ NPMJS Error: ${error.response?.data?.message || error.message}`);
    }
  }
};