import crypto from "crypto";
import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
import db from "../../data/db.js";
async function generateSecurityCard(avatarUrl) {
  try {
    const payload = {
      avatar: avatarUrl,
      borderColor: "f0f0f0",
      locale: "en",
      overlayOpacity: .9,
      userTime: 6048e5,
      suspectTime: 6048e5
    };
    const response = await axios.post("https://wudysoft.my.id/api/canvas/canvafy/security", payload, {
      responseType: "arraybuffer",
      timeout: 15e3,
      headers: {
        "Content-Type": "application/json"
      }
    });
    return Buffer.from(response.data);
  } catch (err) {
    console.warn("[CANVAFY SECURITY ERROR, using Avatar]:", err.message);
    return avatarUrl;
  }
}
export default {
  name: "register",
  aliases: ["daftar", "reg"],
  description: "Daftar sebagai pengguna bot via Interactive Membership Card & CTA Sheet",
  category: "General",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const user = global.db?.user?.[ctx.sender];
      const botName = global.bot?.name || "WudysoftBot";
      const senderNum = ctx.sender.split("@")[0];
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      let profilePic = global.bot?.media?.avatar || "https://files.catbox.moe/8ugr9a.jpg";
      try {
        profilePic = await sock.profilePictureUrl(ctx.sender, "image");
      } catch {}
      if (user?.name && user.name !== senderNum && user.registered) {
        await ctx.react("⏳");
        const mediaCard = await generateSecurityCard(profilePic);
        const userStatus = user.ownerAcces ? "BOT OWNER 👑" : user.premium?.status ? "PREMIUM ⭐" : "FREE USER 👤";
        const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }) : "Lama";
        const bodyAlready = `Hai *${user.name}*, akun kamu sudah terverifikasi di database! ✅\n\n` + `╭───『 *MEMBER CARD* 』\n` + `│ 👤 *Nama:* ${user.name}\n` + `│ 📱 *Nomor:* @${senderNum}\n` + `│ 🏷️ *Status:* ${userStatus}\n` + `│ 🎫 *Sisa Limit:* ${user.ownerAcces ? "Unlimited ♾️" : user.limit ?? 20}\n` + `│ 📅 *Bergabung:* ${regDate}\n` + `╰──────────────────\n\n` + `_Ketuk tombol di bawah untuk membuka navigasi atau menyalin data akunmu:_`;
        const footerAlready = `${botName} • Akun Terdaftar`;
        const buttonsAlready = [{
          name: "cta_copy",
          display_text: "📋 Salin User JID",
          copy_code: ctx.sender
        }, {
          name: "single_select",
          title: "⚡ NAVIGASI AKUN",
          sections: [{
            title: `${botName} • Shortcut Menu`,
            rows: [{
              title: "🏠 Menu Utama",
              description: "Buka menu dan daftar semua fitur bot",
              id: `${prefix}menu`
            }, {
              title: "👤 Cek Profil",
              description: "Lihat status RPG, saldo, dan atribut kamu",
              id: `${prefix}profile`
            }, {
              title: "🎁 Klaim Daily Reward",
              description: "Ambil hadiah limit dan EXP harian",
              id: `${prefix}daily`
            }]
          }]
        }];
        const optionsAlready = {
          image: mediaCard,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Status Member`,
              button_title: "⚡ Navigasi Akun"
            }
          },
          contextInfo: {
            mentionedJid: [ctx.sender],
            forwardingScore: 999,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: "0@bot"
            }
          },
          quoted: quotedMsg
        };
        if (typeof ctx.sendCta === "function") {
          await ctx.sendCta(bodyAlready, footerAlready, buttonsAlready, optionsAlready);
        } else {
          await sock.sendMessage(ctx.id, {
            image: Buffer.isBuffer(mediaCard) ? mediaCard : {
              url: mediaCard
            },
            caption: bodyAlready,
            mentions: [ctx.sender]
          }, {
            quoted: quotedMsg
          });
        }
        await ctx.react("✅");
        return;
      }
      const name = ctx.query?.trim();
      if (!name) {
        return ctx.reply(`📝 *REGISTRASI PENGGUNA*\n\n` + `Silakan tentukan nama kamu untuk mendaftar!\n` + `📌 *Format:* \`${prefix}register <nama>\`\n` + `💡 *Contoh:* \`${prefix}register Wudysoft\``);
      }
      if (name.length < 3 || name.length > 20) {
        return ctx.reply("❌ Panjang nama harus antara 3 hingga 20 karakter!");
      }
      if (!/^[a-zA-Z0-9_ ]+$/.test(name)) {
        return ctx.reply("❌ Nama hanya boleh mengandung huruf, angka, spasi, dan garis bawah (_)!");
      }
      await ctx.react("⏳");
      const sn = crypto.createHash("md5").update(ctx.sender + Date.now()).digest("hex").slice(0, 16).toUpperCase();
      if (typeof db?.ensureUser === "function") {
        db.ensureUser(ctx.sender, name);
      }
      global.db.user[ctx.sender].name = name;
      global.db.user[ctx.sender].registered = true;
      global.db.user[ctx.sender].createdAt = Date.now();
      global.db.user[ctx.sender].sn = sn;
      global.db.user[ctx.sender].money = (global.db.user[ctx.sender].money || 0) + 1e3;
      if (typeof db?.write === "function") {
        db.write(global.db);
      }
      const mediaCard = await generateSecurityCard(profilePic);
      const defaultLimit = global.bot?.defaultLimit || 20;
      const bodySuccess = `🎉 *SELAMAT! PENDAFTARAN BERHASIL*\n` + `Selamat bergabung di *${botName}*, *${name}*!\n\n` + `╭───『 *KARTU ANGGOTA BARU* 』\n` + `│ 👤 *Nama:* ${name}\n` + `│ 📱 *WhatsApp:* @${senderNum}\n` + `│ 🏷️ *Status Awal:* FREE USER 👤\n` + `│ 🔑 *Serial Key (SN):* \`${sn}\`\n` + `╰──────────────────\n\n` + `╭───『 *STARTER BONUS* 』\n` + `│ 🎫 *Limit Awal:* +${defaultLimit} Limit\n` + `│ 💰 *Bonus Saldo:* +Rp 1.000\n` + `│ 🎮 *RPG Level:* Level 1 (Novice)\n` + `│ ❤️ *Starter HP:* 100/100\n` + `╰──────────────────\n\n` + `_Ketuk tombol di bawah untuk mulai menjelajahi fitur dan menyalin kode SN:_`;
      const footerSuccess = `${botName} • Pendaftaran Sukses`;
      const starterActions = [{
        title: "📜 BUKA MENU LENGKAP",
        id: `${prefix}menu`,
        description: "Jelajahi semua kategori dan ratusan fitur bot"
      }, {
        title: "👤 CEK PROFIL SAYA",
        id: `${prefix}profile`,
        description: "Lihat status RPG, HP, Mana, dan sisa limit"
      }, {
        title: "🎁 KLAIM REWARD HARIAN",
        id: `${prefix}daily`,
        description: "Ambil hadiah limit dan bonus koin harian"
      }];
      const buttonsSuccess = [{
        name: "cta_copy",
        display_text: "📋 Salin Serial Key (SN)",
        copy_code: sn
      }, {
        name: "single_select",
        title: "🚀 LANGKAH AWAL PEMAIN",
        sections: [{
          title: `${botName} • Mulai Petualangan`,
          rows: starterActions
        }]
      }];
      const optionsSuccess = {
        image: mediaCard,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Registrasi Sukses`,
            button_title: "🚀 Mulai Sekarang"
          }
        },
        contextInfo: {
          mentionedJid: [ctx.sender],
          forwardingScore: 999,
          isForwarded: true,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot"
          }
        },
        quoted: quotedMsg
      };
      if (typeof ctx.sendCta === "function") {
        await ctx.sendCta(bodySuccess, footerSuccess, buttonsSuccess, optionsSuccess);
      } else {
        await sock.sendMessage(ctx.id, {
          image: Buffer.isBuffer(mediaCard) ? mediaCard : {
            url: mediaCard
          },
          caption: bodySuccess,
          mentions: [ctx.sender]
        }, {
          quoted: quotedMsg
        });
      }
      await ctx.react("✅");
    } catch (e) {
      console.error("[REGISTER ERROR]:", e);
      await ctx.react("❌");
      ctx.reply(`❌ Registrasi gagal: ${e.message}`);
    }
  }
};