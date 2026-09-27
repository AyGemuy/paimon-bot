import axios from "axios";
import path from "path";
import {
  simpleQuoted
} from "../../lib/quoted.js";
const http = axios.create({
  maxRedirects: 10,
  validateStatus: () => true
});

function parseCli(rawText) {
  const tokens = rawText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(t => t.replace(/^["']|["']$/g, "")) || [];
  let method = "GET";
  let url = null;
  const headers = {};
  const params = {};
  let data = undefined;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.toLowerCase();
    if (/^--(get|post|put|delete|patch|head|options)$/i.test(token)) {
      method = token.replace(/^--/i, "").toUpperCase();
    } else if (["-x", "--method"].includes(lower) && tokens[i + 1]) {
      method = tokens[++i].toUpperCase();
    } else if (["-h", "--header", "--headers"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        Object.assign(headers, JSON.parse(val));
      } catch {
        const [k, ...v] = val.split(":");
        if (k) headers[k.trim()] = v.join(":").trim();
      }
    } else if (["-p", "--params", "--query"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        Object.assign(params, JSON.parse(val));
      } catch {
        new URLSearchParams(val).forEach((v, k) => params[k] = v);
      }
    } else if (["-d", "--data", "--body", "-b"].includes(lower) && tokens[i + 1]) {
      const val = tokens[++i];
      try {
        data = JSON.parse(val);
      } catch {
        data = val;
      }
    } else if (/^https?:\/\//i.test(token)) {
      url = token;
    }
  }
  return {
    method: method,
    url: url,
    headers: headers,
    params: params,
    data: data
  };
}
export default {
  name: "axiosget",
  aliases: ["get", "fetch", "curl", "fetchget"],
  description: "HTTP Client gaya CLI (Mendukung GET, POST, Header, Params, Body & Media)",
  category: "Tools",
  example: ".get --POST https://api.com -H 'Auth: 123' -d '{\"key\":\"val\"}'",
  execute: async (sock, ctx, msg) => {
    const rawInput = (ctx.query || "").trim();
    const cli = parseCli(rawInput);
    const url = cli.url || ctx.quoted?.text?.match(/https?:\/\/[^\s]+/i)?.[0];
    if (!url) {
      return ctx.reply(`📌 *Format Penggunaan CLI:*\n` + `• \`.get <url>\`\n` + `• \`.get --POST <url> --body {"key":"val"}\`\n` + `• \`.get <url> -H "Authorization: Bearer xyz" -p "page=1"\`\n` + `• \`.get -X PUT <url> -d "text raw"\`\n` + `• _Atau reply pesan yang memiliki link._`);
    }
    try {
      await ctx.react("⏳");
      const res = await http({
        method: cli.method,
        url: url,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "*/*",
          ...cli.headers
        },
        params: cli.params,
        data: cli.data,
        responseType: "arraybuffer"
      });
      const buffer = Buffer.from(res.data);
      const contentType = String(res.headers["content-type"] || "application/octet-stream").toLowerCase();
      const [mainType, subType = ""] = contentType.split(";")[0].trim().split("/");
      let textContent = null;
      try {
        const rawStr = buffer.toString("utf-8");
        if (contentType.includes("json") || /^[\{\[]/.test(rawStr.trim())) {
          textContent = JSON.stringify(JSON.parse(rawStr), null, 2);
        } else if (mainType === "text" || /html|xml|javascript|csv/.test(subType)) {
          textContent = rawStr;
        }
      } catch {}
      let messagePayload;
      if (textContent) {
        messagePayload = textContent.length > 8e3 ? {
          document: Buffer.from(textContent, "utf-8"),
          mimetype: contentType.includes("json") ? "application/json" : "text/plain",
          fileName: `response.${contentType.includes("json") ? "json" : "txt"}`,
          caption: `📄 *[${cli.method}] ${res.status} ${res.statusText}* (${(textContent.length / 1024).toFixed(2)} KB)`
        } : {
          text: textContent
        };
      } else {
        const mediaMap = {
          "image/webp": {
            sticker: buffer
          },
          image: {
            image: buffer,
            caption: `🖼️ *[${cli.method}] ${res.status}*`
          },
          video: {
            video: buffer,
            caption: `🎥 *[${cli.method}] ${res.status}*`
          },
          audio: {
            audio: buffer,
            mimetype: contentType
          }
        };
        const defaultFileName = res.headers["content-disposition"]?.match(/filename=["']?([^"';]+)["']?/i)?.[1] || path.basename(new URL(url).pathname) || "downloaded_file";
        messagePayload = mediaMap[`${mainType}/${subType}`] || mediaMap[mainType] || {
          document: buffer,
          mimetype: contentType,
          fileName: defaultFileName,
          caption: `📦 *File*: ${defaultFileName}\n*Status*: ${res.status} ${res.statusText}`
        };
      }
      await sock.sendMessage(ctx.id, messagePayload, {
        quoted: simpleQuoted(ctx)
      });
      await ctx.react("✅");
    } catch (error) {
      console.error("[CLI Axios Error]:", error?.message || error);
      await ctx.react("❌");
      ctx.reply(`❌ *HTTP Error:* ${error?.message || error}`);
    }
  }
};