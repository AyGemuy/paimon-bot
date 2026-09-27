import {
  simpleQuoted
} from "../../lib/quoted.js";
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
export default {
  name: "cekgc",
  aliases: ["checkgc", "inspectgc", "infogc", "cekgroup", "inspect"],
  description: "Periksa detail dan informasi grup WhatsApp dari link undangan, reply pesan, atau grup saat ini",
  category: "Tools",
  limit: true,
  example: "inspect (di grup) atau inspect https://chat.whatsapp.com/xxx",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const queryText = (ctx.query || ctx.args?.join(" ") || "").trim();
      const quotedText = (ctx.quoted?.text || "").trim();
      const combinedText = `${queryText} ${quotedText}`.trim();
      let target = "";
      let inviteCode = "";
      let inviteLink = "";
      const match = combinedText.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i);
      if (match) {
        inviteCode = match[1];
        inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
        target = inviteLink;
      } else if (queryText.endsWith("@g.us")) {
        target = queryText;
      } else if (ctx.isGroup || ctx.group || ctx.chat?.endsWith("@g.us")) {
        target = ctx.chat || ctx.id;
      }
      if (!target) {
        await ctx.react("❌");
        return ctx.reply(`❌ Masukkan link grup WhatsApp atau gunakan perintah ini langsung di dalam grup!\n\n` + `👉 *Contoh Link:* \`${prefix}inspect https://chat.whatsapp.com/GoHmb4noThh92L8FFf79Bh\`\n` + `👉 *Di Dalam Grup:* Cukup ketik \`${prefix}inspect\`\n` + `👉 *Reply Link:* Balas pesan berisi link lalu ketik \`${prefix}inspect\``);
      }
      let groupInfo = null;
      if (inviteCode) {
        groupInfo = await sock.groupGetInviteInfo(inviteCode).catch(() => {
          throw new Error("Tautan grup telah kedaluwarsa, direset, atau tidak valid.");
        });
      } else if (target.endsWith("@g.us")) {
        groupInfo = await sock.groupMetadata(target).catch(() => {
          throw new Error("Gagal mengambil metadata grup atau bot tidak berada di dalam grup tersebut.");
        });
        try {
          const code = await sock.groupInviteCode(target);
          if (code) inviteLink = `https://chat.whatsapp.com/${code}`;
        } catch (_) {
          inviteLink = groupInfo.desc?.match(/https:\/\/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i)?.[0] || "";
        }
      }
      if (!groupInfo) {
        await ctx.react("❌");
        return ctx.reply("❌ Gagal mendapatkan informasi grup.");
      }
      const groupId = groupInfo.id || target || "-";
      const subject = groupInfo.subject || "Grup WhatsApp";
      const rawOwner = groupInfo.ownerPn || groupInfo.owner || groupInfo.subjectOwnerPn || groupInfo.subjectOwner || "-";
      const ownerNumber = rawOwner !== "-" ? rawOwner.split("@")[0].split(":")[0] : "-";
      const creationDate = formatDate(groupInfo.creation);
      const memberCount = groupInfo.size || groupInfo.participants?.length || 0;
      let adminCount = "-";
      if (Array.isArray(groupInfo.participants)) {
        adminCount = groupInfo.participants.filter(p => p.admin).length;
      }
      const isAnnounce = groupInfo.announce ? "🔒 Hanya Admin (Tutup)" : "🔓 Semua Peserta (Buka)";
      const isRestrict = groupInfo.restrict ? "🔒 Hanya Admin" : "🔓 Semua Peserta";
      const isCommunity = groupInfo.isCommunity ? "🏢 Induk Komunitas" : groupInfo.linkedParent ? "👥 Sub-Grup Komunitas" : "❌ Bukan Komunitas";
      const desc = groupInfo.desc || "Tidak ada deskripsi grup.";
      const mentions = [];
      if (ownerNumber !== "-" && /^\d+$/.test(ownerNumber)) {
        mentions.push(`${ownerNumber}@s.whatsapp.net`);
      }
      let groupPic = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
      try {
        if (groupId !== "-") {
          groupPic = await sock.profilePictureUrl(groupId, "image");
        }
      } catch (_) {}
      const bodyText = `╭───『 *INFORMASI GRUP WA* 』\n` + `│ 🏷️ *Nama Grup:* ${subject}\n` + `│ 🆔 *ID Grup:* \`${groupId}\`\n` + `│ 👑 *Pembuat/Owner:* ${ownerNumber !== "-" ? `@${ownerNumber}` : "-"}\n` + `│ 📅 *Dibuat Pada:* ${creationDate}\n` + `│ 👥 *Total Member:* ${memberCount} Anggota\n` + `│ 🛡️ *Jumlah Admin:* ${adminCount}\n` + `│ 💬 *Kirim Pesan:* ${isAnnounce}\n` + `│ ⚙️ *Edit Info Grup:* ${isRestrict}\n` + `│ 🌐 *Tipe Grup:* ${isCommunity}\n` + `╰──────────────────\n\n` + `📝 *Deskripsi Grup:*\n` + `_${desc.slice(0, 500)}${desc.length > 500 ? "..." : ""}_\n`;
      const footerText = `${botName} • WhatsApp Group Inspector`;
      const buttons = [];
      if (inviteLink) {
        buttons.push({
          name: "cta_url",
          display_text: "🔗 Buka / Gabung Grup",
          url: inviteLink
        });
        buttons.push({
          name: "cta_copy",
          display_text: "📋 Salin Link Grup",
          copy_code: inviteLink
        });
      }
      buttons.push({
        name: "cta_copy",
        display_text: "🆔 Salin ID Grup",
        copy_code: groupId
      });
      buttons.push({
        name: "quick_reply",
        display_text: "🔍 Cari Grup Lain",
        id: `${prefix}gcsearch`
      });
      const options = {
        image: groupPic,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Group Actions`,
            button_title: "Menu Aksi"
          },
          limited_time_offer: {
            text: `✦ ${botName} - Group Inspector ✦`,
            url: inviteLink || "",
            copy_code: inviteLink || groupId,
            expiration_time: Date.now() + 3600 * 1e3
          }
        },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          },
          mentionedJid: mentions
        },
        quoted: quotedMsg
      };
      await ctx.sendCta(bodyText, footerText, buttons, options);
      await ctx.react("✅");
    } catch (error) {
      await ctx.react("❌");
      ctx.reply(`❌ Cek Group Gagal: ${error.message}`);
    }
  }
};