import os from "os";
import {
  performance
} from "perf_hooks";
import {
  runtime
} from "../../core/tools.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
export default {
  name: "ping",
  aliases: ["speed", "p", "status", "botinfo", "system", "benchmark"],
  description: "Memeriksa kecepatan respons, performa CPU per-core, dan status server via CTA Button.",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const start = performance.now();
      await ctx.react("⚡");
      const latency = (performance.now() - start).toFixed(2);
      const cpus = os.cpus() || [];
      const cpuMap = new Map();
      cpus.forEach((cpu, index) => {
        const totalTimes = Object.values(cpu.times).reduce((acc, val) => acc + val, 0);
        const idleTimes = cpu.times.idle;
        const usagePercent = totalTimes > 0 ? ((totalTimes - idleTimes) / totalTimes * 100).toFixed(1) : "0.0";
        cpuMap.set(`Core ${index + 1}`, {
          speed: `${cpu.speed} MHz`,
          usage: `${usagePercent}%`,
          model: cpu.model?.trim() || "Unknown"
        });
      });
      const cpuModel = cpus[0]?.model?.trim() || "Unknown Processor";
      const cpuCores = cpus.length;
      const loadAvg = os.loadavg().map(v => v.toFixed(2)).join(", ");
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const ramUsagePercent = (usedMem / totalMem * 100).toFixed(1);
      const memUsage = process.memoryUsage();
      const memoryMap = new Map([
        ["Server RAM", `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${ramUsagePercent}%)`],
        ["Free RAM", formatBytes(freeMem)],
        ["Heap Used", `${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`],
        ["Process RSS", formatBytes(memUsage.rss)],
        ["External Memory", formatBytes(memUsage.external)]
      ]);
      const botUptime = typeof runtime === "function" ? runtime(process.uptime()) : `${Math.floor(process.uptime())}s`;
      const osUptime = typeof runtime === "function" ? runtime(os.uptime()) : `${Math.floor(os.uptime())}s`;
      const systemMap = new Map([
        ["OS Platform", `${os.type()} ${os.release()} (${os.arch()})`],
        ["Hostname", os.hostname() || "localhost"],
        ["Node.js", process.version],
        ["Process PID", String(process.pid)],
        ["Host Uptime", osUptime],
        ["Bot Uptime", botUptime]
      ]);
      let bodyText = `⚡ *BOT PERFORMANCE & SYSTEM BENCHMARK*\n\n`;
      bodyText += `╭───『 *LATENSI & RESPON* 』\n`;
      bodyText += `│ ⏱️ *Speed / Ping:* \`${latency} ms\`\n`;
      bodyText += `│ ⏳ *Bot Uptime:* ${botUptime}\n`;
      bodyText += `│ 🕒 *Host Uptime:* ${osUptime}\n`;
      bodyText += `╰────────────────────────\n\n`;
      bodyText += `╭───『 *SPESIFIKASI CPU* 』\n`;
      bodyText += `│ 💻 *Model:* ${cpuModel}\n`;
      bodyText += `│ 🧠 *Total Core:* ${cpuCores} Cores @ ${cpus[0]?.speed || "-"} MHz\n`;
      bodyText += `│ 📊 *Load Average:* ${loadAvg}\n`;
      bodyText += `╰────────────────────────\n\n`;
      bodyText += `╭───『 *MEMORI & RAM* 』\n`;
      for (const [key, val] of memoryMap.entries()) {
        bodyText += `│ ▫️ *${key}:* ${val}\n`;
      }
      bodyText += `╰────────────────────────\n\n`;
      bodyText += `╭───『 *ENVIRONMENT SISTEM* 』\n`;
      for (const [key, val] of systemMap.entries()) {
        bodyText += `│ ▫️ *${key}:* ${val}\n`;
      }
      bodyText += `╰────────────────────────\n\n`;
      bodyText += `_Gunakan tombol CTA di bawah untuk melihat detail core & navigasi cepat:_`;
      const actionRows = [{
        title: "🔄 Tes Ulang (Ping)",
        id: `${prefix}ping`,
        description: "Ukur kembali latensi dan beban server"
      }, {
        title: "🏠 Menu Utama",
        id: `${prefix}menu`,
        description: "Buka daftar semua perintah bot"
      }, {
        title: "👑 Kontak Owner",
        id: `${prefix}owner`,
        description: "Hubungi pengembang / pemilik bot"
      }];
      const coreRows = Array.from(cpuMap.entries()).slice(0, 15).map(([coreLabel, data]) => ({
        title: `🧠 ${coreLabel} (${data.usage})`,
        id: `${prefix}ping`,
        description: `Speed: ${data.speed} • Load: ${data.usage}`
      }));
      const sections = [{
        title: "⚡ NAVIGASI CEPAT",
        rows: actionRows
      }, {
        title: `💻 RINCIAN CPU (${cpuCores} CORES)`,
        rows: coreRows
      }];
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📂 DETAIL PERFORMA & MENU",
          sections: sections
        })
      }, {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "🔄 Ping Lagi",
          id: `${prefix}ping`
        })
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            list_title: `${botName} • System Monitor`,
            button_title: "Buka Status Server"
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodyText, `${botName} • Benchmark (Latency: ${latency}ms)`, buttons, options);
      } else {
        await sock.sendMessage(ctx.id, {
          image: {
            url: bannerMedia
          },
          caption: bodyText
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[PING ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengambil status sistem: ${e.message}`);
    }
  }
};