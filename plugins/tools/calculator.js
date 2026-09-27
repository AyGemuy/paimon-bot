import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const API_URL = "https://www.wudysoft.my.id/api/tools/math";
export default {
  name: "math",
  aliases: ["calc", "kalkulator", "hitung", "solve"],
  description: "Kalkulator pintar via MathJS API metode POST dengan tombol salin hasil",
  category: "Tools",
  limit: false,
  example: "math 25 * 4 + sqrt(144) atau reply chat dengan .math",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx?.prefix || ".";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const botName = global.bot?.name || "WudysoftBot";
      const textFromArgs = (ctx?.query || ctx?.args?.join(" ") || "").trim();
      const textFromQuoted = (ctx?.quoted?.text || ctx?.quoted?.message?.conversation || ctx?.quoted?.message?.extendedTextMessage?.text || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text || "").trim();
      const input = textFromArgs || textFromQuoted;
      if (!input) {
        let helpText = `🧮 *KALKULATOR MATEMATIKA PINTAR*\n\n`;
        helpText += `Gunakan perintah ini untuk menghitung rumus secara instan lewat teks atau membalas pesan.\n\n`;
        helpText += `*Contoh Penggunaan Langsung:*\n`;
        helpText += `• Dasar: \`${prefix}math 25000 * 12 / 2\`\n`;
        helpText += `• Pangkat & Akar: \`${prefix}math 2^8 + sqrt(144)\`\n`;
        helpText += `• Trigonometri: \`${prefix}math sin(45 deg) + cos(45 deg)\`\n`;
        helpText += `• Konversi Satuan: \`${prefix}math 10 inch to cm\` atau \`${prefix}math 2 hours to minutes\`\n\n`;
        helpText += `*Contoh via Reply:*\n`;
        helpText += `• Balas pesan yang berisi rumus dengan mengetik \`${prefix}math\``;
        return ctx.reply(helpText);
      }
      await ctx.react("⏳");
      const cleanExpr = input.replace(/×/g, "*").replace(/÷/g, "/").trim();
      const {
        data
      } = await axios.post(API_URL, {
        expr: cleanExpr
      }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        timeout: 25e3
      });
      const result = data?.result !== undefined ? data.result : data;
      if (result === undefined || result === null) {
        await ctx.react("❌");
        return ctx.reply("❌ Tidak dapat menemukan hasil perhitungan dari ekspresi tersebut.");
      }
      const stringResult = String(result).trim();
      let output = `╭───『 🧮 *HASIL PERHITUNGAN* 』\n`;
      output += `│ 📝 *Soal:* \`${input}\`\n`;
      output += `│ 🎯 *Hasil:* *${stringResult}*\n`;
      output += `╰────────────────────────\n\n`;
      output += `_Ketuk tombol di bawah untuk menyalin hasil._`;
      const buttons = [{
        name: "cta_copy",
        display_text: "📄 Salin Hasil",
        copy_code: stringResult
      }];
      const options = {
        params: {
          bottom_sheet: {
            in_thread_buttons_limit: 1,
            divider_indices: [1],
            list_title: `${botName} • Math Result`,
            button_title: "Salin"
          }
        },
        contextInfo: {
          forwardingScore: 0,
          isForwarded: false
        },
        quoted: quotedMsg
      };
      if (typeof ctx?.sendCta === "function") {
        try {
          await ctx.sendCta(output, `${botName} • Math Calculator`, buttons, options);
          await ctx.react("✅");
          return;
        } catch (err) {
          console.error("[Math sendCta Error]:", err.message);
        }
      }
      try {
        await sock.sendMessage(ctx.id, {
          viewOnceMessage: {
            message: {
              interactiveMessage: {
                body: {
                  text: output
                },
                footer: {
                  text: `${botName} • Math Calculator`
                },
                nativeFlowMessage: {
                  buttons: [{
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                      display_text: "📄 Salin Hasil",
                      copy_code: stringResult
                    })
                  }]
                },
                contextInfo: options.contextInfo
              }
            }
          }
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      } catch (err) {}
      await sock.sendMessage(ctx.id, {
        text: `${output}\n\n*Hasil:* \`${stringResult}\``
      }, {
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      console.error("[MATH CALCULATOR ERROR]:", e);
      await ctx.react("❌");
      const errMsg = e.response?.data?.error || e.response?.data?.message || (typeof e.response?.data === "string" ? e.response.data : null) || e.message;
      ctx.reply(`❌ Perhitungan gagal: ${errMsg}`);
    }
  }
};