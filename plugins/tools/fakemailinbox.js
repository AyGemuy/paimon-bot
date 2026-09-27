import axios from "axios";
import {
  exec
} from "child_process";
import fs from "fs";
import path from "path";
import {
  promisify
} from "util";
import {
  writeExifImg,
  writeExifVid
} from "../../lib/exif.js";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const execAsync = promisify(exec);
export default {
  name: "fakemailinbox",
  aliases: ["fakemail-inbox", "mailinbox"],
  description: "Cek inbox fake mail",
  category: "Tools",
  example: "mail_id",
  execute: async (sock, ctx, msg) => {
    try {
      if (!ctx.args.length) return ctx.reply("❌ Masukkan Mail ID.\nContoh: .fakemailinbox ID_MAIL");
      const res = await axios.get("https://api.vreden.my.id/api/v1/tools/fakemail/inbox", {
        params: {
          id: ctx.query
        }
      });
      const data = res.data;
      if (!data || data.status !== true) return ctx.reply("❌ Gagal mengambil inbox.");
      let mails = data.result.mails;
      if (!mails || mails.length === 0) return ctx.reply("📭 Inbox kosong. Belum ada email masuk.");
      let text = `┏━━━〔 FAKE MAIL INBOX 〕━━━┓\n\n`;
      mails.forEach((mail, i) => {
        text += `📨 *Email #${i + 1}*
From: ${mail.from || "-"}
Subject: ${mail.subject || "-"}
Date: ${mail.date || "-"}

`;
      });
      text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
      ctx.reply(text);
    } catch (error) {
      ctx.reply(`❌ Error: ${error.message}`);
    }
  }
};