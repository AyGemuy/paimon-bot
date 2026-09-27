import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "calllink",
  aliases: ["buattelpon", "callroom", "videocalllink", "voicelink"],
  description: "Buat link tautan panggilan suara / video call resmi WhatsApp",
  category: "Tools",
  example: ".calllink video atau .calllink audio",
  execute: async (sock, ctx, msg) => {
    try {
      if (typeof sock.createCallLink !== "function") {
        return ctx.reply("❌ Method `sock.createCallLink` tidak didukung pada instance socket bot.");
      }
      await ctx.react("⏳");
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const rawType = (ctx.args?.[0] || "").toLowerCase();
      const mediaType = ["video", "vid", "vc"].includes(rawType) ? "video" : "audio";
      const isVideo = mediaType === "video";
      const token = await sock.createCallLink(mediaType);
      if (!token) {
        throw new Error("Gagal memperoleh token panggilan dari server WhatsApp.");
      }
      const callPath = isVideo ? "video" : "voice";
      const callUrl = `https://call.whatsapp.com/${callPath}/${token}`;
      const bodyText = `📞 *WHATSAPP CALL LINK CREATED*\n\n` + `Tautan ruang panggilan WhatsApp berhasil dibuat:\n\n` + `╭───『 *INFORMASI ROOM* 』\n` + `│ 📱 *Tipe Panggilan:* ${isVideo ? "📹 Video Call" : "🎙️ Voice Call (Suara)"}\n` + `│ 🔑 *Token Room:* \`${token}\`\n` + `│ 🔗 *Tautan Panggilan:* ${callUrl}\n` + `│ 👥 *Kapasitas:* Hingga 32 Peserta\n` + `╰──────────────────\n\n` + `_Ketuk tombol di bawah untuk langsung bergabung atau menyalin tautan panggilan._`;
      const footerText = `${botName} • Telephony Engine`;
      const buttons = [{
        name: "cta_url",
        display_text: isVideo ? "📹 Gabung Video Call" : "📞 Gabung Panggilan Suara",
        url: callUrl
      }, {
        name: "cta_copy",
        display_text: "📋 Salin Tautan Room",
        copy_code: callUrl
      }];
      const bannerMedia = global.bot?.media?.banner1 || global.bot?.media?.banner2 || "https://files.catbox.moe/g2e6i5.jpg";
      const options = {
        image: bannerMedia,
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 2,
            divider_indices: [1],
            list_title: `${botName} • Call Room`,
            button_title: "📞 Buka Menu"
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
      console.error("[CALLLINK ERROR]", e);
      await ctx.react("❌");
      ctx.reply(`❌ Gagal membuat tautan panggilan: ${e.message}`);
    }
  }
};