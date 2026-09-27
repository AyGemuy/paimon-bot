import {
  simpleQuoted
} from "../../lib/quoted.js";

function serializePureRawToJs(obj, indent = 2) {
  if (!obj || typeof obj !== "object") return String(obj);
  const bufferTokens = [];
  const json = JSON.stringify(obj, (key, value) => {
    if (typeof value === "bigint") return Number(value);
    if (value && typeof value === "object" && value.constructor?.name === "Long") {
      return value.toNumber?.() ?? value.low ?? 0;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array || value && value.type === "Buffer" && Array.isArray(value.data)) {
      const buf = Buffer.isBuffer(value) ? value : Buffer.from(value.data || value);
      const b64 = buf.toString("base64");
      const token = `__PURE_BUF_${bufferTokens.length}__`;
      bufferTokens.push(`Buffer.from("${b64}", "base64")`);
      return token;
    }
    if (typeof value === "string" && value.length > 50 && (key.toLowerCase().includes("thumb") || key.toLowerCase().includes("media") || key === "jpegThumbnail")) {
      const cleanB64 = value.replace(/^data:image\/[a-z]+;base64,/, "").trim();
      if (/^[A-Za-z0-9+/=]+$/.test(cleanB64)) {
        const token = `__PURE_BUF_${bufferTokens.length}__`;
        bufferTokens.push(`Buffer.from("${cleanB64}", "base64")`);
        return token;
      }
    }
    if (typeof value === "undefined") return undefined;
    return value;
  }, indent);
  let outputJs = json;
  bufferTokens.forEach((code, idx) => {
    outputJs = outputJs.replace(`"__PURE_BUF_${idx}__"`, code);
  });
  return outputJs;
}
export default {
  name: "crm",
  aliases: ["extractmsg", "relayextract", "msgrelay", "compilemsg"],
  description: "Ekstrak 100% full real struktur pesan asli murni ke format sock.relayMessage",
  category: "Tools",
  execute: async (sock, ctx, msg) => {
    try {
      const prefix = ctx.prefix || ".";
      const botName = global.bot?.name || "WudysoftBot";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) || msg : msg;
      const chatId = ctx.chat || ctx.id;
      if (!ctx.quoted) {
        await ctx.react?.("❓");
        const helpBody = `╭───『 *PURE RAW CRM EXTRACTOR* 』\n` + `│ Mengekstrak struktur *100% asli murni* dari pesan\n` + `│ WhatsApp tanpa konversi untuk *sock.relayMessage()*.\n` + `╰──────────────────────────\n\n` + `*乂 PANDUAN PENGGUNAAN:*\n` + `Reply pesan yang ingin diekstrak lalu ketik:\n\n` + `├─ 📄 \`${prefix}crm\`\n` + `│  _Kirim file dokumen script .js murni_\n` + `├─ 💻 \`${prefix}crm --snippet\` (atau \`-s\`)\n` + `│  _Kirim cuplikan kode langsung di chat_\n` + `└─ 📋 \`${prefix}crm --copy\` (atau \`-c\`)\n` + `   _Kirim button CTA untuk salin kode_`;
        const helpButtons = [{
          name: "cta_copy",
          display_text: "📋 Salin Format .crm",
          copy_code: `${prefix}crm`
        }, {
          name: "single_select",
          title: "⚡ PILIHAN EKSTRAKSI",
          sections: [{
            title: `${botName} • Opsi Ekstraksi`,
            rows: [{
              title: "📄 Ekstrak File .js (Pure Real)",
              description: "Struktur asli murni tanpa modifikasi",
              id: `${prefix}crm`
            }, {
              title: "💻 Ekstrak Code Snippet",
              description: "Tampilkan cuplikan kode langsung di chat",
              id: `${prefix}crm --snippet`
            }, {
              title: "📋 Ekstrak Button Copy",
              description: "Salin kode relay langsung ke clipboard",
              id: `${prefix}crm --copy`
            }]
          }]
        }];
        return await ctx.sendCta(helpBody, `${botName} • CRM Tools`, helpButtons, {
          params: {
            bottom_sheet: {
              in_thread_buttons_limit: 1,
              divider_indices: [1],
              list_title: `${botName} • Panduan CRM`,
              button_title: "⚡ Buka Panduan"
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
        });
      }
      await ctx.react?.("⏳");
      const q = await ctx.getQuotedObj?.() || ctx.quoted;
      const rawTargetMessage = q?.rawMessage || q?.message || q?.fakeObj?.message || ctx.quoted?.rawMessage || ctx.quoted?.message;
      if (!rawTargetMessage) {
        await ctx.react?.("❌");
        return ctx.reply("❌ Gagal membaca struktur pesan yang di-reply.");
      }
      const formattedJson = serializePureRawToJs(rawTargetMessage, 2);
      const relayCode = `await sock.relayMessage(\n` + `  ctx.id,\n` + `  ${formattedJson},\n` + `  {}\n` + `);`;
      const argsText = (ctx.query || ctx.args?.join(" ") || "").toLowerCase();
      const isSnippet = argsText.includes("--snippet") || argsText.includes("-s");
      const isCopy = argsText.includes("--copy") || argsText.includes("-c");
      if (isSnippet) {
        if (typeof ctx.aiRich === "function") {
          const ai = ctx.aiRich();
          ai.setBody("📦 *CRM EXTRACTOR: PURE RAW MESSAGE*");
          ai.addCode("javascript", relayCode);
          ai.setFooter("Struktur 100% asli murni tanpa konversi.");
          await ai.send(chatId, {
            quoted: quotedMsg
          });
        } else if (typeof ctx.sendCode === "function") {
          await ctx.sendCode(relayCode, "javascript", {
            disclaimerText: "CRM PURE RAW CODE",
            textBefore: "📦 *CRM EXTRACTOR: PURE RAW MESSAGE*",
            textAfter: "\n_Struktur 100% murni tanpa modifikasi._",
            quoted: quotedMsg
          });
        } else {
          await ctx.reply("```javascript\n" + relayCode + "\n```", {
            quoted: quotedMsg
          });
        }
        return await ctx.react?.("✅");
      }
      if (isCopy) {
        const copyBody = `╭───『 *PURE RAW RELAY CODE* 』\n` + `│ 📦 *Tipe Pesan:* \`${q?.mtype || q?.msgType || Object.keys(rawTargetMessage)[0] || "Protobuf"}\`\n` + `│ 📝 *Ukuran:* ${relayCode.length.toLocaleString()} karakter\n` + `╰──────────────────────────\n\n` + `Klik tombol di bawah untuk menyalin kode relay murni ke clipboard.`;
        const ctaButtons = [{
          name: "cta_copy",
          display_text: "📋 Salin Kode Relay",
          copy_code: relayCode
        }];
        await ctx.sendCta(copyBody, `${botName} • Baileys Relay Message`, ctaButtons, {
          title: "乂 PURE RAW RELAY CODE 乂",
          quoted: quotedMsg
        });
        return await ctx.react?.("✅");
      }
      const fileBuffer = Buffer.from(relayCode, "utf-8");
      const idShort = (q?.id || Date.now().toString(36)).slice(-8);
      const fileName = `crm_raw_${idShort}.js`;
      const captionText = `📦 *CRM PURE RAW EXTRACTED*\n\n` + `├─ 🏷️ *Tipe:* \`${q?.mtype || q?.msgType || Object.keys(rawTargetMessage)[0] || "Protobuf"}\`\n` + `├─ 📁 *File:* \`${fileName}\`\n` + `└─ 📊 *Size:* \`${(fileBuffer.length / 1024).toFixed(2)} KB\`\n\n` + `_Struktur 100% murni sesuai payload asli tanpa konversi apapun._`;
      await sock.sendMessage(chatId, {
        document: fileBuffer,
        mimetype: "application/javascript",
        fileName: fileName,
        caption: captionText
      }, {
        quoted: quotedMsg
      });
      return await ctx.react?.("✅");
    } catch (e) {
      console.error("[CRM Error]:", e);
      await ctx.react?.("❌");
      return ctx.reply(`❌ *Gagal mengekstrak pesan:* ${e.message}`);
    }
  }
};