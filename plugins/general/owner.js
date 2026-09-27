import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "owner",
  aliases: ["creator", "developer", "dev"],
  description: "Menampilkan kartu kontak resmi dan tombol interaktif Owner / Developer Bot",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      await ctx.react("⏳");
      const botName = global.bot?.name || "WudysoftBot";
      const prefix = ctx.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
      const uniqueOwners = [...new Set(rawOwners.map(v => String(v).replace(/\D/g, "")).filter(Boolean))];
      if (!uniqueOwners.length) {
        return ctx.reply("❌ Daftar nomor owner belum dikonfigurasi di `global.bot.owner`.");
      }
      const mainOwnerNum = uniqueOwners[0];
      const contactsData = uniqueOwners.map((num, idx) => {
        const ownerName = idx === 0 ? `${botName} (Lead Developer)` : `${botName} Co-Owner #${idx}`;
        return [num, ownerName];
      });
      await ctx.sendContact(contactsData, {
        quoted: quotedMsg
      });
      const bodyText = `👑 *OFFICIAL BOT DEVELOPER*\n\n` + `Berikut adalah profil resmi pengembang dan pemilik *${botName}*.\n` + `Gunakan tombol aksi di bawah untuk menghubungi atau menyalin kontak.\n\n` + `╭───『 *INFO DEVELOPER* 』\n` + `│ 👤 *Developer Utama:* +${mainOwnerNum}\n` + `│ 👥 *Total Pengelola:* ${uniqueOwners.length} Kontak Terdaftar\n` + `│ 🕒 *Jam Aktif:* 08.00 - 22.00 WIB\n` + `╰──────────────────\n\n` + `_⚠️ Dilarang melakukan panggilan spam / telpon tanpa izin terlebih dahulu._`;
      const footerText = `${botName} • Dedicated Developer Support`;
      const buttons = [{
        name: "cta_url",
        display_text: "💬 Chat Langsung Owner",
        url: `https://wa.me/${mainOwnerNum}?text=${encodeURIComponent(`Halo Developer ${botName}, saya ingin bertanya seputar bot.`)}`
      }, {
        name: "cta_copy",
        display_text: `📋 Salin Nomor (+${mainOwnerNum})`,
        copy_code: `+${mainOwnerNum}`
      }, {
        name: "single_select",
        title: "⚡ PILIHAN MENU LAINNYA",
        sections: [{
          title: `${botName} • Quick Actions`,
          rows: [{
            title: "👑 Daftar Semua Owner",
            description: "Lihat daftar lengkap seluruh co-owner & dev",
            id: `${prefix}listowner`
          }, {
            title: "🏠 Menu Utama",
            description: "Buka menu utama dan daftar fitur lengkap",
            id: `${prefix}menu`
          }, {
            title: "⚡ Server Ping & Status",
            description: "Cek latensi dan kecepatan respon bot",
            id: `${prefix}ping`
          }]
        }]
      }];
      if (global.bot?.utils?.source_urls) {
        buttons.push({
          name: "cta_url",
          display_text: "🌐 Saluran / Komunitas",
          url: global.bot.utils.source_urls
        });
      }
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [2],
            list_title: `${botName} • Kontak Developer`,
            button_title: "👑 Hubungi Developer"
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
        await ctx.reply(bodyText, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[OWNER CMD ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal mengirim kontak owner: ${e.message}`);
    }
  }
};