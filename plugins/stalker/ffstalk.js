import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function formatDate(timestamp) {
  if (!timestamp || isNaN(timestamp)) return "-";
  try {
    const num = Number(timestamp);
    const date = new Date(num > 1e11 ? num : num * 1e3);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " WIB";
  } catch {
    return "-";
  }
}

function formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Number(num).toLocaleString("id-ID");
}
export default {
  name: "stalkff",
  aliases: ["ffstalk", "epep", "stalkfreefire", "ffinfo"],
  description: "Melihat detail informasi dan statistik akun Free Fire berdasarkan UID",
  category: "Stalker",
  limit: false,
  example: "stalkff 12345678",
  execute: async (sock, ctx, msg) => {
    try {
      const text = ctx.args?.join(" ")?.trim() || ctx.text?.trim() || "";
      const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
      const uidMatch = text.match(/\b\d{6,12}\b/);
      const uid = uidMatch ? uidMatch[0] : null;
      if (!uid) {
        return ctx.reply(`⚠️ *Format Salah!*\n\n` + `Silakan masukkan UID Free Fire yang valid.\n` + `👉 *Contoh:* \`${ctx.prefix || "."}stalkff 12345678\``);
      }
      await ctx.react("🔍");
      const apiUrl = `https://www.wudysoft.my.id/api/stalker/free-fire/v4?uid=${encodeURIComponent(uid)}`;
      const {
        data: res
      } = await axios.get(apiUrl, {
        timeout: 15e3
      });
      if (!res || !res.status || !res.result) {
        await ctx.react("❌");
        return ctx.reply(`❌ Akun Free Fire dengan UID *${uid}* tidak ditemukan atau server sedang gangguan.`);
      }
      const {
        basic_info = {},
          clan_basic_info = {},
          pet_info = {},
          credit_score_info = {},
          social_info = {},
          diamond_cost_res = {},
          verified = false
      } = res.result;
      const nickname = basic_info.nickname || "Unknown";
      const level = basic_info.level || "-";
      const exp = formatNumber(basic_info.exp);
      const likes = formatNumber(basic_info.liked);
      const region = basic_info.region || "-";
      const version = basic_info.release_version || "-";
      const season = basic_info.season_id || "-";
      const badges = formatNumber(basic_info.badge_cnt);
      const elitePass = basic_info.has_elite_pass ? "Aktif / Memiliki EP ✅" : "Tidak Ada ❌";
      const brRank = basic_info.rank || "-";
      const brPoints = formatNumber(basic_info.ranking_points);
      const brMaxRank = basic_info.max_rank || "-";
      const csRank = basic_info.cs_rank || "-";
      const csPoints = formatNumber(basic_info.cs_ranking_points);
      const csMaxRank = basic_info.cs_max_rank || "-";
      const createdAt = formatDate(basic_info.create_at);
      const lastLogin = formatDate(basic_info.last_login_at);
      const creditScore = credit_score_info.score ?? "-";
      const diamondCost = formatNumber(diamond_cost_res.diamond_cost);
      const hasClan = Boolean(clan_basic_info.clan_name);
      const clanName = clan_basic_info.clan_name || "Tidak ada Guild";
      const clanId = clan_basic_info.clan_id || "-";
      const clanLevel = clan_basic_info.clan_level || "-";
      const clanMembers = `${clan_basic_info.current_members || 0}/${clan_basic_info.max_members || 0}`;
      const hasPet = Boolean(pet_info.pet_name);
      const petName = pet_info.pet_name || "Tidak ada Pet";
      const petLevel = pet_info.level || "-";
      const petExp = formatNumber(pet_info.exp);
      const bio = (social_info.social_highlight || "-").trim();
      const language = (social_info.language || "-").replace("LANGUAGE_", "");
      let output = `🔥 *FREE FIRE PLAYER PROFILE* 🔥\n\n`;
      output += `👤 *INFORMASI UTAMA*\n`;
      output += `• *Nickname:* ${nickname} ${verified ? "☑️ (Verified)" : ""}\n`;
      output += `• *UID:* \`${basic_info.account_id || uid}\`\n`;
      output += `• *Level:* ${level} (EXP: ${exp})\n`;
      output += `• *Likes:* 👍 ${likes}\n`;
      output += `• *Region:* ${region} | *Ver:* ${version}\n`;
      output += `• *Badge Season (${season}):* 🎖️ ${badges}\n`;
      output += `• *Elite Pass:* ${elitePass}\n\n`;
      output += `🏆 *STATISTIK RANK*\n`;
      output += `• *BR Rank:* Point ${brPoints} (Rank: ${brRank} | Max: ${brMaxRank})\n`;
      output += `• *CS Rank:* Point ${csPoints} (Rank: ${csRank} | Max: ${csMaxRank})\n\n`;
      output += `🛡️ *GUILD / CLAN*\n`;
      if (hasClan) {
        output += `• *Nama Guild:* ${clanName}\n`;
        output += `• *ID Guild:* \`${clanId}\`\n`;
        output += `• *Level Guild:* ${clanLevel}\n`;
        output += `• *Anggota:* ${clanMembers} Member\n\n`;
      } else {
        output += `• _Pemain belum bergabung dengan Guild._\n\n`;
      }
      output += `🐾 *PET DATA*\n`;
      if (hasPet) {
        output += `• *Nama Pet:* ${petName}\n`;
        output += `• *Level Pet:* ${petLevel} (EXP: ${petExp})\n\n`;
      } else {
        output += `• _Tidak membawa Pet._\n\n`;
      }
      output += `📝 *LAINNYA & AKTIVITAS*\n`;
      output += `• *Bio/Sign:* ${bio}\n`;
      output += `• *Bahasa:* ${language}\n`;
      output += `• *Skor Kredit:* 💯 ${creditScore}/100\n`;
      output += `• *Pengeluaran Diamond:* 💎 ${diamondCost}\n`;
      output += `• *Dibuat Pada:* 📅 ${createdAt}\n`;
      output += `• *Login Terakhir:* ⏱️ ${lastLogin}\n`;
      await ctx.react("✅");
      return await ctx.reply(output, {
        quoted: quotedMsg
      });
    } catch (error) {
      await ctx.react("❌");
      return ctx.reply(`❌ Terjadi kesalahan saat stalk FF: ${error?.message || error}`);
    }
  }
};