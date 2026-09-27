import {
  simpleQuoted
} from "../../lib/quoted.js";
const formatNumber = num => {
  return typeof num === "number" ? num.toLocaleString("id-ID") : num || "0";
};
const formatDate = timestamp => {
  if (!timestamp) return "-";
  return new Date(Number(timestamp) * 1e3).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

function parseFlags(input) {
  const flags = {};
  const flagRegex = /(?:^|\s)(?:--([a-zA-Z0-9_-]+)|-([a-zA-Z]))(?:[=\s]+("(?:\\"|[^"])*"|'(?:\\'|[^'])*'|[^\s]+))?/g;
  let match;
  while ((match = flagRegex.exec(input)) !== null) {
    let key = (match[1] || match[2]).toLowerCase();
    let rawVal = match[3];
    let val = true;
    const aliasMap = {
      n: "name",
      title: "name",
      nama: "name",
      d: "desc",
      description: "desc",
      deskripsi: "desc",
      u: "url",
      l: "url",
      link: "url",
      j: "jid",
      id: "jid",
      channel: "jid",
      s: "server",
      sid: "server",
      post: "server",
      e: "emoji",
      r: "emoji",
      react: "emoji"
    };
    if (aliasMap[key]) key = aliasMap[key];
    if (rawVal !== undefined) {
      if (rawVal.startsWith('"') && rawVal.endsWith('"') || rawVal.startsWith("'") && rawVal.endsWith("'")) {
        rawVal = rawVal.slice(1, -1);
      }
      if (rawVal === "true") val = true;
      else if (rawVal === "false") val = false;
      else if (!isNaN(rawVal) && rawVal.trim() !== "") val = Number(rawVal);
      else val = rawVal;
    }
    flags[key] = val;
  }
  const cleanText = input.replace(flagRegex, "").replace(/\s+/g, " ").trim();
  return {
    flags: flags,
    cleanText: cleanText
  };
}
export default {
  name: "saluran",
  aliases: ["ch", "channel", "newsletter"],
  description: "Kelola dan intip informasi WhatsApp Saluran / Newsletter via Interactive CTA UI & Flags",
  category: "Tools",
  example: "saluran cek https://whatsapp.com/channel/xxx atau saluran create --name Room --desc Info",
  execute: async (sock, ctx, msg) => {
    try {
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawInput = (ctx.args?.join(" ") || ctx.query || "").trim();
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "Wudysoft";
      const defaultBanner = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      const {
        flags,
        cleanText
      } = parseFlags(rawInput);
      const cleanArgs = cleanText.split(/\s+/).filter(Boolean);
      let subCommand = cleanArgs[0]?.toLowerCase();
      if (!subCommand && (flags.url || flags.jid)) {
        subCommand = "cek";
      } else if (cleanText.includes("whatsapp.com/channel/") || cleanText.endsWith("@newsletter")) {
        subCommand = "cek";
      } else if (flags.create || flags.name) {
        subCommand = "create";
      } else if (flags.list) {
        subCommand = "list";
      } else if (flags.react || flags.emoji) {
        subCommand = "react";
      }
      if (!subCommand || !["cek", "create", "list", "react"].includes(subCommand)) {
        await ctx.react("⏳");
        const bodyText = `Halo, *${ctx.pushname || "User"}* 👋\n\n` + `Gunakan fitur ini untuk memeriksa, membuat, serta mengelola postingan dan metadata di *WhatsApp Channel (Saluran)* secara langsung.\n\n` + `╭───『 *PANDUAN CEPAT & MUDAH* 』\n` + `│ 🔍 *Cek Otomatis:* Tempel link langsung:\n` + `│    \`${prefix}saluran https://whatsapp.com/channel/xxx\`\n` + `│ ➕ *Buat Saluran:*\n` + `│    \`${prefix}saluran create Nama | Deskripsi\`\n` + `│ 📋 *List Saluran:* \`${prefix}saluran list\`\n` + `│ ❤️ *Kirim React:* \`${prefix}saluran react <jid> | <id> | <emoji>\`\n` + `│\n` + `├─『 *FORMAT FLAG (OPSIONAL)* 』\n` + `│ 🚩 \`--url <link>\` : Link channel untuk dicek\n` + `│ 🚩 \`--name <nama> --desc <deskripsi>\` : Buat channel\n` + `│ 🚩 \`--jid <jid> --server <id> --emoji <🔥>\` : React\n` + `╰────────────────────────`;
        const footerText = `${botName} • WhatsApp Channel Manager`;
        const buttons = [{
          name: "cta_copy",
          display_text: "📋 Salin Format Buat (Flag)",
          copy_code: `${prefix}saluran create --name "Nama Saluran" --desc "Deskripsi Singkat"`
        }, {
          name: "single_select",
          title: "📂 Pilih Tindakan Cepat",
          sections: [{
            title: `${botName} • Channel Shortcuts`,
            rows: [{
              title: "📋 Daftar Saluran Terikut",
              description: "Lihat semua saluran WhatsApp yang bot ikuti",
              id: `${prefix}saluran list`
            }, {
              title: "🔍 Contoh Cek Saluran",
              description: "Contoh inspeksi link saluran WhatsApp",
              id: `${prefix}saluran https://whatsapp.com/channel/0029VbCWturICVfd01iF0y47`
            }]
          }]
        }];
        const options = {
          image: defaultBanner,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Channel Action`,
              button_title: "Menu Saluran"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.sendCta(bodyText, footerText, buttons, options);
        await ctx.react("✅");
        return;
      }
      if (subCommand === "cek") {
        let target = flags.url || flags.jid || (cleanArgs[0] === "cek" ? cleanArgs[1] : cleanArgs[0]);
        if (!target) {
          return ctx.reply(`❌ Masukkan link atau ID Saluran!\n👉 Contoh Mudah: \`${prefix}saluran https://whatsapp.com/channel/0029VbCWturICVfd01iF0y47\`\n👉 Contoh Flag: \`${prefix}saluran cek --url https://whatsapp.com/channel/...\``);
        }
        await ctx.react("⏳");
        let chData = null;
        if (target.includes("whatsapp.com/channel/")) {
          chData = await sock.cekIDSaluran(target);
        } else {
          const jid = target.endsWith("@newsletter") ? target : `${target}@newsletter`;
          const meta = await sock.newsletterMetadata("jid", jid);
          if (meta) {
            const tm = meta.thread_metadata || {};
            chData = {
              id: meta.id,
              name: tm.name?.text || tm.name || "-",
              description: tm.description?.text || tm.description || "-",
              subscribers: Number(tm.subscribers_count || 0),
              creation_time: tm.creation_time,
              invite: tm.invite || "-",
              verification: tm.verification || "UNVERIFIED",
              preview: tm.preview?.direct_path ? `https://mmg.whatsapp.net${tm.preview.direct_path}` : null,
              viewer_metadata: meta.viewer_metadata
            };
          }
        }
        if (!chData || !chData.id) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal mendapatkan informasi saluran. Pastikan link atau ID valid.");
        }
        const bodyText = `╭───「 *CHANNEL INSPECTOR* 」\n` + `├ 📌 *Nama:* ${chData.name || "-"}\n` + `├ 🆔 *JID:* \`${chData.id}\`\n` + `├ 👥 *Pengikut:* ${formatNumber(chData.subscribers)} Subscriber\n` + `├ 📅 *Dibuat:* ${formatDate(chData.creation_time)}\n` + `├ 🔒 *Verifikasi:* ${chData.verification === "VERIFIED" ? "Terverifikasi (Centang Hijau) ✅" : "Belum Terverifikasi ❌"}\n` + `├ 🛡️ *Role Bot:* ${chData.viewer_metadata?.role || "GUEST / BUKAN MEMBER"}\n` + `│\n` + `├─「 *DESKRIPSI* 」\n` + `${chData.description || "Tidak ada deskripsi."}\n` + `╰────────────────────────`;
        const footerText = `${botName} • Channel Intelligence`;
        const channelUrl = chData.invite && chData.invite !== "-" ? `https://whatsapp.com/channel/${chData.invite}` : `https://whatsapp.com`;
        const buttons = [{
          name: "cta_url",
          display_text: "🌐 Buka Saluran di WhatsApp",
          url: channelUrl
        }, {
          name: "cta_copy",
          display_text: "📋 Salin JID Saluran",
          copy_code: chData.id
        }];
        const options = {
          image: chData.preview && chData.preview.startsWith("http") ? chData.preview : defaultBanner,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: chData.name || "Channel Action",
              button_title: "Aksi Saluran"
            }
          },
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          },
          quoted: quotedMsg
        };
        await ctx.sendCta(bodyText, footerText, buttons, options);
        await ctx.react("✅");
        return;
      }
      if (subCommand === "list") {
        await ctx.react("⏳");
        const list = await sock.newsletterFetchAllSubscribe();
        if (!list || !Array.isArray(list) || list.length === 0) {
          await ctx.react("❌");
          return ctx.reply("ℹ️ Bot belum mengikuti saluran mana pun.");
        }
        const bodyText = `📋 *DAFTAR SALURAN TERIKUT*\n\n` + `Bot saat ini telah bergabung dan mengikuti total *${list.length} saluran*.\n` + `Pilih salah satu saluran pada menu tombol di bawah untuk langsung menginspeksi metadatanya!`;
        const footerText = `${botName} • Total ${list.length} Saluran Terhubung`;
        const rows = list.slice(0, 25).map((ch, idx) => {
          const tm = ch.thread_metadata || {};
          const vm = ch.viewer_metadata || {};
          const name = tm.name?.text || tm.name || "Tanpa Nama";
          const role = vm.role || "SUBSCRIBER";
          const link = tm.invite ? `https://whatsapp.com/channel/${tm.invite}` : ch.id;
          return {
            title: `${idx + 1}. ${name}`,
            description: `Role: ${role} • JID: ${ch.id.slice(0, 16)}...`,
            id: `${prefix}saluran cek ${link}`
          };
        });
        const buttons = [{
          name: "single_select",
          title: `📁 Daftar Saluran (${list.length})`,
          sections: [{
            title: `${botName} • Saluran Terikut`,
            rows: rows
          }]
        }];
        const options = {
          image: defaultBanner,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              list_title: "Pilih Saluran untuk Diinspeksi",
              button_title: "Lihat Saluran"
            }
          },
          quoted: quotedMsg
        };
        await ctx.sendCta(bodyText, footerText, buttons, options);
        await ctx.react("✅");
        return;
      }
      if (subCommand === "create") {
        if (!ctx.isOwner && !ctx.isROwner) {
          return ctx.reply("❌ Fitur membuat saluran hanya diizinkan untuk Owner!");
        }
        let name = flags.name;
        let desc = flags.desc || "";
        if (!name) {
          const rawParams = cleanArgs.slice(1).join(" ");
          const parts = rawParams.split("|").map(s => s?.trim());
          name = parts[0];
          desc = parts[1] || "";
        }
        if (!name) {
          return ctx.reply(`❌ Format salah!\n\n👉 *Format Flag:* \`${prefix}saluran create --name "Nama Channel" --desc "Deskripsi Singkat"\`\n👉 *Format Pipa:* \`${prefix}saluran create Nama Channel | Deskripsi Singkat\``);
        }
        await ctx.react("⏳");
        const created = await sock.newsletterCreate(name, desc);
        if (!created || !created.id) {
          await ctx.react("❌");
          return ctx.reply("❌ Gagal membuat WhatsApp Channel.");
        }
        const bodyText = `🎉 *SALURAN BERHASIL DIBUAT!*\n\n` + `📌 *Nama:* ${created.name}\n` + `🆔 *JID:* \`${created.id}\`\n` + `📅 *Waktu:* ${formatDate(created.creation_time)}\n` + `📝 *Deskripsi:* ${created.description || "-"}`;
        const footerText = `${botName} • Saluran Baru`;
        const channelLink = created.invite ? `https://whatsapp.com/channel/${created.invite}` : "https://whatsapp.com";
        const buttons = [{
          name: "cta_url",
          display_text: "🌐 Kunjungi Saluran Baru",
          url: channelLink
        }, {
          name: "cta_copy",
          display_text: "📋 Salin Link Saluran",
          copy_code: channelLink
        }];
        const options = {
          image: defaultBanner,
          quoted: quotedMsg
        };
        await ctx.sendCta(bodyText, footerText, buttons, options);
        await ctx.react("✅");
        return;
      }
      if (subCommand === "react") {
        let channelJid = flags.jid;
        let serverId = flags.server;
        let emoji = flags.emoji;
        if (!channelJid || !serverId || !emoji) {
          const rawParams = cleanArgs.slice(1).join(" ");
          const parts = rawParams.split("|").map(s => s?.trim());
          channelJid = channelJid || parts[0];
          serverId = serverId || parts[1];
          emoji = emoji || parts[2];
        }
        if (!channelJid || !serverId || !emoji) {
          return ctx.reply(`❌ Format salah!\n\n👉 *Format Flag:* \`${prefix}saluran react --jid 120363428527344828@newsletter --server 1 --emoji 🔥\`\n👉 *Format Pipa:* \`${prefix}saluran react 120363428527344828@newsletter | 1 | 🔥\``);
        }
        await ctx.react("⏳");
        const targetJid = String(channelJid).endsWith("@newsletter") ? String(channelJid) : `${channelJid}@newsletter`;
        await sock.newsletterReactMessage(targetJid, Number(serverId), emoji);
        await ctx.react("✅");
        return ctx.reply(`✅ Berhasil mengirim reaksi ${emoji} ke postingan #${serverId}!`);
      }
    } catch (err) {
      await ctx.react("❌");
      ctx.reply(`❌ Saluran Error: ${err.message}`);
    }
  }
};