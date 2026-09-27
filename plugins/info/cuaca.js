import axios from "axios";
import {
  simpleQuoted
} from "../../lib/quoted.js";

function getAccuWeatherIconUrl(iconNum) {
  if (!iconNum) return null;
  return `https://developer.accuweather.com/sites/default/files/${String(iconNum).padStart(2, "0")}-s.png`;
}
export default {
  name: "cuaca",
  aliases: ["weather", "accuweather", "infocuaca"],
  description: "Informasi cuaca realtime, hourly, daily, & indeks AccuWeather",
  category: "Info",
  execute: async (sock, ctx, msg) => {
    const rawText = (ctx.args || []).join(" ").trim();
    const prefix = ctx.prefix || ".";
    const quotedMsg = typeof simpleQuoted === "function" ? simpleQuoted(ctx) : msg;
    const isHourly = /--hourly|--jam/i.test(rawText);
    const isDaily = /--daily|--harian|--forecast/i.test(rawText);
    const isIndex = /--index|--aktivitas|--kesehatan/i.test(rawText);
    const cityQuery = rawText.replace(/--(hourly|jam|daily|harian|forecast|index|aktivitas|kesehatan)/gi, "").trim();
    if (!cityQuery) return ctx.reply(`🌤️ Masukkan nama kota!\nContoh: \`${prefix}cuaca Bandung\``);
    try {
      await ctx.react("⏳");
      const res = await axios.post("https://wudysoft.my.id/api/info/cuaca/accuweather", {
        query: cityQuery
      });
      const data = res.data;
      if (!data?.location || !data.current?.length) {
        await ctx.react("❌");
        return ctx.reply(`❌ Kota *${cityQuery}* tidak ditemukan.`);
      }
      const loc = data.location;
      const curr = data.current[0];
      const today = data.daily?.daily_forecasts?.[0] || {};
      const cityName = `${loc.localized_name}, ${loc.administrative_area?.localized_name || ""}`;
      const iconUrl = getAccuWeatherIconUrl(curr.weather_icon || today.day?.icon);
      if (isHourly) {
        let text = `⏱️ *PRAKIRAAN PER JAM (${cityName})*\n\n`;
        (data.hourly || []).slice(0, 8).forEach(h => {
          text += `🕒 *${h.date_time?.slice(11, 16) || "-"} WIB* : ${h.temperature?.value}°C (${h.icon_phrase}) | 🌧️ ${h.precipitation_probability}%\n`;
        });
        await sock.sendMessage(ctx.id, {
          text: text
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (isDaily) {
        let text = `📅 *PRAKIRAAN 5 HARI (${cityName})*\n\n`;
        (data.daily?.daily_forecasts || []).slice(0, 5).forEach(d => {
          text += `📆 *${d.date?.slice(0, 10)}* : 🔻${d.temperature?.minimum?.value}°C ~ 🔺${d.temperature?.maximum?.value}°C (${d.day?.short_phrase || "-"})\n`;
        });
        await sock.sendMessage(ctx.id, {
          text: text
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      if (isIndex) {
        let text = `🏃 *INDEKS KESEHATAN & AKTIVITAS (${cityName})*\n\n`;
        (data.indices || []).slice(0, 8).forEach(item => {
          text += `• *${item.name}:* ${item.category} (${item.text})\n\n`;
        });
        await sock.sendMessage(ctx.id, {
          text: text.trim()
        }, {
          quoted: quotedMsg
        });
        await ctx.react("✅");
        return;
      }
      const bodyText = `📍 *CUACA SAAT INI: ${cityName.toUpperCase()}*\n\n` + `╭───『 *KONDISI REALTIME* 』\n` + `│ 🌤️ *Kondisi:* ${curr.weather_text || "-"}\n` + `│ 🌡️ *Suhu:* ${curr.temperature?.metric?.value}°C (Terasa: ${curr.real_feel_temperature?.metric?.value}°C)\n` + `│ 💧 *Kelembapan:* ${curr.relative_humidity}%\n` + `│ 💨 *Angin:* ${curr.wind?.speed?.metric?.value} km/jam\n` + `│ ☀️ *UV Index:* ${curr.u_v_index} (${curr.u_v_index_text || "-"})\n` + `╰──────────────────\n\n` + `⏱️ *MinuteCast:* ${data.minute_cast?.summary?.phrase || "Tidak ada data presipitasi"}`;
      const actionRows = [{
        title: "⏱️ Prakiraan Per Jam",
        id: `${prefix}cuaca ${cityQuery} --hourly`,
        description: "Prakiraan jam berikutnya"
      }, {
        title: "📅 Prakiraan 5 Hari",
        id: `${prefix}cuaca ${cityQuery} --daily`,
        description: "Prakiraan 5 hari ke depan"
      }, {
        title: "🏃 Indeks Aktivitas",
        id: `${prefix}cuaca ${cityQuery} --index`,
        description: "Indeks UV, Kesehatan & Olahraga"
      }];
      const buttons = [{
        title: "📊 PILIH DETAIL PRAKIRAAN",
        sections: [{
          title: `Menu Cuaca (${loc.localized_name})`,
          rows: actionRows
        }]
      }];
      if (curr.link) buttons.push({
        text: "🌐 Buka di AccuWeather",
        url: curr.link
      });
      await ctx.sendCta(bodyText, `${global.bot?.name || "WudysoftBot"} • AccuWeather`, buttons, {
        title: "乂 ACCUWEATHER REPORT 乂",
        media: iconUrl,
        quoted: quotedMsg
      });
      await ctx.react("✅");
    } catch (e) {
      await ctx.react("❌");
      ctx.reply(`❌ Error: ${e.message}`);
    }
  }
};