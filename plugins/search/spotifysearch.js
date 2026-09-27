export default {
  name: "spotifysearch",
  aliases: ["spotify-search", "spsearch", "spotify"],
  description: "Mencari lagu di Spotify dengan tampilan Swipe Carousel",
  category: "Search",
  execute: async (sock, ctx, msg) => {
    if (!ctx.args.length) return ctx.reply("❌ Masukkan judul lagu.\nContoh: .spotify grayscale");
    try {
      const token = await getSpotifyToken();
      if (!token) return ctx.reply("❌ Gagal mengautentikasi ke Spotify API.");
      const res = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          q: ctx.query,
          type: "track",
          limit: 7,
          market: "US"
        }
      });
      const items = res.data?.tracks?.items || [];
      if (!items.length) return ctx.reply(`❌ Tidak ditemukan lagu untuk "${ctx.query}"`);
      const carousel = ctx.carousel();
      carousel.setBody(`🎧 HASIL SPOTIFY: "${ctx.query}"`);
      carousel.setFooter("Geser kartu ke samping untuk melihat lagu lainnya");
      for (let i = 0; i < items.length; i++) {
        const v = items[i];
        const artists = v.artists?.map(a => a.name).join(", ") || "Unknown";
        const duration = convertMs(v.duration_ms);
        const coverUrl = v.album?.images?.[0]?.url || "";
        const trackUrl = v.external_urls?.spotify || "";
        const card = carousel.createCard();
        card.setTitle("SPOTIFY SEARCH");
        card.setBody(`🎵 *${v.name}*\n\n` + `👤 *Artis:* ${artists}\n` + `💿 *Album:* ${v.album.name}\n` + `⏱ *Durasi:* ${duration}\n` + `📅 *Rilis:* ${v.album.release_date || "-"}`);
        card.setFooter(`Spotify Track #${i + 1}`);
        if (coverUrl) {
          const dl = await axios.get(coverUrl, {
            responseType: "arraybuffer"
          });
          card.setImage(Buffer.from(dl.data));
        }
        card.addReply("📥 Download Musik", `.spotifydl ${trackUrl}`);
        card.addCopy("Copy Link", trackUrl);
        card.addUrl("Buka di Spotify", trackUrl);
        card.addSelection("Opsi Pemutaran");
        card.makeSections(v.name, duration);
        card.makeRow("Audio", "🎵 Download Lagu", `Unduh audio MP3 dari ${v.name}`, `.spotifydl ${trackUrl}`);
        card.makeRow("Pencarian", "🔎 Cari Lagu Artis Ini", `Cari lagu lain dari ${artists}`, `.spotify ${artists}`);
      }
      await carousel.run(ctx.id, sock, simpleQuoted(ctx));
    } catch (error) {
      console.error(error);
      ctx.reply(`❌ Gagal mengambil data Spotify: ${error.message}`);
    }
  }
};