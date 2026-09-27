import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";
export default {
  name: "sonicmeme",
  aliases: ["sonic", "memesonic"],
  description: "Mengirim meme sonic random",
  category: "Random",
  execute: async (sock, ctx, msg) => {
    try {
      const n = Math.floor(Math.random() * 33) + 1;
      const url = `https://raw.githubusercontent.com/RullzFuqi/library/main/database/meme/sonic/sonic-${n}.jpg`;
      await sock.sendMessage(ctx.id, {
        image: {
          url: url
        },
        caption: "┏━━━〔 SONIC MEME 〕━━━┓\n┃         🌀🌀🌀         ┃\n┗━━━━━━━━━━━━━━━━━━━━┛"
      }, {
        quoted: simpleQuoted(ctx)
      });
    } catch (error) {
      ctx.reply(`❌ Gagal mengambil meme sonic: ${error.message}`);
    }
  }
};