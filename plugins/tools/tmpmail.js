import axios from "axios";
import * as cheerio from "cheerio";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const BASE_URL = "https://wudysoft.my.id/api/mails/v40";
const formatSize = bytes => {
  if (!bytes || isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};
export default {
  name: "tempmail",
  aliases: ["tmail", "tempemail"],
  description: "Layanan Temp Mail (Buat Email Kustom & Cek Kotak Masuk)",
  category: "Tools",
  execute: async (sock, ctx, msg) => {
    const rawText = (ctx.args || []).join(" ").trim();
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const messageMatch = rawText.match(/^--message(?:\s+([^\s]+))?(?:\s+([^\s]+))?/i);
    if (messageMatch) {
      const email = messageMatch[1];
      const messageId = messageMatch[2];
      if (!email) {
        return ctx.reply(`❌ Masukkan alamat email!\nContoh: \`${prefix}tempmail --message lotiresinebisi6321@suiemail.com\``);
      }
      try {
        await ctx.react("⏳");
        const res = await axios.post(BASE_URL, {
          action: "message",
          email: email
        });
        const mails = Array.isArray(res.data?.result) ? res.data.result : res.data?.result?.mails || [];
        if (messageId) {
          const target = mails.find(m => m.id === messageId);
          if (!target) return ctx.reply("❌ Pesan tidak ditemukan atau sudah kadaluarsa.");
          const dateStr = target.created_at ? new Date(target.created_at).toLocaleString("id-ID") : target.date ? new Date(target.date).toLocaleString("id-ID") : "-";
          let cleanContent = target.text?.trim();
          if (!cleanContent && target.html) {
            const $ = cheerio.load(target.html);
            $("script, style").remove();
            $("br").replaceWith("\n");
            $("p, div").each((_, el) => {
              $(el).append("\n");
            });
            cleanContent = $("body").text().replace(/\n\s*\n\s*\n/g, "\n\n").trim();
          }
          cleanContent = cleanContent || "(Pesan Kosong)";
          let attachmentText = "";
          if (Array.isArray(target.attachment_info) && target.attachment_info.length > 0) {
            attachmentText = `\n\n📎 *Lampiran (${target.attachment_info.length}):*\n` + target.attachment_info.map((att, idx) => ` ${idx + 1}. 📄 *${att.filename}* (${formatSize(att.size)}) [${att.content_type}]`).join("\n");
          }
          const text = `📬 *DETAIL PESAN TEMPMAIL*\n\n` + `╭───『 *INFORMASI PESAN* 』\n` + `│ 👤 *Dari:* ${target.from_text || target.from || "-"}\n` + `│ 🏷️ *Subjek:* ${target.subject || "(Tanpa Subjek)"}\n` + `│ 📅 *Tanggal:* ${dateStr}\n` + `│ 📎 *Total Lampiran:* ${target.attachments || target.attachment_info?.length || 0}\n` + `╰──────────────────\n\n` + `📝 *Isi Pesan:*\n${cleanContent}${attachmentText}`;
          await sock.sendMessage(ctx.id, {
            text: text
          }, {
            quoted: quotedMsg
          });
          await ctx.react("✅");
          return;
        }
        if (mails.length === 0) {
          await ctx.react("📭");
          return ctx.reply(`📬 Kotak masuk untuk *${email}* masih kosong.`);
        }
        const mailRows = mails.map((m, i) => {
          const hasAttach = m.attachments > 0 || m.attachment_info?.length > 0 ? " 📎" : "";
          return {
            title: `${i + 1}. ${(m.subject || "Tanpa Subjek").slice(0, 20)}${hasAttach}`,
            id: `${prefix}tempmail --message ${email} ${m.id}`,
            description: `Dari: ${(m.from_text || m.from || "").slice(0, 22)}`
          };
        });
        const buttons = [{
          title: "📥 BUKA PESAN MASUK",
          sections: [{
            title: `Daftar Pesan (${mails.length})`,
            rows: mailRows
          }]
        }];
        await ctx.sendCta(`📬 *KOTAK MASUK TEMPMAIL*\nEmail: *${email}*\nTotal: *${mails.length} Pesan*\n\nPilih pesan di dropdown untuk membaca isinya.`, `${global.bot?.name || "WudysoftBot"} • Temp Mail`, buttons, {
          title: "乂 TEMPMAIL MESSAGES 乂",
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      } catch (e) {
        await ctx.react("❌");
        return ctx.reply(`❌ Error: ${e.message}`);
      }
    }
    try {
      await ctx.react("⏳");
      let customName = null;
      const nameFlagMatch = rawText.match(/--(?:name|create)\s+([^\s]+)/i);
      if (nameFlagMatch) {
        customName = nameFlagMatch[1];
      } else if (rawText && !rawText.startsWith("--")) {
        customName = rawText.split(/\s+/)[0];
      }
      if (customName && customName.includes("@")) {
        customName = customName.split("@")[0];
      }
      const payload = {
        action: "create",
        ...customName && {
          name: customName
        }
      };
      const res = await axios.post(BASE_URL, payload);
      const email = res.data?.result?.email;
      if (!email) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal membuat email sementara. Silakan coba nama lain.");
      }
      const text = `✉️ *EMAIL SEMENTARA BERHASIL DIBUAT*\n\n` + `• *Email:* \`${email}\`\n` + `• *Custom Name:* ${customName ? `\`${customName}\`` : "_Acak (Random)_"}\n` + `• *Status:* Aktif & Siap Menerima OTP / Pesan\n\n` + `👉 *Cek Kotak Masuk:*\n\`${prefix}tempmail --message ${email}\``;
      await sock.sendMessage(ctx.id, {
        text: text
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};