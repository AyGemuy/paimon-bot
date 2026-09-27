import {
  runtime
} from "../../core/tools.js";
import {
  resizeImage
} from "../../core/serialize.js";
import {
  startJadiBot,
  deleteJadiBot,
  getJadiBotsList
} from "../../core/jadibot.js";
global.jadibotSessions = global.jadibotSessions || new Map();
async function clearJadibotSession(sock, targetKey, autoDelete = true) {
  if (!global.jadibotSessions.has(targetKey)) return;
  const session = global.jadibotSessions.get(targetKey);
  if (session.timer) {
    clearTimeout(session.timer);
  }
  if (autoDelete && session.msgKey && sock) {
    try {
      await sock.sendMessage(session.chatId, {
        delete: session.msgKey
      });
    } catch (_) {}
  }
  global.jadibotSessions.delete(targetKey);
}

function formatDate(timestamp) {
  if (!timestamp) return "Tidak diketahui";
  return new Date(timestamp).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "medium"
  }) + " WIB";
}
export default {
  name: "jadibot",
  aliases: ["subbot", "listjadibot", "deljadibot", "stopjadibot", "infojadibot"],
  description: "Manajemen Jadibot Full Endless Interactive via CTA Single List",
  category: "Tools",
  before: async (msg, {
    sock,
    ctx
  }) => {
    try {
      const sender = ctx?.sender || msg?.key?.participant || msg?.key?.remoteJid;
      const senderNum = sender?.split("@")[0]?.replace(/\D/g, "");
      if (!senderNum || !global.jadibotSessions.has(senderNum)) return false;
      const session = global.jadibotSessions.get(senderNum);
      const quotedStanzaId = ctx?.quoted?.id || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;
      const userText = (ctx?.text || ctx?.body || msg?.message?.conversation || "").trim().toLowerCase();
      const isQuoting = quotedStanzaId && session.msgKey?.id === quotedStanzaId;
      if ((isQuoting || session.chatId === ctx.chat) && ["batal", "cancel", "stop", "exit"].includes(userText)) {
        await clearJadibotSession(sock, senderNum, true);
        await deleteJadiBot(senderNum);
        if (typeof ctx?.react === "function") await ctx.react("🛑");
        await ctx.reply("🛑 *Sesi penautan Jadibot berhasil dibatalkan dan pesan pairing telah dibersihkan.*");
        return true;
      }
      return false;
    } catch (e) {
      console.error("[JADIBOT BEFORE ERROR]:", e);
      return false;
    }
  },
  execute: async (sock, ctx, msg, {
    args,
    command,
    isOwner
  }) => {
    const subCmd = (args[0] || "").toLowerCase();
    const prefix = ctx.prefix || ".";
    const senderNum = (ctx.senderNumber || ctx.sender || "").split("@")[0].replace(/\D/g, "");
    const targetPrivateJid = `${senderNum}@s.whatsapp.net`;
    const botName = global.bot?.name || "Wudysoft Bot";
    const bannerImg = global.bot?.media?.banner1 || "https://files.catbox.moe/g2e6i5.jpg";
    if (command === "listjadibot" || subCmd === "list") {
      const list = getJadiBotsList();
      if (!list.length) {
        const emptyText = `╭───『 *DAFTAR JADIBOT AKTIF* 』\n` + `│ 📊 *Total:* 0 Sub-Bot\n` + `╰──────────────────\n\n` + `📂 *Saat ini belum ada sub-bot yang terdaftar atau online.*\n` + `Kamu dapat menautkan nomor WhatsApp menjadi Jadibot melalui menu di bawah:`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔘 Menu Jadibot",
            sections: [{
              title: "Mulai Penautan",
              rows: [{
                title: "🔑 Buat via Pairing Code",
                description: "Tautkan via kode 8 digit instan",
                id: `${prefix}jadibot pair`
              }, {
                title: "📷 Buat via QR Code",
                description: "Tautkan via scanner QR Code kamera",
                id: `${prefix}jadibot qr`
              }, {
                title: "🏠 Menu Utama Jadibot",
                description: "Kembali ke dashboard utama",
                id: `${prefix}jadibot`
              }]
            }]
          })
        }];
        const options = {
          title: "Jadibot Manager",
          subtitle: "Daftar Sub-Bot Kosong",
          image: bannerImg,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Menu Jadibot",
              button_title: "Mulai Penautan"
            }
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(emptyText, `${botName} • Jadibot Manager`, buttons, options);
        }
        return await ctx.reply(emptyText);
      }
      const bodyText = `╭───『 *DAFTAR JADIBOT TERDAFTAR* 』\n` + `│ 📊 *Total Sub-Bot:* ${list.length} Nomor\n` + `╰──────────────────\n\n` + list.map((b, i) => {
        const status = b.status === "ONLINE" ? "🟢 ONLINE" : "🔴 OFFLINE";
        const uptime = b.uptime ? runtime(b.uptime / 1e3) : "Tidak Aktif";
        return `*${i + 1}.* +${b.number}\n   • *Status:* ${status}\n   • *Uptime:* ${uptime}`;
      }).join("\n\n") + `\n\n_👉 Pilih salah satu bot dari menu list di bawah untuk melihat rincian detail & statistik lengkapnya._`;
      const botRows = list.map(b => ({
        title: `+${b.number} [${b.status}]`.slice(0, 24),
        description: `Lihat info lengkap & status bot ini`.slice(0, 72),
        id: `${prefix}infojadibot ${b.number}`
      }));
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "📋 Pilih Sub-Bot",
          sections: [{
            title: "Daftar Nomor Jadibot",
            rows: botRows
          }, {
            title: "Navigasi Lainnya",
            rows: [{
              title: "➕ Tautkan Sub-Bot Baru",
              description: "Mulai sesi penautan Jadibot baru",
              id: `${prefix}jadibot pair`
            }, {
              title: "🏠 Dashboard Utama",
              description: "Kembali ke menu beranda Jadibot",
              id: `${prefix}jadibot`
            }]
          }]
        })
      }];
      const options = {
        title: "Daftar Sub-Bot Aktif",
        subtitle: `Total: ${list.length} Sub-Bot`,
        image: bannerImg,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Pilih Sub-Bot",
            button_title: "Daftar Jadibot"
          }
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • Jadibot Manager`, buttons, options);
      }
      return await ctx.reply(bodyText);
    }
    if (command === "infojadibot" || subCmd === "info") {
      let targetNum = (args[1] || args[0] || senderNum).replace(/\D/g, "");
      const list = getJadiBotsList();
      const botData = list.find(b => b.number === targetNum);
      if (!botData) {
        return ctx.reply(`❌ Jadibot dengan nomor *+${targetNum}* tidak ditemukan di dalam sistem database.`);
      }
      const isOnline = botData.status === "ONLINE";
      const statusBadge = isOnline ? "🟢 ONLINE (Beroperasi)" : "🔴 OFFLINE (Terputus)";
      const uptimeStr = botData.uptime ? runtime(botData.uptime / 1e3) : "Tidak Aktif";
      const joinTime = formatDate(botData.connectedAt);
      const platformStr = botData.platform || "WhatsApp Web (Baileys Multi-Device)";
      const speedStr = isOnline ? `${botData.speed || 120}ms (Stabil)` : "Terputus";
      const sessionPath = `session_jadibot/${botData.number}`;
      const bodyText = `╭───『 🤖 *JADIBOT DETAIL & STATS* 』\n` + `│ 👤 *Nomor Bot:* +${botData.number}\n` + `│ 📡 *Status Koneksi:* ${statusBadge}\n` + `│ ⏱️ *Aktif Selama:* ${uptimeStr}\n` + `│ 📅 *Waktu Join:* \n` + `│    _${joinTime}_\n` + `│ 📱 *Platform Client:* ${platformStr}\n` + `│ ⚡ *Kecepatan Respon:* ${speedStr}\n` + `│ 📁 *Direktori Sesi:* \n` + `│    \`${sessionPath}\`\n` + `│ 🛡️ *Akses:* Sub-Bot Clone Engine\n` + `╰──────────────────────────\n\n` + `_Gunakan tombol menu interaktif di bawah untuk mengelola sub-bot ini:_`;
      const buttons = [{
        name: "single_select",
        buttonParamsJson: JSON.stringify({
          title: "⚙️ Pengaturan Sub-Bot",
          sections: [{
            title: `Tindakan (+${botData.number})`,
            rows: [{
              title: "🛑 Hentikan & Hapus Sesi",
              description: `Matikan dan bersihkan sesi +${botData.number}`,
              id: `${prefix}deljadibot ${botData.number}`
            }, {
              title: "📋 Kembali ke Daftar Sub-Bot",
              description: "Lihat list semua Jadibot yang terdaftar",
              id: `${prefix}listjadibot`
            }]
          }, {
            title: "Navigasi Lainnya",
            rows: [{
              title: "➕ Buat Sesi Jadibot Baru",
              description: "Tautkan nomor lain sebagai sub-bot",
              id: `${prefix}jadibot pair`
            }, {
              title: "🏠 Menu Utama Jadibot",
              description: "Kembali ke dashboard utama",
              id: `${prefix}jadibot`
            }]
          }]
        })
      }];
      const options = {
        title: "Sub-Bot Diagnostic",
        subtitle: `Status: +${botData.number}`,
        image: bannerImg,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            list_title: "Opsi Sub-Bot",
            button_title: "Kelola Sub-Bot"
          }
        },
        quoted: msg
      };
      if (typeof ctx.sendCta === "function") {
        return await ctx.sendCta(bodyText, `${botName} • Diagnostic Center`, buttons, options);
      }
      return await ctx.reply(bodyText);
    }
    if (command === "deljadibot" || command === "stopjadibot" || subCmd === "delete" || subCmd === "stop") {
      let targetNum = args[1] || args[0];
      if (targetNum === "delete" || targetNum === "stop") targetNum = args[1];
      if (!targetNum || !isOwner && targetNum !== senderNum) {
        targetNum = senderNum;
      }
      targetNum = targetNum.replace(/\D/g, "");
      await clearJadibotSession(sock, targetNum, true);
      if (typeof ctx.react === "function") await ctx.react("⏳");
      const success = await deleteJadiBot(targetNum);
      if (typeof ctx.react === "function") await ctx.react(success ? "✅" : "❌");
      if (success) {
        const bodyText = `✅ *SUKSES MENGHAPUS JADIBOT*\n\n` + `Sesi sub-bot untuk nomor *+${targetNum}* telah berhasil diputus dan seluruh data sesi telah dibersihkan dari server.`;
        const buttons = [{
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "🔘 Menu Navigasi",
            sections: [{
              title: "Aksi Selanjutnya",
              rows: [{
                title: "➕ Sambungkan Ulang",
                description: "Buat sesi Jadibot baru via pairing",
                id: `${prefix}jadibot pair`
              }, {
                title: "📋 Cek Daftar Sub-Bot",
                description: "Lihat daftar bot yang masih aktif",
                id: `${prefix}listjadibot`
              }, {
                title: "🏠 Menu Utama Jadibot",
                description: "Kembali ke menu beranda",
                id: `${prefix}jadibot`
              }]
            }]
          })
        }];
        const options = {
          title: "Sesi Berhasil Dihapus",
          subtitle: `Nomor: +${targetNum}`,
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 2,
              list_title: "Navigasi Jadibot",
              button_title: "Pilih Tindakan"
            }
          },
          quoted: msg
        };
        if (typeof ctx.sendCta === "function") {
          return await ctx.sendCta(bodyText, `${botName} • Jadibot Engine`, buttons, options);
        }
        return await ctx.reply(bodyText);
      } else {
        return ctx.reply(`❌ Gagal menghapus sesi atau nomor *+${targetNum}* tidak ditemukan.`);
      }
    }
    if (subCmd === "qr") {
      await clearJadibotSession(sock, senderNum, true);
      if (ctx.isGroup) {
        await ctx.reply(`📩 *QR Code sedang dikirim ke Chat Pribadi (PC) kamu!*\nSilakan periksa chat pribadi dari bot demi privasi dan keamanan akun.`, {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply("⏳ *Sedang menyiapkan QR Code Jadibot...*\nScan gambar QR yang akan dikirim dalam hitungan detik (Maksimal 3x percobaan).");
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "qr",
        onQR: async (qrBuffer, attempt, max) => {
          await clearJadibotSession(sock, senderNum, true);
          const sentMsg = await sock.sendMessage(targetPrivateJid, {
            image: qrBuffer,
            caption: `╭───『 *SCAN QR CODE JADIBOT* 』\n` + `│ 📷 Arahkan kamera WhatsApp ke QR Code di atas.\n` + `│ 🔄 *Percobaan:* ${attempt} dari ${max}\n` + `│ ⏱️ *Masa Berlaku:* 30 Detik (Auto-Delete)\n` + `╰──────────────────\n\n` + `*📌 Panduan Menautkan:*\n` + `1. Buka *WhatsApp* di HP lain > Titik tiga (⋮) / Pengaturan\n` + `2. Pilih *Perangkat Tertaut* > *Tautkan Perangkat*\n` + `3. Scan QR Code di atas.\n\n` + `_Balas pesan ini dengan kata *batal* untuk membatalkan._`
          });
          if (sentMsg?.key) {
            const timer = setTimeout(async () => {
              if (global.jadibotSessions.has(senderNum)) {
                const s = global.jadibotSessions.get(senderNum);
                global.jadibotSessions.delete(senderNum);
                if (attempt >= max) {
                  await deleteJadiBot(senderNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
            }, 30 * 1e3);
            global.jadibotSessions.set(senderNum, {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              timer: timer
            });
          }
        }
      });
    }
    if (subCmd === "pair" || subCmd === "code" || !subCmd && !command.includes("jadibot")) {
      await clearJadibotSession(sock, senderNum, true);
      if (ctx.isGroup) {
        await ctx.reply(`📩 *Kode Pairing sedang dikirim ke Chat Pribadi (PC) kamu!*\nSilakan periksa chat pribadi dari bot demi keamanan akun.`, {
          mentions: [targetPrivateJid]
        });
      } else {
        await ctx.reply("⏳ *Sedang meminta kode pairing dari WhatsApp server...*\nHarap tunggu sebentar.");
      }
      return await startJadiBot(sock, targetPrivateJid, {
        mode: "pair",
        onPairingCode: async (pairingCode, attempt, max) => {
          await clearJadibotSession(sock, senderNum, true);
          const codeFormatted = pairingCode?.match(/.{1,4}/g)?.join("-") || pairingCode;
          const bodyText = `╭───『 *KODE PAIRING JADIBOT* 』\n` + `│ 🔑 *Kode:* *${codeFormatted}*\n` + `│ 🔄 *Percobaan:* ${attempt} dari ${max}\n` + `╰──────────────────\n\n` + `*📌 Langkah Menautkan:*\n` + `1. Buka notifikasi WhatsApp atau buka *Perangkat Tertaut*.\n` + `2. Pilih *Tautkan dengan nomor telepon saja*.\n` + `3. Ketuk tombol *Salin Kode* di bawah dan tempel kodenya.\n\n` + `_⏱️ Kode kedaluwarsa dalam 2 menit (Pesan otomatis terhapus)._\n` + `_Balas pesan ini dengan kata *batal* untuk membatalkan._`;
          const footerText = `${botName} • Pairing Engine (Attempt ${attempt}/${max})`;
          const buttons = [{
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Salin Kode Pairing",
              copy_code: codeFormatted,
              has_multiple_buttons: true
            })
          }, {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "🔘 Menu Opsi Penautan",
              sections: [{
                title: "Opsi Tambahan",
                rows: [{
                  title: "🛑 Batalkan Penautan",
                  description: "Hapus sesi dan batalkan proses pairing",
                  id: `${prefix}deljadibot ${senderNum}`
                }, {
                  title: "📷 Ganti ke Mode QR Code",
                  description: "Tautkan perangkat dengan scan QR Code",
                  id: `${prefix}jadibot qr`
                }, {
                  title: "📋 Lihat Daftar Sub-Bot",
                  description: "Cek bot yang sedang aktif",
                  id: `${prefix}listjadibot`
                }]
              }]
            })
          }];
          const options = {
            title: "Kode Pairing WhatsApp",
            subtitle: `Nomor: +${senderNum} (Attempt ${attempt}/${max})`,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                list_title: "Opsi Penautan",
                button_title: "Menu Tambahan"
              }
            },
            quoted: msg
          };
          let sentMsg = null;
          if (typeof ctx.sendCta === "function") {
            sentMsg = await ctx.sendCta(bodyText, footerText, buttons, {
              jid: targetPrivateJid,
              ...options
            });
          } else {
            sentMsg = await sock.sendMessage(targetPrivateJid, {
              text: bodyText
            });
          }
          if (sentMsg?.key) {
            const timer = setTimeout(async () => {
              if (global.jadibotSessions.has(senderNum)) {
                const s = global.jadibotSessions.get(senderNum);
                global.jadibotSessions.delete(senderNum);
                if (attempt >= max) {
                  await deleteJadiBot(senderNum);
                }
                try {
                  await sock.sendMessage(targetPrivateJid, {
                    delete: s.msgKey
                  });
                } catch (_) {}
              }
            }, 120 * 1e3);
            global.jadibotSessions.set(senderNum, {
              chatId: targetPrivateJid,
              msgKey: sentMsg.key,
              timer: timer
            });
          }
        }
      });
    }
    const list = getJadiBotsList();
    const myBot = list.find(b => b.number === senderNum);
    const myBotStatus = myBot ? `🟢 Aktif (+${myBot.number})` : "🔴 Belum Terdaftar";
    const bodyText = `Halo @${senderNum} 👋\n` + `Selamat datang di *Jadibot Control Center*!\n\n` + `Fitur ini memungkinkan nomor WhatsApp kamu menjadi bot kloning yang memiliki seluruh fitur dan respon cepat dari bot utama.\n\n` + `╭───『 *STATUS KAMU* 』\n` + `│ 👤 *Nomor:* +${senderNum}\n` + `│ 🤖 *Status Jadibot:* ${myBotStatus}\n` + `│ 📊 *Total Jadibot Server:* ${list.length} Bot Aktif\n` + `╰──────────────────\n\n` + `_Silakan pilih opsi navigasi di bawah untuk mulai mengelola Jadibot:_`;
    const footerText = `${botName} • Jadibot Control Hub`;
    const menuRows = [{
      title: "🔑 Tautkan via Pairing Code",
      description: "Dapatkan 8 digit kode pairing instan (Rekomendasi)",
      id: `${prefix}jadibot pair`
    }, {
      title: "📷 Tautkan via QR Code",
      description: "Tautkan via scanner QR Code kamera",
      id: `${prefix}jadibot qr`
    }, {
      title: "📋 Daftar Seluruh Sub-Bot",
      description: "Lihat status & rincian semua sub-bot aktif",
      id: `${prefix}listjadibot`
    }];
    if (myBot) {
      menuRows.unshift({
        title: "ℹ️ Rincian Sub-Bot Saya",
        description: `Lihat statistik & uptime bot kamu (+${senderNum})`,
        id: `${prefix}infojadibot ${senderNum}`
      });
      menuRows.push({
        title: "🛑 Hentikan Bot Saya",
        description: "Hapus sesi Jadibot dari nomor kamu",
        id: `${prefix}deljadibot ${senderNum}`
      });
    }
    const buttons = [{
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "🔘 Menu Utama Jadibot",
        sections: [{
          title: "Navigasi & Fitur Jadibot",
          rows: menuRows
        }]
      })
    }];
    const options = {
      title: "Jadibot Control Hub",
      subtitle: `Status: ${myBotStatus}`,
      image: bannerImg,
      params: {
        bottom_sheet: {
          in_thread_buttons_limit: 2,
          list_title: "Menu Utama Jadibot",
          button_title: "Buka Opsi Menu"
        }
      },
      quoted: msg
    };
    if (typeof ctx.sendCta === "function") {
      return await ctx.sendCta(bodyText, footerText, buttons, options);
    }
    return await ctx.reply(bodyText);
  }
};