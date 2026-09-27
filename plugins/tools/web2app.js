import axios from "axios";
import {
  upload,
  formatBytes
} from "../../lib/upload.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_BASE = "https://wudysoft.my.id/api/tools/web2app/v6";
export default {
  name: "web2app",
  aliases: ["webtoapk", "makeapk", "html2app"],
  description: "Konversi website menjadi aplikasi Android (APK) dan cek status build",
  category: "Tools",
  limit: true,
  example: "web2app <url> [--name AppName] [--pkg com.app.name] atau web2app status <build_id>",
  execute: async (sock, ctx, msg) => {
    try {
      let text = (ctx.query || ctx.text || "").trim();
      const targetMedia = ctx.quoted?.isMedia ? ctx.quoted : ctx.isMedia ? ctx : null;
      if (!text && !targetMedia) {
        return ctx.reply(`📱 *WEB TO ANDROID APK GENERATOR*\n\n` + `• *Buat APK Baru:*\n` + `  👉 \`${ctx.prefix || "."}web2app https://s.id --name SidApp --pkg com.sid.app\`\n` + `  👉 Balas gambar (untuk icon aplikasi) dengan caption:\n` + `     \`${ctx.prefix || "."}web2app https://s.id --name MyIconApp\`\n\n` + `• *Cek Status Build:*\n` + `  👉 \`${ctx.prefix || "."}web2app status <build_id>\`\n\n` + `⚙️ *Parameter Kustom (Opsional):*\n` + `• \`--name <Nama Aplikasi>\`\n` + `• \`--pkg <package_name>\`\n` + `• \`--icon <url_icon>\`\n` + `• \`--<key> <value>\` _(override parameter lainnya)_`);
      }
      await ctx.react("⏳");
      if (text.startsWith("status ")) {
        const buildId = text.replace("status ", "").trim();
        if (!buildId) {
          await ctx.react("❌");
          return ctx.reply("❌ Masukkan Build ID yang ingin dicek!");
        }
        const {
          data
        } = await axios.post(API_BASE, {
          action: "status",
          id: buildId
        }, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 3e4
        });
        if (!data || !data.success || !data.status) {
          await ctx.react("❌");
          return ctx.reply(`❌ Gagal mengambil status build: ${data?.message || "ID tidak ditemukan."}`);
        }
        const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
        const isReady = data.apk_ready;
        const workflowStatus = data.workflow_status || "in_progress";
        const conclusion = data.workflow_conclusion || "-";
        const apkSize = data.apk_size ? formatBytes(data.apk_size) : "-";
        let statusText = `📱 *STATUS BUILD APK*\n\n`;
        statusText += `🆔 *Build ID:* \`${data.build_id || buildId}\`\n`;
        statusText += `⚙️ *Status Workflow:* \`${workflowStatus} (${conclusion})\`\n`;
        statusText += `📦 *APK Siap:* ${isReady ? "✅ SIAP" : "⏳ Sedang Diproses"}\n`;
        if (isReady && data.apk_download_url) {
          statusText += `📂 *Nama File:* \`${data.apk_file_name || "app-release.apk"}\`\n`;
          statusText += `📊 *Ukuran File:* \`${apkSize}\`\n\n`;
          statusText += `📥 *Download Link APK:*\n${data.apk_download_url}\n\n`;
          statusText += `🔗 *GitHub Releases:* ${data.releases_url || "-"}`;
        } else {
          statusText += `\n🕒 _Proses build biasanya membutuhkan waktu 3-5 menit di server GitHub Actions._\n`;
          statusText += `🔗 *Pantau Workflow:* ${data.workflow_url || data.github_url || "-"}`;
        }
        await sock.sendMessage(ctx.id, {
          text: statusText.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      let targetUrl = "";
      let appName = "WebApp";
      let pkgName = "";
      let iconUrl = "";
      const restParams = {};
      const flagRegex = /--([a-zA-Z0-9_]+)\s+([^\s]+)/g;
      let match;
      while ((match = flagRegex.exec(text)) !== null) {
        const key = match[1].toLowerCase();
        const value = match[2];
        if (key === "name") {
          appName = value;
        } else if (key === "pkg" || key === "pkg_name") {
          pkgName = value;
        } else if (key === "icon") {
          iconUrl = value;
        } else {
          restParams[key] = value;
        }
      }
      targetUrl = text.replace(/--[a-zA-Z0-9_]+\s+[^\s]+/g, "").trim();
      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        await ctx.react("❌");
        return ctx.reply("❌ Masukkan URL website yang valid (harus diawali http:// atau https://)");
      }
      if (targetMedia && typeof targetMedia.download === "function") {
        const buffer = await targetMedia.download();
        if (buffer && Buffer.isBuffer(buffer)) {
          const uploadRes = await upload(buffer);
          if (uploadRes?.status && uploadRes?.url) {
            iconUrl = uploadRes.url;
          }
        }
      }
      const body = {
        action: "create",
        url: targetUrl,
        name: appName,
        ...pkgName ? {
          pkg_name: pkgName
        } : {},
        ...iconUrl ? {
          icon: iconUrl
        } : {},
        ...restParams
      };
      const {
        data
      } = await axios.post(API_BASE, body, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 45e3
      });
      if (!data || !data.success || !data.status) {
        await ctx.react("❌");
        return ctx.reply(`❌ Gagal memulai build APK: ${data?.message || "Server error."}`);
      }
      const buildId = data.build_id || "-";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let responseText = `🚀 *PROSES BUILD APK DIMULAI*\n\n`;
      responseText += `📌 *Nama Aplikasi:* ${appName}\n`;
      responseText += `🌐 *URL Website:* ${targetUrl}\n`;
      if (pkgName) responseText += `📦 *Package:* \`${pkgName}\`\n`;
      if (iconUrl) responseText += `🖼️ *Icon:* Kustom\n`;
      responseText += `🆔 *Build ID:* \`${buildId}\`\n\n`;
      responseText += `📝 *Pesan:* ${data.message || "Proses build sedang berjalan di GitHub Actions (estimasi 3-5 menit)."}\n\n`;
      responseText += `🔗 *Repository:* ${data.github_url || "-"}\n`;
      responseText += `⚡ *Actions Workflow:* ${data.actions_url || "-"}\n\n`;
      responseText += `_Ketik \`${ctx.prefix || "."}web2app status ${buildId}\` secara berkala untuk mengecek & mengunduh APK jika sudah selesai._`;
      await sock.sendMessage(ctx.id, {
        text: responseText.trim()
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Web2App Error: ${error.response?.data?.message || error.message}`);
    }
  }
};