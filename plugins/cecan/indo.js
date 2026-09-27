import axios from "axios";
const handler = async (m, {
  conn: sock
}) => {
  const jid = m.chat || m.key?.remoteJid;
  if (!jid) return console.error("JID tidak ditemukan!");
  try {
    const {
      data
    } = await axios.get("https://pastebin.com/raw/j9Hrx7V4");
    const list = data.indonesia;
    const random = list[Math.floor(Math.random() * list.length)];
    await sock.sendMessage(jid, {
      image: {
        url: random
      },
      caption: "Cecan Indonesia"
    }, {
      quoted: m
    });
  } catch (e) {
    console.error(e);
    await sock.sendMessage(jid, {
      text: "Terjadi kesalahan saat mengambil gambar."
    }, {
      quoted: m
    });
  }
};
handler.help = ["indonesia", "indo"];
handler.command = /^(indonesia|indo)$/i;
handler.tags = ["cecan"];
handler.limit = true;
export default handler;