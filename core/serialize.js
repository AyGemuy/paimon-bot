import * as Baileys from "@whiskeysockets/baileys";
import {
  Boom
} from "@hapi/boom";
import crypto from "crypto";
import axios from "axios";
import chalk from "chalk";
import {
  createRequire
} from "module";
const require = createRequire(import.meta.url);
const jimpPkg = require("jimp");
const Jimp = jimpPkg.Jimp || jimpPkg.default || jimpPkg;
const {
  prepareWAMessageMedia,
  generateWAMessage,
  generateWAMessageFromContent,
  generateForwardMessageContent,
  proto,
  tokenizeCode,
  normalizeMessageContent,
  getContentType,
  areJidsSameUser,
  jidDecode,
  isJidGroup,
  jidNormalizedUser
} = Baileys;
const WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
global.lidPhoneCache = global.lidPhoneCache || new Map();
global.msgStore = global.msgStore || new Map();
export function decodeJid(jid = "") {
  if (!jid || typeof jid !== "string") return "";
  if (/:\d+@/gi.test(jid)) {
    const decode = jidDecode(jid) || {};
    return decode.user && decode.server && `${decode.user}@${decode.server}` || jid;
  }
  return jid;
}
export const cleanId = id => id ? id.split("@")[0].split(":")[0] + "@" + (id.split("@")[1] || "s.whatsapp.net") : "";
export const extractNum = id => id ? String(id).split("@")[0].split(":")[0].replace(/\D/g, "") : "";
export async function resolveLidToJid(targetJid = "", sock = null, altJid = null, groupParticipants = []) {
  if (!targetJid && !altJid) return "";
  const rawTarget = String(targetJid || "").trim();
  const rawAlt = String(altJid || "").trim();
  if (rawAlt && !rawAlt.endsWith("@lid") && (rawAlt.endsWith("@s.whatsapp.net") || /^\d{6,}$/.test(rawAlt))) {
    const res = decodeJid(rawAlt.endsWith("@s.whatsapp.net") ? rawAlt : `${rawAlt}@s.whatsapp.net`);
    if (rawTarget.endsWith("@lid")) global.lidPhoneCache.set(rawTarget, res);
    return res;
  }
  const cleanTarget = decodeJid(rawTarget);
  if (!cleanTarget.endsWith("@lid")) return cleanTarget;
  if (global.lidPhoneCache.has(cleanTarget)) return global.lidPhoneCache.get(cleanTarget);
  if (sock?.user) {
    const botId = decodeJid(sock.user.id || sock.user.jid || "");
    const botLid = sock.user.lid ? decodeJid(sock.user.lid) : null;
    if (botLid && cleanTarget === botLid) {
      global.lidPhoneCache.set(cleanTarget, botId);
      return botId;
    }
  }
  try {
    const lidMapping = sock?.signalRepository?.lidMapping;
    if (lidMapping && typeof lidMapping.getPNForLID === "function") {
      const pn = await lidMapping.getPNForLID(cleanTarget);
      if (pn && typeof pn === "string") {
        const res = decodeJid(pn.endsWith("@s.whatsapp.net") ? pn : `${pn}@s.whatsapp.net`);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
    }
  } catch {}
  if (Array.isArray(groupParticipants) && groupParticipants.length > 0) {
    const found = groupParticipants.find(p => decodeJid(p?.lid) === cleanTarget || decodeJid(p?.id) === cleanTarget);
    if (found) {
      if (found.phoneNumber) {
        const num = String(found.phoneNumber).replace(/\D/g, "");
        if (num.length >= 6) {
          const res = `${num}@s.whatsapp.net`;
          global.lidPhoneCache.set(cleanTarget, res);
          return res;
        }
      }
      if (found.id && !found.id.endsWith("@lid")) {
        const res = decodeJid(found.id);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
      if (found.jid && !found.jid.endsWith("@lid")) {
        const res = decodeJid(found.jid);
        global.lidPhoneCache.set(cleanTarget, res);
        return res;
      }
    }
  }
  const allGroups = sock?.chats || sock?.store?.chats || sock?.store?.groupMetadata || {};
  for (const group of Object.values(allGroups)) {
    const ptcps = group?.participants || group?.groupMetadata?.participants || [];
    if (!Array.isArray(ptcps)) continue;
    for (const p of ptcps) {
      if (decodeJid(p?.lid) === cleanTarget || decodeJid(p?.id) === cleanTarget) {
        if (p.phoneNumber) {
          const num = String(p.phoneNumber).replace(/\D/g, "");
          if (num.length >= 6) {
            const res = `${num}@s.whatsapp.net`;
            global.lidPhoneCache.set(cleanTarget, res);
            return res;
          }
        }
        if (p.id && !p.id.endsWith("@lid")) {
          const res = decodeJid(p.id);
          global.lidPhoneCache.set(cleanTarget, res);
          return res;
        }
      }
    }
  }
  const contacts = sock?.contacts || sock?.store?.contacts || {};
  for (const [jid, contact] of Object.entries(contacts)) {
    if (contact?.lid && decodeJid(contact.lid) === cleanTarget && jid.endsWith("@s.whatsapp.net")) {
      const res = decodeJid(jid);
      global.lidPhoneCache.set(cleanTarget, res);
      return res;
    }
    if (contact?.id && decodeJid(contact.id) === cleanTarget && contact?.phoneJid) {
      const res = decodeJid(contact.phoneJid);
      global.lidPhoneCache.set(cleanTarget, res);
      return res;
    }
  }
  const dbUsers = global.db?.user || {};
  for (const [dbJid, u] of Object.entries(dbUsers)) {
    if (dbJid.endsWith("@s.whatsapp.net") && (u?.lid === cleanTarget || u?.userLid === cleanTarget)) {
      global.lidPhoneCache.set(cleanTarget, dbJid);
      return dbJid;
    }
  }
  return cleanTarget;
}
export function lidToJid(targetJid = "", sock = null, altJid = null, groupParticipants = []) {
  if (!targetJid && !altJid) return "";
  const rawTarget = String(targetJid || "").trim();
  const rawAlt = String(altJid || "").trim();
  if (rawAlt && !rawAlt.endsWith("@lid") && (rawAlt.endsWith("@s.whatsapp.net") || /^\d{6,}$/.test(rawAlt))) {
    return decodeJid(rawAlt.endsWith("@s.whatsapp.net") ? rawAlt : `${rawAlt}@s.whatsapp.net`);
  }
  const cleanTarget = decodeJid(rawTarget);
  if (!cleanTarget.endsWith("@lid")) return cleanTarget;
  if (global.lidPhoneCache?.has(cleanTarget)) return global.lidPhoneCache.get(cleanTarget);
  return cleanTarget;
}
export async function resizeImage(input, width = 600, height = 300, mime = "image/jpeg") {
  if (!input) return null;
  let buffer = null;
  try {
    if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof Uint8Array) {
      buffer = Buffer.from(input);
    } else if (typeof input === "string") {
      const cleanInput = input.trim();
      if (/^https?:\/\//i.test(cleanInput)) {
        const res = await axios.get(cleanInput, {
          responseType: "arraybuffer",
          timeout: 3e4,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        buffer = Buffer.from(res.data);
      } else if (cleanInput.startsWith("data:") || cleanInput.length > 100) {
        buffer = Buffer.from(cleanInput.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
      }
    }
    if (!buffer || !Buffer.isBuffer(buffer)) return null;
    let image = null;
    if (typeof Jimp?.read === "function") {
      image = await Jimp.read(buffer);
    } else if (typeof Jimp === "function") {
      image = await Jimp(buffer);
    }
    if (image) {
      try {
        if (typeof image.resize === "function") {
          if (image.resize.length >= 2) {
            image.resize(width, height);
          } else {
            image.resize({
              w: width,
              h: height
            });
          }
        }
      } catch {
        try {
          image.resize(width, height);
        } catch {}
      }
      const targetMime = mime === "image/png" ? Jimp.MIME_PNG || "image/png" : Jimp.MIME_JPEG || "image/jpeg";
      if (typeof image.getBufferAsync === "function") {
        return await image.getBufferAsync(targetMime);
      }
      if (typeof image.getBuffer === "function") {
        const res = image.getBuffer(targetMime);
        if (res instanceof Promise) return await res;
        return await new Promise((resolve, reject) => {
          image.getBuffer(targetMime, (err, buf) => err ? reject(err) : resolve(buf));
        });
      }
    }
  } catch (err) {
    console.error(chalk.yellow("[Resize Thumbnail Warning]"), err?.message || err);
  }
  return buffer;
}
export async function processThumbnails(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 10) return obj;
  const ensureCompressed = async target => {
    if (!target) return null;
    if (Buffer.isBuffer(target) && target._isResized) return target;
    const res = await resizeImage(target, 300, 150, "image/jpeg");
    if (res && Buffer.isBuffer(res)) {
      res._isResized = true;
      return res;
    }
    return res;
  };
  if (obj.externalAdReply) {
    const ad = obj.externalAdReply;
    const targetThumb = ad.jpegThumbnail || ad.thumbnail || ad.thumbnailUrl || ad.image;
    if (targetThumb) {
      const resized = await ensureCompressed(targetThumb);
      if (resized) {
        ad.jpegThumbnail = resized;
        ad.thumbnail = resized;
        delete ad.thumbnailUrl;
        delete ad.image;
      }
    }
  }
  if (obj.locationMessage || obj.degreesLatitude !== undefined && obj.degreesLongitude !== undefined) {
    const loc = obj.locationMessage || obj;
    const targetThumb = loc.jpegThumbnail || loc.thumbnail || loc.image || loc.thumb || loc.thumbnailUrl;
    if (targetThumb) {
      const resized = await ensureCompressed(targetThumb);
      if (resized) {
        loc.jpegThumbnail = resized;
        delete loc.thumbnail;
        delete loc.image;
        delete loc.thumb;
        delete loc.thumbnailUrl;
      }
    }
  }
  const mediaKeys = ["documentMessage", "videoMessage", "audioMessage", "imageMessage"];
  for (const mk of mediaKeys) {
    if (obj[mk]) {
      const target = obj[mk].jpegThumbnail || obj[mk].thumbnail;
      if (target) {
        const resized = await ensureCompressed(target);
        if (resized) {
          obj[mk].jpegThumbnail = resized;
          delete obj[mk].thumbnail;
        }
      }
    }
  }
  if (obj.jpegThumbnail) {
    obj.jpegThumbnail = await ensureCompressed(obj.jpegThumbnail);
  }
  if (obj.thumbnail) {
    const resized = await ensureCompressed(obj.thumbnail);
    if (resized) {
      obj.jpegThumbnail = resized;
      delete obj.thumbnail;
    }
  }
  if (Array.isArray(obj.cards)) {
    for (const card of obj.cards) {
      await processThumbnails(card, depth + 1);
    }
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null && !Buffer.isBuffer(obj[key])) {
      await processThumbnails(obj[key], depth + 1);
    }
  }
  return obj;
}
export async function safeRelayInteractive(sock, jid, message, options = {}, retries = 2) {
  const targetJid = decodeJid(jid);
  try {
    const messageId = options.messageId || "3EB0" + crypto.randomBytes(8).toString("hex").toUpperCase();
    return await sock.relayMessage(targetJid, message, {
      messageId: messageId,
      additionalNodes: [{
        tag: "biz",
        attrs: {},
        content: [{
          tag: "interactive",
          attrs: {
            type: "native_flow",
            v: "1"
          },
          content: [{
            tag: "native_flow",
            attrs: {
              v: "9",
              name: "mixed"
            }
          }]
        }]
      }],
      ...options
    });
  } catch (err) {
    const errorMsg = String(err?.message || "").toLowerCase();
    const statusCode = err?.output?.statusCode || err?.status;
    if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || errorMsg.includes("closed") || errorMsg.includes("precondition"))) {
      await sleep(1200);
      return await safeRelayInteractive(sock, targetJid, message, options, retries - 1);
    }
    throw err;
  }
}
export async function safeSendMessage(sock, jid, content, options = {}, retries = 2) {
  const targetJid = decodeJid(jid);
  try {
    if (content && typeof content === "object") await processThumbnails(content);
    if (options && typeof options === "object") await processThumbnails(options);
    return await sock.sendMessage(targetJid, content, options);
  } catch (err) {
    const statusCode = err?.output?.statusCode;
    const msg = String(err?.message || "").toLowerCase();
    if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || msg.includes("precondition") || msg.includes("closed"))) {
      await sleep(1200);
      return await safeSendMessage(sock, targetJid, content, options, retries - 1);
    }
    throw err;
  }
}
const PROTOCOL_KEYS = new Set(["messageContextInfo", "senderKeyDistributionMessage", "contextInfo", "botMetadata", "key"]);
export const unwrapMessage = msg => {
  if (!msg || typeof msg !== "object") return msg;
  let cur = msg;
  let guard = 0;
  while (cur && typeof cur === "object" && guard < 25) {
    guard++;
    if (cur.message && typeof cur.message === "object") {
      cur = cur.message;
      continue;
    }
    if (cur.rawMessage && typeof cur.rawMessage === "object") {
      cur = cur.rawMessage;
      continue;
    }
    if (cur.fakeObj?.message) {
      cur = cur.fakeObj.message;
      continue;
    }
    if (cur.protocolMessage?.editedMessage) {
      cur = cur.protocolMessage.editedMessage;
      continue;
    }
    if (cur.editedMessage) {
      cur = cur.editedMessage.message || cur.editedMessage;
      continue;
    }
    if (cur.viewOnceMessage?.message) {
      cur = cur.viewOnceMessage.message;
      continue;
    }
    if (cur.viewOnceMessageV2?.message) {
      cur = cur.viewOnceMessageV2.message;
      continue;
    }
    if (cur.viewOnceMessageV2Extension?.message) {
      cur = cur.viewOnceMessageV2Extension.message;
      continue;
    }
    if (cur.ephemeralMessage?.message) {
      cur = cur.ephemeralMessage.message;
      continue;
    }
    if (cur.documentWithCaptionMessage?.message) {
      cur = cur.documentWithCaptionMessage.message;
      continue;
    }
    if (cur.botForwardedMessage?.message) {
      cur = cur.botForwardedMessage.message;
      continue;
    }
    const wrapperKey = Object.keys(cur).find(k => !PROTOCOL_KEYS.has(k) && cur[k] && typeof cur[k] === "object" && cur[k].message);
    if (wrapperKey) {
      cur = cur[wrapperKey].message;
      continue;
    }
    if (cur.templateMessage && typeof cur.templateMessage === "object") {
      const tplKey = Object.keys(cur.templateMessage).find(k => k.toLowerCase().includes("template"));
      cur = tplKey ? cur.templateMessage[tplKey] : cur.templateMessage;
      continue;
    }
    const interactive = cur.interactiveMessage || cur.interactiveResponseMessage;
    if (interactive?.header && typeof interactive.header === "object") {
      const hasBody = Boolean(interactive.body?.text || interactive.nativeFlowMessage);
      if (!hasBody) {
        const mediaKey = Object.keys(interactive.header).find(k => k.endsWith("Message"));
        if (mediaKey) {
          cur = interactive.header;
          continue;
        }
      }
    }
    break;
  }
  return cur;
};
export function getMessagePayload(m) {
  if (!m) return {
    mtype: "conversation",
    msg: {
      text: ""
    }
  };
  if (typeof m === "string") return {
    mtype: "conversation",
    msg: {
      text: m
    }
  };
  const unwrapped = unwrapMessage(m) || m;
  if (typeof unwrapped === "string") return {
    mtype: "conversation",
    msg: {
      text: unwrapped
    }
  };
  const header = unwrapped?.interactiveMessage?.header || unwrapped?.header || unwrapped?.interactiveResponseMessage?.header;
  if (header && typeof header === "object") {
    const mediaKey = Object.keys(header).find(k => k.endsWith("Message") && header[k]);
    if (mediaKey) return {
      mtype: mediaKey,
      msg: header[mediaKey]
    };
  }
  const keys = Object.keys(unwrapped).filter(k => !PROTOCOL_KEYS.has(k) && unwrapped[k] != null);
  let mtype = keys.find(k => k.endsWith("Message")) || keys.find(k => k === "album" || k === "conversation" || k === "text") || keys[0] || "conversation";
  let payload = unwrapped[mtype] ?? unwrapped;
  if (typeof payload === "string") {
    payload = {
      text: payload,
      conversation: payload
    };
  }
  return {
    mtype: mtype,
    msg: payload
  };
}
export function extractMessageText(message) {
  if (!message) return "";
  const m = unwrapMessage(message) || message;
  if (typeof m === "string") return m;
  if (m.protocolMessage?.editedMessage) {
    return extractMessageText(m.protocolMessage.editedMessage);
  }
  if (m.editedMessage) {
    return extractMessageText(m.editedMessage?.message || m.editedMessage);
  }
  if (m.viewOnceMessage?.message) return extractMessageText(m.viewOnceMessage.message);
  if (m.viewOnceMessageV2?.message) return extractMessageText(m.viewOnceMessageV2.message);
  if (m.viewOnceMessageV2Extension?.message) return extractMessageText(m.viewOnceMessageV2Extension.message);
  if (m.documentWithCaptionMessage?.message) return extractMessageText(m.documentWithCaptionMessage.message);
  if (m.ephemeralMessage?.message) return extractMessageText(m.ephemeralMessage.message);
  const interactive = m.interactiveResponseMessage || m.interactiveMessage || m;
  const nativeFlow = interactive?.nativeFlowResponseMessage || m.nativeFlowResponseMessage;
  if (nativeFlow?.paramsJson) {
    try {
      const params = typeof nativeFlow.paramsJson === "string" ? JSON.parse(nativeFlow.paramsJson) : nativeFlow.paramsJson;
      const res = params.id || params.selected_id || params.command || params.text || params.name || params.response || "";
      if (res) return String(res).trim();
    } catch {}
  }
  const responseKeys = Object.keys(m).filter(k => k.endsWith("ResponseMessage") || k.endsWith("ReplyMessage"));
  for (const rk of responseKeys) {
    const obj = m[rk];
    if (obj) {
      const val = obj.selectedButtonId || obj.selectedDisplayText || obj.selectedId || obj.singleSelectReply?.selectedRowId;
      if (val) return String(val).trim();
    }
  }
  if (typeof m.caption === "string" && m.caption.trim()) return m.caption.trim();
  if (typeof m.text === "string" && m.text.trim()) return m.text.trim();
  if (typeof m.conversation === "string" && m.conversation.trim()) return m.conversation.trim();
  if (m.imageMessage?.caption) return m.imageMessage.caption.trim();
  if (m.videoMessage?.caption) return m.videoMessage.caption.trim();
  if (m.documentMessage?.caption) return m.documentMessage.caption.trim();
  const {
    msg
  } = getMessagePayload(m);
  if (msg && typeof msg === "object") {
    if (typeof msg.text === "string" && msg.text.trim()) return msg.text.trim();
    if (typeof msg.caption === "string" && msg.caption.trim()) return msg.caption.trim();
    if (typeof msg.conversation === "string" && msg.conversation.trim()) return msg.conversation.trim();
    if (typeof msg.selectedDisplayText === "string" && msg.selectedDisplayText.trim()) return msg.selectedDisplayText.trim();
    if (typeof msg.name === "string" && msg.name.trim()) return msg.name.trim();
    if (typeof msg.title === "string" && msg.title.trim()) return msg.title.trim();
    if (typeof msg.description === "string" && msg.description.trim()) return msg.description.trim();
    if (typeof msg.displayName === "string" && msg.displayName.trim()) return msg.displayName.trim();
    if (typeof msg.body?.text === "string" && msg.body.text.trim()) return msg.body.text.trim();
  }
  return "";
}
export function parseMention(text = "") {
  return [...text.matchAll(/@([0-9]{5,20})/g)].map(v => `${v[1]}@s.whatsapp.net`);
}
export function extractMentions(message, sock = null) {
  if (!message) return [];
  const m = unwrapMessage(message) || message;
  const mentions = [];
  const {
    msg
  } = getMessagePayload(m);
  if (msg?.contextInfo?.mentionedJid) mentions.push(...msg.contextInfo.mentionedJid);
  if (m?.contextInfo?.mentionedJid) mentions.push(...m.contextInfo.mentionedJid);
  if (m?.extendedTextMessage?.contextInfo?.mentionedJid) mentions.push(...m.extendedTextMessage.contextInfo.mentionedJid);
  if (m?.interactiveMessage?.contextInfo?.mentionedJid) mentions.push(...m.interactiveMessage.contextInfo.mentionedJid);
  if (m?.interactiveResponseMessage?.contextInfo?.mentionedJid) mentions.push(...m.interactiveResponseMessage.contextInfo.mentionedJid);
  const text = extractMessageText(m);
  if (text) {
    mentions.push(...parseMention(text));
  }
  return [...new Set(mentions.map(j => lidToJid(decodeJid(j), sock)).filter(Boolean))];
}
export function formatCtaButtons(buttons = []) {
  return (buttons || []).map(b => {
    if (!b) return null;
    if (b.buttonParamsJson) {
      let paramsObj = {};
      try {
        paramsObj = typeof b.buttonParamsJson === "string" ? JSON.parse(b.buttonParamsJson) : b.buttonParamsJson;
      } catch {
        paramsObj = {};
      }
      if (paramsObj.has_multiple_buttons === undefined) paramsObj.has_multiple_buttons = true;
      return {
        name: b.name,
        buttonParamsJson: JSON.stringify(paramsObj)
      };
    }
    if (b === "call_permission_request" || b.name === "call_permission_request" || b.type === "call_permission_request") {
      return {
        name: "call_permission_request",
        buttonParamsJson: JSON.stringify({
          has_multiple_buttons: true
        })
      };
    }
    if (b === "request_contact_info" || b.name === "request_contact_info" || b.type === "request_contact_info") {
      return {
        name: "request_contact_info",
        buttonParamsJson: JSON.stringify({
          has_multiple_buttons: true
        })
      };
    }
    if (b === "send_location" || b.name === "send_location" || b.type === "send_location") {
      return {
        name: "send_location",
        buttonParamsJson: JSON.stringify({
          has_multiple_buttons: true
        })
      };
    }
    if (Array.isArray(b)) {
      const [displayText, param, type = "quick_reply", extra = false] = b;
      let params = {
        has_multiple_buttons: true
      };
      if (type === "cta_url") {
        params = {
          display_text: displayText,
          url: param,
          merchant_url: param,
          webview_interaction: Boolean(extra),
          has_multiple_buttons: true
        };
      } else if (type === "cta_copy") {
        params = {
          display_text: displayText,
          copy_code: param,
          has_multiple_buttons: true
        };
      } else if (type === "cta_call") {
        params = {
          display_text: displayText,
          phone_number: param,
          id: param,
          has_multiple_buttons: true
        };
      } else if (type === "single_select") {
        params = {
          title: displayText,
          sections: param,
          has_multiple_buttons: true
        };
      } else {
        params = {
          display_text: displayText,
          id: param || displayText,
          has_multiple_buttons: true
        };
      }
      return {
        name: type,
        buttonParamsJson: JSON.stringify(params)
      };
    }
    const type = b.name || b.type || (b.url ? "cta_url" : b.copy || b.copy_code ? "cta_copy" : b.phone || b.phone_number ? "cta_call" : b.sections ? "single_select" : "quick_reply");
    let params = {
      has_multiple_buttons: true
    };
    if (type === "cta_url") params = {
      display_text: b.text || b.display_text,
      url: b.url,
      merchant_url: b.merchant_url || b.url,
      webview_interaction: Boolean(b.webview_interaction),
      has_multiple_buttons: true
    };
    else if (type === "cta_copy") params = {
      display_text: b.text || b.display_text,
      copy_code: b.code || b.copy_code || b.copy,
      has_multiple_buttons: true
    };
    else if (type === "cta_call") params = {
      display_text: b.text || b.display_text,
      phone_number: b.phone || b.phone_number || b.id,
      id: b.phone || b.phone_number || b.id,
      has_multiple_buttons: true
    };
    else if (type === "cta_reminder" || type === "cta_cancel_reminder" || type === "address_message") params = {
      display_text: b.text || b.display_text,
      id: b.id || b.text || b.display_text,
      has_multiple_buttons: true
    };
    else if (type === "single_select") params = {
      title: b.title || b.text || "Select Option",
      sections: b.sections || [],
      has_multiple_buttons: true
    };
    else params = {
      display_text: b.text || b.display_text,
      id: b.id || b.text || b.display_text,
      has_multiple_buttons: true
    };
    return {
      name: type,
      buttonParamsJson: JSON.stringify(params)
    };
  }).filter(Boolean);
}

function findMediaNode(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 12) return null;
  if (Buffer.isBuffer(obj)) return obj;
  if (obj.mediaKey && (obj.directPath || obj.url || obj.fileSha256 || obj.mimetype)) {
    return obj;
  }
  const interactiveHeader = obj?.interactiveMessage?.header || obj?.header || obj?.interactiveResponseMessage?.header;
  if (interactiveHeader) {
    const headerMedia = interactiveHeader.imageMessage || interactiveHeader.videoMessage || interactiveHeader.documentMessage || interactiveHeader.locationMessage;
    if (headerMedia) {
      const found = findMediaNode(headerMedia, depth + 1);
      if (found) return found;
    }
  }
  const carouselCards = obj?.interactiveMessage?.carouselMessage?.cards || obj?.carouselMessage?.cards || obj?.cards;
  if (Array.isArray(carouselCards) && carouselCards.length > 0) {
    for (const card of carouselCards) {
      const cardMedia = card?.header?.imageMessage || card?.header?.videoMessage || card?.header?.documentMessage || card?.header;
      if (cardMedia) {
        const found = findMediaNode(cardMedia, depth + 1);
        if (found) return found;
      }
    }
  }
  const mediaKeys = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage", "documentWithCaptionMessage", "locationMessage"];
  for (const key of mediaKeys) {
    if (obj[key]) {
      const res = findMediaNode(obj[key], depth + 1);
      if (res) return res;
    }
  }
  const wrappers = ["viewOnceMessage", "viewOnceMessageV2", "viewOnceMessageV2Extension", "ephemeralMessage", "interactiveMessage", "botForwardedMessage", "header", "message", "rawMessage", "msg", "media", "fakeObj"];
  for (const w of wrappers) {
    if (obj[w]) {
      const res = findMediaNode(obj[w], depth + 1);
      if (res) return res;
    }
  }
  for (const k of Object.keys(obj)) {
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      const res = findMediaNode(obj[k], depth + 1);
      if (res) return res;
    }
  }
  return null;
}

function resolveMediaType(node) {
  const mime = String(node?.mimetype || "").toLowerCase();
  if (node?.isAnimated !== undefined || mime.includes("webp") || mime.includes("sticker")) return "sticker";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/") || node?.ptt !== undefined || mime.includes("ogg") || mime.includes("opus")) return "audio";
  if (mime.startsWith("application/") || mime.startsWith("text/") || mime.includes("pdf")) return "document";
  return "document";
}
export const downloadMediaNode = async (target, customType = null) => {
  try {
    if (!target) return null;
    if (Buffer.isBuffer(target)) return target;
    let mediaNode = target;
    if (typeof unwrapMessage === "function") mediaNode = unwrapMessage(mediaNode) || mediaNode;
    if (typeof findMediaNode === "function") mediaNode = findMediaNode(mediaNode) || mediaNode;
    if (mediaNode?.ephemeralMessage?.message) mediaNode = mediaNode.ephemeralMessage.message;
    if (mediaNode?.viewOnceMessage?.message) mediaNode = mediaNode.viewOnceMessage.message;
    if (mediaNode?.viewOnceMessageV2?.message) mediaNode = mediaNode.viewOnceMessageV2.message;
    if (mediaNode?.viewOnceMessageV2Extension?.message) mediaNode = mediaNode.viewOnceMessageV2Extension.message;
    if (mediaNode?.documentWithCaptionMessage?.message) mediaNode = mediaNode.documentWithCaptionMessage.message;
    const mediaKeys = ["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage", "ptvMessage"];
    let detectedType = null;
    for (const key of mediaKeys) {
      if (mediaNode?.[key]) {
        detectedType = key.replace(/Message$/i, "").toLowerCase();
        mediaNode = mediaNode[key];
        break;
      }
    }
    if (!mediaNode || typeof mediaNode !== "object" || Buffer.isBuffer(mediaNode)) {
      return Buffer.isBuffer(mediaNode) ? mediaNode : null;
    }
    const hasMediaKey = Boolean(mediaNode.mediaKey || mediaNode.directPath || mediaNode.url);
    if (!hasMediaKey) {
      return null;
    }
    let downloadType = customType ? String(customType).replace(/Message$/i, "").toLowerCase() : detectedType || (typeof resolveMediaType === "function" ? resolveMediaType(mediaNode) : null);
    if (downloadType === "ptv") downloadType = "video";
    const allowedTypes = new Set(["image", "video", "audio", "sticker", "document"]);
    if (!allowedTypes.has(downloadType)) {
      const mime = (mediaNode.mimetype || "").toLowerCase();
      if (mime.startsWith("image/webp")) downloadType = "sticker";
      else if (mime.startsWith("image/")) downloadType = "image";
      else if (mime.startsWith("video/")) downloadType = "video";
      else if (mime.startsWith("audio/")) downloadType = "audio";
      else if (mime) downloadType = "document";
      else return null;
    }
    const stream = await Baileys.downloadContentFromMessage(mediaNode, downloadType);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    return buffer.length > 0 ? buffer : null;
  } catch (err) {
    const errMsg = err?.message || String(err);
    const isIgnored = /404|410|expired|rate-overlimit|bad decrypt|stream ended|mediaKey/i.test(errMsg);
    if (!isIgnored && global.bot?.debug) {
      console.warn(chalk.yellow(`[DownloadMedia Warning]: ${errMsg}`));
    }
    return null;
  }
};
export const detectDevice = (id = "") => {
  if (!id) return "unknown";
  if (typeof Baileys !== "undefined" && typeof Baileys.getDevice === "function") {
    const dev = Baileys.getDevice(id);
    if (dev) return dev;
  }
  if (/^3A.{18}$/.test(id)) return "ios";
  if (/^3E.{20}$/.test(id)) return "web";
  if (/^(.{21}|.{32})$/.test(id)) return "android";
  if (/^.{18}$/.test(id)) return "desktop";
  return "unknown";
};
export const detectBaileys = (id = "") => {
  if (!id) return false;
  const baileysPrefixes = ["BAE", "B1E", "3EB0", "WA"];
  const baileysLengths = [12, 16, 20, 22, 40];
  return baileysPrefixes.some(pfx => id.startsWith(pfx)) || baileysLengths.includes(id.length) || baileysPrefixes.includes(id);
};
export class BaseBuilder {
  constructor() {
    this._title = "";
    this._subtitle = "";
    this._body = "";
    this._footer = "";
    this._contextInfo = {};
    this._extraPayload = {};
  }
  setTitle(title) {
    this._title = String(title || "");
    return this;
  }
  setSubtitle(subtitle) {
    this._subtitle = String(subtitle || "");
    return this;
  }
  setBody(body) {
    this._body = String(body || "");
    return this;
  }
  setFooter(footer) {
    this._footer = String(footer || "");
    return this;
  }
  setContextInfo(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new TypeError("ContextInfo must be a plain object");
    this._contextInfo = obj;
    return this;
  }
  addPayload(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) throw new TypeError("Payload must be a plain object");
    Object.assign(this._extraPayload, obj);
    return this;
  }
}
export class CtaButtonBuilder extends BaseBuilder {
  constructor(client, defaultJid = null, defaultQuoted = null) {
    super();
    this._client = client;
    this._jid = defaultJid;
    this._quoted = defaultQuoted;
    this._buttons = [];
    this._media = null;
    this._mediaType = "image";
    this._location = null;
    this._params = {};
    this._currentSelectionIndex = -1;
    this._currentSectionIndex = -1;
  }
  setJid(jid) {
    this._jid = jid;
    return this;
  }
  setImage(media) {
    this._media = media;
    this._mediaType = "image";
    this._location = null;
    return this;
  }
  setVideo(media) {
    this._media = media;
    this._mediaType = "video";
    this._location = null;
    return this;
  }
  setDocument(media) {
    this._media = media;
    this._mediaType = "document";
    this._location = null;
    return this;
  }
  async setLocation(thumbnail, name = "", address = "") {
    let jpegThumbnail = null;
    if (thumbnail) {
      jpegThumbnail = await resizeImage(thumbnail, 300, 150, "image/jpeg");
    }
    this._location = {
      degreesLatitude: 0,
      degreesLongitude: 0,
      name: name || "",
      address: address || "",
      jpegThumbnail: jpegThumbnail
    };
    return this;
  }
  setParams(params = {}) {
    this._params = params;
    return this;
  }
  addButton(name, params = {}) {
    this._buttons.push({
      name: name,
      ...params
    });
    return this;
  }
  addReply(display_text = "", id = "", options = {}) {
    return this.addButton("quick_reply", {
      display_text: display_text,
      id: id || display_text,
      ...options
    });
  }
  addUrl(display_text = "", url = "", webview_interaction = false, options = {}) {
    return this.addButton("cta_url", {
      display_text: display_text,
      url: url,
      merchant_url: url,
      webview_interaction: Boolean(webview_interaction),
      ...options
    });
  }
  addCopy(display_text = "", copy_code = "", options = {}) {
    return this.addButton("cta_copy", {
      display_text: display_text || "Copy",
      copy_code: copy_code || display_text,
      ...options
    });
  }
  addCall(display_text = "", phone_number = "", options = {}) {
    return this.addButton("cta_call", {
      display_text: display_text,
      id: phone_number || display_text,
      phone_number: phone_number || display_text,
      ...options
    });
  }
  addReminder(display_text = "", id = "", options = {}) {
    return this.addButton("cta_reminder", {
      display_text: display_text,
      id: id || display_text,
      ...options
    });
  }
  addCancelReminder(display_text = "", id = "", options = {}) {
    return this.addButton("cta_cancel_reminder", {
      display_text: display_text,
      id: id || display_text,
      ...options
    });
  }
  addAddress(display_text = "", id = "", options = {}) {
    return this.addButton("address_message", {
      display_text: display_text,
      id: id || display_text,
      ...options
    });
  }
  addLocation(options = {}) {
    return this.addButton("send_location", options);
  }
  addContact(options = {}) {
    return this.addButton("request_contact_info", options);
  }
  addSelection(title = "Select Option") {
    this._buttons.push({
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: title,
        sections: [],
        has_multiple_buttons: true
      })
    });
    this._currentSelectionIndex = this._buttons.length - 1;
    this._currentSectionIndex = -1;
    return this;
  }
  makeSections(title = "", highlight_label = "") {
    if (this._currentSelectionIndex === -1) this.addSelection();
    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections.push({
      title: title,
      highlight_label: highlight_label,
      rows: []
    });
    this._currentSectionIndex = buttonParams.sections.length - 1;
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }
  makeRow(header = "", title = "", description = "", id = "") {
    if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) this.makeSections("Section");
    const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
    buttonParams.sections[this._currentSectionIndex].rows.push({
      header: header,
      title: title,
      description: description,
      id: id || title
    });
    this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
    return this;
  }
  async build(options = {}) {
    const upload = this._client?.waUploadToServer || this._client?.waUp;
    let preparedMedia = null;
    if (this._media) {
      let mediaPayload = this._media;
      if (typeof mediaPayload === "string" && /^https?:\/\//i.test(mediaPayload)) mediaPayload = {
        url: mediaPayload
      };
      preparedMedia = await prepareWAMessageMedia({
        [this._mediaType]: mediaPayload
      }, {
        upload: upload,
        ...options
      }).catch(() => null);
    }
    const header = this._location ? {
      title: this._title,
      subtitle: this._subtitle,
      hasMediaAttachment: true,
      locationMessage: this._location
    } : {
      title: this._title,
      subtitle: this._subtitle,
      hasMediaAttachment: Boolean(preparedMedia),
      ...preparedMedia
    };
    const mentions = Array.isArray(options.mentions) ? options.mentions : Array.isArray(options.mentionedJid) ? options.mentionedJid : Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : parseMention(this._body + " " + this._title);
    return {
      body: proto.Message.InteractiveMessage.Body.create({
        text: this._body
      }),
      footer: proto.Message.InteractiveMessage.Footer.create({
        text: this._footer
      }),
      header: proto.Message.InteractiveMessage.Header.create(header),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
        buttons: formatCtaButtons(this._buttons),
        messageParamsJson: JSON.stringify(this._params || {})
      }),
      contextInfo: {
        ...this._contextInfo,
        ...options.contextInfo,
        mentionedJid: mentions
      }
    };
  }
  async run(targetJid = null, quoted = null, options = {}) {
    const jid = decodeJid(targetJid || this._jid);
    const finalQuoted = quoted || this._quoted;
    const interactiveMsg = await this.build(options);
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: interactiveMsg
        }
      }
    });
    const msg = await generateWAMessageFromContent(jid, messageContent, {
      quoted: finalQuoted?.key ? finalQuoted : undefined,
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(this._client, jid, msg.message, {
      messageId: msg.key.id,
      ...options
    });
    return msg;
  }
  async send(jid = null, options = {}) {
    return await this.run(jid, options.quoted || this._quoted, options);
  }
}
export class CarouselCard {
  constructor() {
    this._headerTitle = "";
    this._headerSubtitle = "";
    this._body = "";
    this._footer = "";
    this._media = null;
    this._mediaType = "image";
    this._buttons = [];
    this._contextInfo = {};
  }
  setTitle(title = "") {
    this._headerTitle = String(title);
    return this;
  }
  setHeader(title = "", subtitle = "") {
    this._headerTitle = String(title);
    this._headerSubtitle = String(subtitle);
    return this;
  }
  setBody(body = "") {
    this._body = String(body);
    return this;
  }
  setFooter(footer = "") {
    this._footer = String(footer);
    return this;
  }
  setImage(media) {
    this._media = media;
    this._mediaType = "image";
    return this;
  }
  setVideo(media) {
    this._media = media;
    this._mediaType = "video";
    return this;
  }
  setMedia(media, type = "image") {
    this._media = media;
    this._mediaType = type;
    return this;
  }
  addButton(name, params = {}) {
    this._buttons.push({
      name: name,
      ...params
    });
    return this;
  }
  addReply(displayText, id) {
    return this.addButton("quick_reply", {
      display_text: displayText,
      id: id || displayText
    });
  }
  addCopy(displayText, copyCode) {
    return this.addButton("cta_copy", {
      display_text: displayText || "Copy",
      copy_code: copyCode || displayText
    });
  }
  addUrl(displayText, url, webview_interaction = false) {
    return this.addButton("cta_url", {
      display_text: displayText,
      url: url,
      merchant_url: url,
      webview_interaction: webview_interaction
    });
  }
  addCall(displayText, phone) {
    return this.addButton("cta_call", {
      display_text: displayText,
      phone_number: phone,
      id: phone
    });
  }
  addReminder(displayText, id) {
    return this.addButton("cta_reminder", {
      display_text: displayText,
      id: id || displayText
    });
  }
  addCancelReminder(displayText, id) {
    return this.addButton("cta_cancel_reminder", {
      display_text: displayText,
      id: id || displayText
    });
  }
  addAddress(displayText, id) {
    return this.addButton("address_message", {
      display_text: displayText,
      id: id || displayText
    });
  }
  addLocation(options = {}) {
    return this.addButton("send_location", options);
  }
  addContact(options = {}) {
    return this.addButton("request_contact_info", options);
  }
  addList(title, sections = []) {
    return this.addButton("single_select", {
      title: title,
      sections: sections
    });
  }
  setContextInfo(obj = {}) {
    this._contextInfo = obj;
    return this;
  }
  async build(client, options = {}) {
    const upload = client?.waUploadToServer || client?.waUp;
    let preparedMedia = null;
    if (this._media) {
      let mediaPayload = this._media;
      if (typeof mediaPayload === "string" && /^https?:\/\//i.test(mediaPayload)) mediaPayload = {
        url: mediaPayload
      };
      preparedMedia = await prepareWAMessageMedia({
        [this._mediaType]: mediaPayload
      }, {
        upload: upload,
        ...options
      }).catch(() => null);
    }
    const mentions = Array.isArray(options.mentions) ? options.mentions : Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : parseMention(this._body + " " + this._headerTitle);
    return {
      body: proto.Message.InteractiveMessage.Body.fromObject({
        text: this._body
      }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({
        text: this._footer
      }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        title: this._headerTitle,
        subtitle: this._headerSubtitle,
        hasMediaAttachment: Boolean(preparedMedia),
        ...preparedMedia
      }),
      nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
        buttons: formatCtaButtons(this._buttons),
        messageParamsJson: ""
      }),
      contextInfo: {
        ...this._contextInfo,
        ...options?.contextInfo,
        mentionedJid: mentions
      }
    };
  }
}
export class Carousel extends BaseBuilder {
  #client;
  constructor(client) {
    if (!client) throw new Error("Socket client is required");
    super();
    this.#client = client;
    this._cards = [];
  }
  createCard() {
    const card = new CarouselCard();
    this._cards.push(card);
    return card;
  }
  addCard(cardOrBuilder) {
    if (cardOrBuilder instanceof CarouselCard) {
      this._cards.push(cardOrBuilder);
    } else if (typeof cardOrBuilder === "function") {
      const card = new CarouselCard();
      cardOrBuilder(card);
      this._cards.push(card);
    } else {
      throw new TypeError("Card must be an instance of CarouselCard or a builder function");
    }
    return this;
  }
  setCards(cards = []) {
    this._cards = [];
    for (const card of cards) this.addCard(card);
    return this;
  }
  async build({
    quoted,
    ...options
  } = {}) {
    const upload = this.#client?.waUploadToServer || this.#client?.waUp;
    const userJid = this.#client.user?.id ? decodeJid(this.#client.user.id) : this.#client.user?.jid || "";
    const compiledCards = await Promise.all(this._cards.map(card => card.build(this.#client, options)));
    const mentions = Array.isArray(options.mentions) ? options.mentions : Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : parseMention(this._body + " " + this._title);
    const interactiveMessage = proto.Message.InteractiveMessage.create({
      body: proto.Message.InteractiveMessage.Body.fromObject({
        text: this._body
      }),
      footer: proto.Message.InteractiveMessage.Footer.fromObject({
        text: this._footer
      }),
      header: proto.Message.InteractiveMessage.Header.fromObject({
        title: this._title,
        subtitle: this._subtitle || this._title,
        hasMediaAttachment: false
      }),
      carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
        cards: compiledCards
      }),
      contextInfo: {
        ...this._contextInfo,
        ...options?.contextInfo,
        mentionedJid: mentions
      }
    });
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: interactiveMessage
        }
      }
    });
    return await generateWAMessageFromContent(options.jid || "@s.whatsapp.net", messageContent, {
      userJid: userJid,
      quoted: quoted?.key ? quoted : undefined,
      upload: upload,
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
  }
  async run(jid, sockOrQuoted = null, quoted = null, options = {}) {
    const sock = sockOrQuoted && typeof sockOrQuoted.relayMessage === "function" ? sockOrQuoted : this.#client;
    const actualQuoted = sockOrQuoted && typeof sockOrQuoted.relayMessage === "function" ? quoted : sockOrQuoted;
    const targetJid = decodeJid(jid);
    const msg = await this.build({
      jid: targetJid,
      quoted: actualQuoted?.key ? actualQuoted : undefined,
      ...options
    });
    await safeRelayInteractive(sock, targetJid, msg.message, {
      messageId: msg.key.id,
      ...options
    });
    return msg;
  }
  async send(jid, {
    quoted,
    ...options
  } = {}) {
    return await this.run(jid, this.#client, quoted, options);
  }
}
export function safeTokenizeCode(code, language = "javascript") {
  if (typeof tokenizeCode === "function") return tokenizeCode(code, language);
  if (typeof Baileys.tokenizeCode === "function") return Baileys.tokenizeCode(code, language);
  return [{
    codeContent: code,
    highlightType: 0
  }];
}
export function extractIE(text, {
  extract = true,
  hyperlink = true,
  citation = true,
  latex = true
} = {}) {
  if (!extract) return {
    text: text,
    ie: [],
    inline_entities: []
  };
  const createIE = (type, ie) => {
    if (type === "hyperlink") {
      return {
        key: ie.key,
        metadata: {
          display_name: ie.text,
          is_trusted: ie.is_trusted ?? true,
          url: ie.url,
          __typename: "GenAIInlineLinkItem"
        }
      };
    }
    if (type === "citation") {
      return {
        key: ie.key,
        metadata: {
          reference_id: ie.reference_id,
          reference_url: ie.url,
          reference_title: ie.url,
          reference_display_name: ie.url,
          sources: [],
          __typename: "GenAISearchCitationItem"
        }
      };
    }
    if (type === "latex") {
      return {
        key: ie.key,
        metadata: {
          latex_expression: ie.text,
          latex_image: {
            url: ie.url,
            width: Number(ie.width) || 100,
            height: Number(ie.height) || 50
          },
          font_height: Number(ie.font_height) || 50,
          padding: Number(ie.padding) || 8,
          __typename: "GenAILatexItem"
        }
      };
    }
  };
  let ie = [];
  let inline_entities = [];
  let result = "";
  let last = 0;
  let citation_index = 1;
  let hyperlink_index = 0;
  let latex_index = 0;
  let stack = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[" && text[i - 1] !== "\\") {
      stack.push(i);
    } else if (text[i] === "]" && text[i - 1] !== "\\") {
      if (text[i + 1] === "(" || text[i + 1] === "<") {
        let start = stack.pop();
        if (start == null) continue;
        let open = text[i + 1];
        let close = open === "(" ? ")" : ">";
        let type = open === "(" ? "link" : "latex";
        let end = i + 2;
        let depth = 1;
        while (end < text.length && depth) {
          if (text[end] === open && text[end - 1] !== "\\") depth++;
          else if (text[end] === close && text[end - 1] !== "\\") depth--;
          end++;
        }
        if (depth) continue;
        let raw = text.slice(start + 1, i).trim();
        let url = text.slice(i + 2, end - 1).trim();
        let key, tag, data;
        if (type === "latex") {
          if (!latex) continue;
          let [txt = "", width = null, height = null, font_height = 50, padding = 8] = raw.split("|");
          key = `_LATEX_${latex_index++}`;
          tag = `{{${key}}}${txt || "image"}{{/${key}}}`;
          data = {
            type: "latex",
            ie: {
              key: key,
              text: txt,
              url: url,
              width: Number(width) || null,
              height: Number(height) || null,
              font_height: Number(font_height) || 50,
              padding: Number(padding) || 8
            }
          };
        } else if (raw) {
          if (!hyperlink) continue;
          const trusted = !url.startsWith("!");
          if (!trusted) url = url.slice(1);
          key = `_HYPERLINK_${hyperlink_index++}`;
          tag = `{{${key}}}${raw}{{/${key}}}`;
          data = {
            type: "hyperlink",
            ie: {
              key: key,
              text: raw,
              url: url,
              is_trusted: trusted
            }
          };
        } else {
          if (!citation) continue;
          key = `_CITATION_${citation_index - 1}`;
          tag = `{{${key}}}${url}{{/${key}}}`;
          data = {
            type: "citation",
            ie: {
              reference_id: citation_index++,
              key: key,
              text: "",
              url: url
            }
          };
        }
        result += text.slice(last, start) + tag;
        last = end;
        ie.push(data);
        const entity = createIE(data.type, data.ie);
        if (entity) inline_entities.push(entity);
        i = end - 1;
      } else {
        stack.pop();
      }
    }
  }
  result += text.slice(last);
  return {
    text: result,
    ie: ie,
    inline_entities: inline_entities
  };
}
export class AIRich extends BaseBuilder {
  #client;
  constructor(client) {
    if (!client) throw new Error("Socket client is required");
    super();
    this.#client = client;
    this._contextInfo = {};
    this._items = [];
    this._links = [];
  }
  addText(text, {
    hyperlink = true,
    citation = true,
    latex = true
  } = {}) {
    if (typeof text !== "string") throw new TypeError("Text must be a string");
    const {
      text: extractedText,
      inline_entities
    } = extractIE(text, {
      hyperlink: hyperlink,
      citation: citation,
      latex: latex
    });
    this._items.push({
      type: "text",
      text: extractedText,
      ...inline_entities.length ? {
        inlineEntities: inline_entities
      } : {}
    });
    return this;
  }
  addCode(language, code) {
    if (typeof language !== "string" || typeof code !== "string") throw new TypeError("Language and code must be strings");
    this._items.push({
      type: "code",
      language: language,
      code: code
    });
    return this;
  }
  addTable(table) {
    if (!Array.isArray(table) || !table.every(row => Array.isArray(row) && row.every(cell => typeof cell === "string"))) throw new TypeError("Table must be a nested array of strings");
    const maxLen = Math.max(...table.map(r => r.length));
    this._items.push({
      type: "table",
      table: table.map(r => [...r, ...Array(maxLen - r.length).fill("")])
    });
    return this;
  }
  addSource(sources = []) {
    if (sources.every(item => typeof item === "string")) sources = [sources];
    for (const [icon, url, text] of sources) {
      this._links.push({
        text: text || "",
        url: url || "",
        title: text || "Source",
        displayName: text || "Source",
        ...icon ? {
          sources: [{
            source_type: "THIRD_PARTY",
            source_display_name: text || "Source",
            source_subtitle: "AI",
            source_url: url || ""
          }]
        } : {}
      });
    }
    return this;
  }
  addImage(imageUrl, {
    resolveUrl = false
  } = {}) {
    this._items.push({
      type: "image",
      image: imageUrl,
      resolveUrl: resolveUrl
    });
    return this;
  }
  addTip(text) {
    this._items.push({
      type: "tip",
      text: text
    });
    return this;
  }
  addSuggest(suggestion, {
    scroll = true,
    layout
  } = {}) {
    this._items.push({
      type: "suggest",
      suggestion: suggestion,
      scroll: scroll,
      layout: layout
    });
    return this;
  }
  async build({
    forwarded = true,
    quoted,
    quotedParticipant,
    ...options
  } = {}) {
    const uuid = crypto.randomUUID();
    const submessages = [];
    const sections = [];
    const pushSec = (text, inlineEntities = []) => {
      submessages.push({
        messageType: 2,
        messageText: text,
        ...inlineEntities.length ? {
          inlineEntities: inlineEntities
        } : {}
      });
      sections.push({
        view_model: {
          primitive: {
            text: text,
            ...inlineEntities.length ? {
              inline_entities: inlineEntities
            } : {},
            __typename: "GenAIMarkdownTextUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    };
    for (const item of this._items) {
      if (item.type === "text") {
        pushSec(item.text, item.inlineEntities || []);
      } else if (item.type === "code") {
        const blocks = safeTokenizeCode(item.code, item.language);
        submessages.push({
          messageType: 5,
          codeMetadata: {
            codeLanguage: item.language,
            codeBlocks: blocks
          }
        });
        sections.push({
          view_model: {
            primitive: {
              language: item.language,
              code_blocks: blocks.map(b => ({
                content: b.codeContent || b.content || item.code,
                type: typeof b.highlightType === "number" ? ["AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_KEYWORD", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_METHOD", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_STRING", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_NUMBER", "AI_RICH_RESPONSE_CODE_HIGHLIGHT_COMMENT"][b.highlightType] || "AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT" : b.type || "AI_RICH_RESPONSE_CODE_HIGHLIGHT_DEFAULT"
              })),
              __typename: "GenAICodeUXPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "table") {
        const rows = item.table.map((cells, index) => ({
          isHeading: index === 0,
          items: cells
        }));
        submessages.push({
          messageType: 4,
          tableMetadata: {
            title: "",
            rows: rows
          }
        });
        sections.push({
          view_model: {
            primitive: {
              title: "",
              rows: rows.map(row => ({
                is_header: row.isHeading,
                cells: row.items,
                markdown_cells: row.items.map(cell => ({
                  text: cell
                }))
              })),
              __typename: "GenATableUXPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "tip") {
        pushSec(item.text);
        sections.push({
          view_model: {
            primitive: {
              text: item.text,
              __typename: "GenAIMetadataTextPrimitive"
            },
            __typename: "GenAISingleLayoutViewModel"
          }
        });
      } else if (item.type === "suggest") {
        const suggest = (Array.isArray(item.suggestion) ? item.suggestion : [item.suggestion]).map(text => ({
          prompt_text: text,
          prompt_type: "SUGGESTED_PROMPT",
          __typename: "GenAIFollowUpSuggestionPillPrimitive"
        }));
        const type = item.layout ?? (suggest.length === 1 ? "Single" : item.scroll ? "HScroll" : "ActionRow");
        sections.push({
          __typename: "GenAIUnifiedResponseSection",
          view_model: {
            [type === "Single" ? "primitive" : "primitives"]: type === "Single" ? suggest[0] : suggest,
            __typename: `GenAI${type}LayoutViewModel`
          }
        });
      } else if (item.type === "image") {
        let url = item.image;
        if (Buffer.isBuffer(item.image)) {
          const media = await Baileys.prepareWAMessageMedia({
            image: item.image
          }, {
            upload: this.#client?.waUploadToServer || this.#client?.waUp,
            jid: "@newsletter"
          }).catch(() => null);
          url = media?.imageMessage?.url || null;
        }
        if (url) {
          submessages.push({
            messageType: 3,
            imageMetadata: {
              imageUrl: url,
              imageText: "",
              alignment: 0,
              tapLinkUrl: ""
            }
          });
          sections.push({
            view_model: {
              primitive: {
                media: {
                  url: url,
                  mime_type: "image/png"
                },
                imagine_type: "IMAGE",
                status: {
                  status: "READY"
                },
                __typename: "GenAIImaginePrimitive"
              },
              __typename: "GenAISingleLayoutViewModel"
            }
          });
        }
      }
    }
    this._links.forEach((linkField, index) => {
      const prefix = "SS_" + index;
      const url = linkField.url || "";
      const sources = linkField.sources?.length ? linkField.sources.map(s => ({
        source_type: "THIRD_PARTY",
        source_display_name: s.source_display_name || "Source",
        source_subtitle: "AI",
        source_url: s.source_url || url
      })) : [];
      pushSec(linkField.text + ` {{${prefix}}}¹{{/${prefix}}} `, [{
        key: prefix,
        metadata: {
          reference_id: index + 1,
          reference_url: url,
          reference_title: linkField.title || "Source",
          reference_display_name: linkField.displayName || "Source",
          sources: sources,
          __typename: "GenAISearchCitationItem"
        }
      }]);
    });
    if (this._body) {
      submessages.unshift({
        messageType: 2,
        messageText: this._body
      });
      sections.unshift({
        view_model: {
          primitive: {
            text: this._body,
            __typename: "GenAIMarkdownTextUXPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    }
    if (this._footer) {
      submessages.push({
        messageType: 2,
        messageText: this._footer
      });
      sections.push({
        view_model: {
          primitive: {
            text: this._footer,
            __typename: "GenAIMetadataTextPrimitive"
          },
          __typename: "GenAISingleLayoutViewModel"
        }
      });
    }
    const contextInfo = {};
    if (forwarded) {
      contextInfo.forwardingScore = 1;
      contextInfo.isForwarded = true;
      contextInfo.forwardedAiBotMessageInfo = {
        botJid: "13135550002@s.whatsapp.net"
      };
      contextInfo.forwardOrigin = 4;
    }
    if (quoted) {
      contextInfo.stanzaId = quoted?.key?.id || quoted?.id;
      contextInfo.participant = quotedParticipant || quoted?.key?.participantAlt || quoted?.key?.participant || quoted?.key?.remoteJidAlt || quoted?.key?.remoteJid;
      contextInfo.quotedType = 0;
      contextInfo.quotedMessage = typeof quoted === "object" && quoted !== null ? quoted.message ?? quoted : undefined;
    }
    const mentions = Array.isArray(options.mentions) ? options.mentions : Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : parseMention(this._body + " " + this._footer);
    Object.assign(contextInfo, this._contextInfo, options.contextInfo, {
      mentionedJid: mentions
    });
    const richResponseMessage = proto.AIRichResponseMessage.create({
      messageType: proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
      submessages: submessages,
      unifiedResponse: {
        data: Buffer.from(JSON.stringify({
          response_id: uuid,
          sections: sections
        }))
      },
      contextInfo: contextInfo
    });
    const message = Baileys.wrapToBotForwardedMessage ? Baileys.wrapToBotForwardedMessage(richResponseMessage) : {
      botForwardedMessage: {
        message: {
          richResponseMessage: richResponseMessage
        }
      },
      messageContextInfo: {
        botMetadata: {}
      }
    };
    if (this._title && message.messageContextInfo?.botMetadata) {
      message.messageContextInfo.botMetadata.messageDisclaimerText = this._title;
    }
    if (message.messageContextInfo?.botMetadata) {
      message.messageContextInfo.botMetadata.botResponseId = uuid;
    }
    Object.assign(message, this._extraPayload);
    return message;
  }
  async send(jid, {
    forwarded = true,
    quoted,
    ...options
  } = {}) {
    const msg = await this.build({
      forwarded: forwarded,
      quoted: quoted,
      ...options
    });
    const targetJid = decodeJid(jid);
    return await safeSendMessage(this.#client, targetJid, msg, options);
  }
}
export async function appendTextMessage(sock, message, text, chatUpdate = {}) {
  const targetJid = decodeJid(message.chat || message.key?.remoteJid);
  const senderJid = decodeJid(message.sender || message.key?.participant || targetJid);
  const isGroup = isJidGroup(targetJid) || targetJid.endsWith("@g.us");
  const generated = await generateWAMessage(targetJid, {
    text: text,
    mentions: message.mentionedJid || message.mentions || [senderJid]
  }, {
    userJid: sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid,
    quoted: message.quoted && (message.quoted?.fakeObj || message.quoted)
  });
  const myJid = decodeJid(sock.user?.id || sock.user?.jid || "");
  generated.key.fromMe = areJidsSameUser(senderJid, myJid);
  generated.key.id = message.key?.id || generated.key.id;
  generated.pushName = message.pushName || message.name || message.pushname;
  if (isGroup) {
    generated.key.participant = senderJid;
    generated.participant = senderJid;
  }
  const msgObj = {
    ...chatUpdate,
    messages: [proto.WebMessageInfo.fromObject(generated)],
    type: "append"
  };
  sock.ev.emit("messages.upsert", msgObj);
}
export async function copyNForward(sock, jid, message, forwardingScore = true, options = {}, quoted = undefined) {
  if (!message) return null;
  const cleanTargetJid = Baileys.jidNormalizedUser ? Baileys.jidNormalizedUser(decodeJid(jid)) : decodeJid(jid);
  try {
    let webMsg = null;
    if (message.key && message.message) {
      webMsg = message;
    } else if (message.fakeObj || message.vM) {
      webMsg = message.fakeObj || message.vM;
    } else {
      const raw = message.rawMessage || message.message || message.msg || message;
      webMsg = {
        key: message.key || {
          remoteJid: cleanTargetJid,
          id: message.id || "3EB0" + crypto.randomBytes(8).toString("hex").toUpperCase(),
          fromMe: Boolean(message.fromMe)
        },
        message: raw?.message || (raw?.mtype ? {
          [raw.mtype]: raw.msg || raw
        } : raw),
        messageTimestamp: Math.floor(Date.now() / 1e3)
      };
    }
    const validWebMessage = proto.WebMessageInfo.fromObject(webMsg);
    let forwardContent = null;
    try {
      forwardContent = await generateForwardMessageContent(validWebMessage, Boolean(forwardingScore));
    } catch {
      forwardContent = validWebMessage.message;
    }
    if (!forwardContent) return null;
    const mtype = Object.keys(forwardContent)[0];
    if (!mtype || !forwardContent[mtype]) return null;
    if (forwardContent[mtype].viewOnce) delete forwardContent[mtype].viewOnce;
    if (!forwardContent[mtype].contextInfo) forwardContent[mtype].contextInfo = {};
    Object.assign(forwardContent[mtype].contextInfo, options.contextInfo || {});
    if (forwardingScore) {
      forwardContent[mtype].contextInfo.isForwarded = true;
      forwardContent[mtype].contextInfo.forwardingScore = typeof forwardingScore === "number" ? forwardingScore : 1;
    } else if (forwardingScore === false) {
      delete forwardContent[mtype].contextInfo.isForwarded;
      delete forwardContent[mtype].contextInfo.forwardingScore;
    }
    if (forwardContent[mtype].contextInfo?.participant?.endsWith?.("@lid")) {
      delete forwardContent[mtype].contextInfo.participant;
    }
    const finalMsg = await generateWAMessageFromContent(cleanTargetJid, forwardContent, {
      userJid: sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid,
      quoted: quoted?.key ? quoted : quoted || undefined,
      ephemeralExpiration: options.ephemeralExpiration || WA_DEFAULT_EPHEMERAL,
      ...options
    });
    const isInteractive = Boolean(finalMsg?.message?.viewOnceMessage?.message?.interactiveMessage || finalMsg?.message?.interactiveMessage);
    if (finalMsg?.message && finalMsg?.key?.id) {
      if (isInteractive) {
        await safeRelayInteractive(sock, cleanTargetJid, finalMsg.message, {
          messageId: finalMsg.key.id,
          ...options
        });
      } else {
        await sock.relayMessage(cleanTargetJid, finalMsg.message, {
          messageId: finalMsg.key.id,
          ...options
        });
      }
      return finalMsg;
    }
    return finalMsg;
  } catch (err) {
    console.error(chalk.red("[copyNForward Error]"), err?.message || err);
    throw err;
  }
}
export async function SerializeMessage(sock, msg) {
  if (!msg) return null;
  if (msg.key?.id) {
    global.msgStore.set(msg.key.id, msg);
    if (global.msgStore.size > 2500) {
      const oldestKey = global.msgStore.keys().next().value;
      global.msgStore.delete(oldestKey);
    }
  }
  if (typeof sock.appendTextMessage !== "function") {
    sock.appendTextMessage = (m, text, update = {}) => appendTextMessage(sock, m, text, update);
  }
  if (typeof sock.copyNForward !== "function") {
    sock.copyNForward = (jid, message, forwardingScore = true, options = {}, quoted = undefined) => copyNForward(sock, jid, message, forwardingScore, options, quoted);
  }
  const botId = decodeJid(sock?.user?.id || sock?.user?.jid || "");
  const botLid = sock?.user?.lid ? decodeJid(sock?.user?.lid) : null;
  const botNumber = extractNum(botId);
  let isEdited = false;
  let rawMessage = msg.message || {};
  const isStubEdit = Boolean(msg.messageStubType === 68 || msg.stubType === 68);
  const protocolMsg = rawMessage?.protocolMessage;
  const isProtoEdit = Boolean(protocolMsg && (protocolMsg.type === 14 || protocolMsg.type === proto.ProtocolMessage?.Type?.MESSAGE_EDIT || Boolean(protocolMsg.editedMessage))) || Boolean(rawMessage?.editedMessage);
  if (isStubEdit || isProtoEdit) {
    isEdited = true;
    let unwrappedEdit = protocolMsg?.editedMessage || rawMessage?.editedMessage?.message || rawMessage?.editedMessage || null;
    if (!unwrappedEdit && msg.messageStubParameters?.[0]) {
      try {
        const parsedStub = typeof msg.messageStubParameters[0] === "string" ? JSON.parse(msg.messageStubParameters[0]) : msg.messageStubParameters[0];
        unwrappedEdit = parsedStub?.message || parsedStub;
      } catch {}
    }
    if (unwrappedEdit) {
      rawMessage = unwrappedEdit;
      msg.message = rawMessage;
      if (protocolMsg?.key) {
        msg.key = {
          ...msg.key,
          ...protocolMsg.key,
          participant: msg.key?.participant || protocolMsg.key?.participant
        };
      }
    }
  }
  const m = unwrapMessage(rawMessage) || rawMessage;
  const ctx = {};
  ctx.key = msg.key || {};
  ctx.sock = sock;
  ctx.isEdited = isEdited;
  ctx.botId = botId;
  ctx.botLid = botLid;
  ctx.botJid = botId;
  ctx.botNumber = botNumber;
  const remoteJid = msg.key?.remoteJid || "";
  const remoteJidAlt = msg.key?.remoteJidAlt || null;
  const participantJid = msg.key?.participantJid || null;
  const participantAlt = msg.key?.participantAlt || null;
  if (msg.key?.participant && participantJid) {
    global.lidPhoneCache.set(decodeJid(msg.key.participant), decodeJid(participantJid));
  }
  if (remoteJid?.endsWith("@lid") && remoteJidAlt) {
    global.lidPhoneCache.set(decodeJid(remoteJid), decodeJid(remoteJidAlt));
  }
  const isGroup = isJidGroup ? isJidGroup(remoteJid) : remoteJid.endsWith("@g.us");
  const isStatus = Boolean(remoteJid === "status@broadcast" || remoteJid.startsWith("status@"));
  const isChannel = Boolean(remoteJid.endsWith("@newsletter"));
  let rawSender = isGroup ? participantJid || msg.key?.participant || msg.participant || participantAlt || "" : remoteJidAlt || participantJid || msg.key?.participant || remoteJid;
  const rawSenderAlt = participantJid || participantAlt || remoteJidAlt || null;
  ctx.id = await resolveLidToJid(remoteJid, sock, remoteJidAlt);
  ctx.chat = ctx.id;
  ctx.from = ctx.id;
  ctx.group = isGroup;
  ctx.isGroup = isGroup;
  ctx.isStatus = isStatus;
  ctx.isChannel = isChannel;
  ctx.broadcast = Boolean(msg.broadcast || isStatus);
  ctx.status = msg.status ?? 2;
  ctx.messageTimestamp = msg.messageTimestamp ? parseInt(msg.messageTimestamp) : Math.floor(Date.now() / 1e3);
  const resolvedSender = await resolveLidToJid(rawSender, sock, rawSenderAlt);
  ctx.sender = resolvedSender;
  ctx.senderAlt = rawSenderAlt ? decodeJid(rawSenderAlt) : null;
  ctx.userPhoneJid = !ctx.sender.endsWith("@lid") ? ctx.sender : ctx.senderAlt && !ctx.senderAlt.endsWith("@lid") ? ctx.senderAlt : ctx.sender;
  ctx.senderNumber = extractNum(ctx.userPhoneJid);
  if (!isGroup && ctx.chat.endsWith("@lid") && ctx.userPhoneJid && !ctx.userPhoneJid.endsWith("@lid")) {
    ctx.chat = ctx.userPhoneJid;
    ctx.id = ctx.userPhoneJid;
    ctx.from = ctx.userPhoneJid;
  }
  ctx.pushName = msg.pushName || null;
  ctx.pushname = ctx.pushName;
  ctx.fromMe = Boolean(msg.key?.fromMe);
  ctx.isFromMe = ctx.fromMe;
  ctx.isBot = areJidsSameUser(ctx.sender, botId) || botLid && areJidsSameUser(ctx.sender, botLid) || ctx.senderAlt && areJidsSameUser(ctx.senderAlt, botId) || ctx.senderAlt && botLid && areJidsSameUser(ctx.senderAlt, botLid);
  const rawOwners = [...Array.isArray(global.bot?.owner) ? global.bot.owner.flat(Infinity) : [global.bot?.owner], global.bot?.author?.number].filter(Boolean);
  const ownerNumbers = new Set();
  const ownerJids = new Set();
  for (const o of rawOwners) {
    const num = String(o).replace(/\D/g, "");
    if (num.length >= 6) {
      ownerNumbers.add(num);
      ownerJids.add(`${num}@s.whatsapp.net`);
    }
  }
  for (const num of ownerNumbers) {
    if (ctx.senderNumber === num && rawSender.endsWith("@lid")) {
      global.lidPhoneCache.set(rawSender, `${num}@s.whatsapp.net`);
      ctx.sender = `${num}@s.whatsapp.net`;
      ctx.userPhoneJid = `${num}@s.whatsapp.net`;
    }
  }
  const checkIsOwner = (candidates = []) => {
    return candidates.filter(Boolean).some(cand => {
      const cleanCand = decodeJid(cand);
      const candNum = extractNum(cleanCand);
      return ownerJids.has(cleanCand) || ownerNumbers.has(candNum) || ownerJids.has(Baileys.jidNormalizedUser(cleanCand));
    });
  };
  const isOwnerJid = checkIsOwner([ctx.sender, ctx.senderAlt, ctx.userPhoneJid, ctx.senderNumber, rawSender, rawSenderAlt]);
  const userData = global.db?.user?.[ctx.userPhoneJid] || global.db?.user?.[ctx.sender] || null;
  ctx.user = userData;
  ctx.groupData = ctx.isGroup ? global.db?.group?.[ctx.chat] || null : null;
  ctx.db = global.db || {};
  ctx.isROwner = isOwnerJid || ctx.isFromMe;
  ctx.isOwner = ctx.isFromMe || ctx.isBot || isOwnerJid || userData?.ownerAcces === true;
  ctx.isPremium = Boolean(userData?.premium?.status || ctx.isOwner);
  const {
    mtype,
    msg: parsedMsg
  } = getMessagePayload(m);
  ctx.rawMessage = rawMessage;
  ctx.message = m;
  ctx.mtype = mtype;
  ctx.msgType = mtype;
  ctx.type = mtype;
  ctx.msg = parsedMsg;
  ctx.timestamp = msg.messageTimestamp ? parseInt(msg.messageTimestamp) * 1e3 : Date.now();
  const keyId = msg.key?.id || ctx.key?.id || "";
  ctx.device = detectDevice(keyId);
  ctx.isBaileys = detectBaileys(keyId);
  ctx.text = extractMessageText(rawMessage) || extractMessageText(m) || "";
  ctx.body = ctx.text;
  ctx.mentionedJid = extractMentions(rawMessage, sock);
  ctx.mentions = ctx.mentionedJid;
  ctx.link = Array.from(new Set(ctx.text.match(/https?:\/\/[^\s]+/gi) || []));
  let selectedId = null;
  let selectedRowId = null;
  if (m.buttonsResponseMessage) {
    selectedId = m.buttonsResponseMessage.selectedButtonId || null;
  } else if (m.templateButtonReplyMessage) {
    selectedId = m.templateButtonReplyMessage.selectedId || null;
  } else if (m.listResponseMessage) {
    selectedRowId = m.listResponseMessage.singleSelectReply?.selectedRowId || null;
    selectedId = selectedRowId;
  } else if (m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const p = JSON.parse(m.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      selectedId = p.id || p.selected_id || p.command || null;
    } catch {}
  }
  ctx.selectedId = selectedId;
  ctx.selectedRowId = selectedRowId;
  const prefixConfig = global.bot?.prefix || global.bot?.defaultPrefix || ["!", ".", "/", "#"];
  const contextInfo = m?.contextInfo || parsedMsg?.contextInfo || m?.extendedTextMessage?.contextInfo || m?.imageMessage?.contextInfo || m?.videoMessage?.contextInfo || m?.documentMessage?.contextInfo || m?.stickerMessage?.contextInfo || m?.audioMessage?.contextInfo || rawMessage?.messageContextInfo || null;
  ctx.contextInfo = contextInfo;
  ctx.quoted = null;
  if (contextInfo?.quotedMessage) {
    const rawQuoted = contextInfo.quotedMessage;
    const qMsg = unwrapMessage(rawQuoted) || rawQuoted;
    const nestedMedia = findMediaNode(qMsg);
    const {
      mtype: qMtype,
      msg: parsedQMedia
    } = getMessagePayload(qMsg);
    const qMedia = nestedMedia || (typeof parsedQMedia === "string" ? {
      text: parsedQMedia,
      conversation: parsedQMedia
    } : parsedQMedia || {});
    const qMimetype = qMedia?.mimetype || nestedMedia?.mimetype || "";
    const isMediaInQuoted = Boolean(nestedMedia || qMedia && (/image|video|sticker|audio|document|webp/.test(qMimetype) || ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage", "ptvMessage"].includes(qMtype)));
    const qMediaType = isMediaInQuoted ? nestedMedia ? resolveMediaType(nestedMedia) : qMtype.replace(/Message/gi, "").toLowerCase() : null;
    const isQuotedAnimated = Boolean(qMsg?.stickerMessage?.isAnimated || qMedia?.isAnimated || false);
    let rawQuotedSender = contextInfo.participant || contextInfo.participantAlt || contextInfo.remoteJidAlt || contextInfo.remoteJid || "";
    const cachedQuoted = global.msgStore?.get(contextInfo.stanzaId);
    if (cachedQuoted?.sender && !cachedQuoted.sender.endsWith("@lid")) {
      rawQuotedSender = cachedQuoted.sender;
    }
    let groupParticipantsList = [];
    if (ctx.isGroup) {
      groupParticipantsList = sock?.store?.groupMetadata?.[ctx.id]?.participants || sock?.chats?.[ctx.id]?.participants || [];
    }
    let cleanQuotedSender = await resolveLidToJid(decodeJid(rawQuotedSender), sock, contextInfo.participantAlt || contextInfo.remoteJidAlt || (!ctx.isGroup ? ctx.chat : null), groupParticipantsList);
    if (!ctx.isGroup && cleanQuotedSender.endsWith("@lid")) {
      const isFromBot = Boolean(cleanQuotedSender === botLid || cleanQuotedSender === botId || contextInfo.stanzaId?.startsWith("3EB0") || contextInfo.stanzaId?.startsWith("BAE5"));
      cleanQuotedSender = isFromBot ? botId : ctx.chat;
    }
    const quotedIsFromMe = cleanQuotedSender ? areJidsSameUser(cleanQuotedSender, botId) || (botLid ? areJidsSameUser(cleanQuotedSender, botLid) : false) : false;
    const quotedStanzaId = contextInfo.stanzaId || "";
    const fakeObj = proto.WebMessageInfo.fromObject({
      key: {
        remoteJid: ctx.id,
        fromMe: quotedIsFromMe,
        id: quotedStanzaId,
        participant: cleanQuotedSender
      },
      message: qMsg,
      messageTimestamp: Math.floor(Date.now() / 1e3)
    });
    let innerContextInfo = qMedia?.contextInfo || qMsg?.contextInfo || rawQuoted?.contextInfo || rawQuoted?.extendedTextMessage?.contextInfo || rawQuoted?.imageMessage?.contextInfo || rawQuoted?.videoMessage?.contextInfo || rawQuoted?.documentMessage?.contextInfo || rawQuoted?.stickerMessage?.contextInfo || rawQuoted?.audioMessage?.contextInfo || null;
    let nestedQuoted = null;
    if (cachedQuoted?.quoted) {
      nestedQuoted = cachedQuoted.quoted;
    }
    if (!nestedQuoted) {
      const cachedMsg = cachedQuoted?.message || cachedQuoted?.rawMessage || cachedQuoted;
      const cachedUnwrapped = unwrapMessage(cachedMsg) || cachedMsg;
      const cachedPayload = getMessagePayload(cachedUnwrapped)?.msg;
      const targetInnerContext = innerContextInfo?.quotedMessage ? innerContextInfo : cachedUnwrapped?.contextInfo?.quotedMessage ? cachedUnwrapped.contextInfo : cachedPayload?.contextInfo?.quotedMessage ? cachedPayload.contextInfo : cachedMsg?.extendedTextMessage?.contextInfo?.quotedMessage ? cachedMsg.extendedTextMessage.contextInfo : null;
      if (targetInnerContext?.quotedMessage) {
        const nestedRaw = targetInnerContext.quotedMessage;
        const nestedMsg = unwrapMessage(nestedRaw) || nestedRaw;
        const nestedMediaNode = findMediaNode(nestedMsg);
        const {
          mtype: nMtype,
          msg: parsedNMedia
        } = getMessagePayload(nestedMsg);
        const nMedia = nestedMediaNode || (typeof parsedNMedia === "string" ? {
          text: parsedNMedia,
          conversation: parsedNMedia
        } : parsedNMedia || {});
        const nMimetype = nMedia?.mimetype || nestedMediaNode?.mimetype || "";
        const isNestedMedia = Boolean(nestedMediaNode || nMedia && (/image|video|sticker|audio|document|webp/.test(nMimetype) || nMtype.endsWith("Message")));
        const nMediaType = isNestedMedia ? nestedMediaNode ? resolveMediaType(nestedMediaNode) : nMtype.replace(/Message/gi, "").toLowerCase() : null;
        let nestedSenderRaw = targetInnerContext.participant || targetInnerContext.participantAlt || targetInnerContext.remoteJidAlt || targetInnerContext.remoteJid || "";
        let cleanNestedSender = await resolveLidToJid(decodeJid(nestedSenderRaw), sock, null, groupParticipantsList);
        const nestedIsFromMe = cleanNestedSender ? areJidsSameUser(cleanNestedSender, botId) || (botLid ? areJidsSameUser(cleanNestedSender, botLid) : false) : false;
        const nestedStanzaId = targetInnerContext.stanzaId || "";
        const nestedFakeObj = proto.WebMessageInfo.fromObject({
          key: {
            remoteJid: ctx.id,
            fromMe: nestedIsFromMe,
            id: nestedStanzaId,
            ...ctx.isGroup ? {
              participant: cleanNestedSender
            } : {}
          },
          message: nestedMsg,
          messageTimestamp: Math.floor(Date.now() / 1e3)
        });
        const nestedText = extractMessageText(nestedRaw) || "";
        const nestedSenderNumber = extractNum(cleanNestedSender);
        nestedQuoted = {
          chat: ctx.id,
          from: ctx.id,
          sender: cleanNestedSender,
          senderNumber: nestedSenderNumber,
          id: nestedStanzaId,
          device: detectDevice(nestedStanzaId),
          isBaileys: detectBaileys(nestedStanzaId),
          fromMe: nestedIsFromMe,
          isFromMe: nestedIsFromMe,
          message: nestedMsg,
          rawMessage: nestedRaw,
          fakeObj: nestedFakeObj,
          vM: nestedFakeObj,
          msgType: nMtype,
          mtype: nMtype,
          type: nMtype,
          msg: nMedia,
          media: nMedia,
          text: nestedText,
          body: nestedText,
          contextInfo: targetInnerContext,
          mimetype: nMimetype || null,
          isMedia: isNestedMedia,
          mediaType: nMediaType,
          isViewOnce: Boolean(nestedRaw?.viewOnceMessage || nestedRaw?.viewOnceMessageV2 || nestedRaw?.viewOnceMessageV2Extension || nMedia?.viewOnce),
          fileName: nMedia?.fileName || null,
          fileSize: nMedia?.fileLength ? Number(nMedia.fileLength) : null,
          key: {
            remoteJid: ctx.id,
            fromMe: nestedIsFromMe,
            id: nestedStanzaId,
            participant: cleanNestedSender
          },
          download: async () => downloadMediaNode(nMedia || nestedMsg, nMediaType || "image"),
          copyNForward: async (jid = ctx.chat, forwardingScore = true, options = {}) => copyNForward(sock, jid, nestedFakeObj, forwardingScore, options),
          delete: async () => safeSendMessage(sock, ctx.chat, {
            delete: {
              remoteJid: ctx.id,
              fromMe: nestedIsFromMe,
              id: nestedStanzaId,
              participant: cleanNestedSender
            }
          }),
          getQuotedObj: () => nestedFakeObj
        };
      }
    }
    const quotedRawText = extractMessageText(rawQuoted) || "";
    const quotedText = quotedRawText === "undefined" ? "" : quotedRawText;
    const quotedSenderNumber = extractNum(cleanQuotedSender);
    const isQuotedOwner = checkIsOwner([cleanQuotedSender, quotedSenderNumber]);
    const isQuotedBot = areJidsSameUser(cleanQuotedSender, botId) || botLid && areJidsSameUser(cleanQuotedSender, botLid) || detectBaileys(quotedStanzaId);
    let qPrefix = null;
    if (prefixConfig instanceof RegExp) {
      qPrefix = quotedText.match(prefixConfig)?.[0] || null;
    } else if (Array.isArray(prefixConfig)) {
      qPrefix = prefixConfig.find(p => quotedText.startsWith(p)) || null;
    } else if (typeof prefixConfig === "string" && quotedText.startsWith(prefixConfig)) {
      qPrefix = prefixConfig;
    }
    const qCleanText = qPrefix ? quotedText.slice(qPrefix.length).trim() : quotedText;
    const qParts = qCleanText.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    const isQuotedViewOnce = Boolean(rawQuoted?.viewOnceMessage || rawQuoted?.viewOnceMessageV2 || rawQuoted?.viewOnceMessageV2Extension || qMsg?.viewOnceMessage || qMsg?.viewOnceMessageV2 || qMedia?.viewOnce || false);
    ctx.quoted = {
      chat: ctx.id,
      from: ctx.id,
      sender: cleanQuotedSender,
      senderNumber: quotedSenderNumber,
      id: quotedStanzaId,
      device: detectDevice(quotedStanzaId),
      isBaileys: detectBaileys(quotedStanzaId),
      fromMe: quotedIsFromMe,
      isFromMe: quotedIsFromMe,
      isBot: Boolean(isQuotedBot),
      isOwner: Boolean(quotedIsFromMe || isQuotedOwner || isQuotedBot),
      isROwner: Boolean(isQuotedOwner || quotedIsFromMe),
      mentions: extractMentions(rawQuoted, sock),
      mentionedJid: extractMentions(rawQuoted, sock),
      prefix: qPrefix,
      command: qParts[0]?.toLowerCase() || null,
      cmd: qParts[0]?.toLowerCase() || null,
      args: qParts.slice(1),
      query: qCleanText.slice((qParts[0] || "").length).trim(),
      message: qMsg,
      rawMessage: rawQuoted,
      fakeObj: fakeObj,
      vM: fakeObj,
      quoted: nestedQuoted,
      msgType: qMtype,
      mtype: qMtype,
      type: qMtype,
      msg: qMedia,
      media: qMedia,
      text: quotedText,
      body: quotedText,
      contextInfo: innerContextInfo || contextInfo,
      mimetype: qMimetype || null,
      isMedia: isMediaInQuoted,
      mediaType: qMediaType,
      isViewOnce: isQuotedViewOnce,
      isAnimated: isQuotedAnimated,
      fileName: qMedia?.fileName || null,
      fileSize: qMedia?.fileLength ? Number(qMedia.fileLength) : null,
      key: {
        remoteJid: ctx.id,
        fromMe: quotedIsFromMe,
        id: quotedStanzaId,
        participant: cleanQuotedSender
      },
      download: async () => downloadMediaNode(qMedia || qMsg, qMediaType || "image"),
      copyNForward: async (jid = ctx.chat, forwardingScore = true, options = {}) => copyNForward(sock, jid, fakeObj, forwardingScore, options),
      delete: async () => safeSendMessage(sock, ctx.chat, {
        delete: {
          remoteJid: ctx.id,
          fromMe: quotedIsFromMe,
          id: quotedStanzaId,
          participant: cleanQuotedSender
        }
      }),
      getQuotedObj: () => nestedQuoted ? nestedQuoted : fakeObj
    };
  }
  const mediaContent = ctx.msg;
  const directMime = mediaContent?.mimetype || "";
  const directIsMedia = Boolean(mediaContent && (/image|video|sticker|audio|document|webp/.test(directMime) || ["imageMessage", "videoMessage", "stickerMessage", "audioMessage", "documentMessage", "ptvMessage"].includes(ctx.msgType)));
  const isViewOnce = Boolean(rawMessage?.viewOnceMessage || rawMessage?.viewOnceMessageV2 || rawMessage?.viewOnceMessageV2Extension || m?.viewOnceMessage || m?.viewOnceMessageV2 || m?.viewOnceMessageV2Extension || mediaContent?.viewOnce || false);
  ctx.mimetype = directMime || ctx.quoted?.mimetype || null;
  ctx.isMedia = directIsMedia || (ctx.quoted?.isMedia ?? false);
  ctx.mediaType = directIsMedia ? ctx.msgType?.replace(/Message/gi, "").toLowerCase() : ctx.quoted?.mediaType || null;
  ctx.fileName = mediaContent?.fileName || ctx.quoted?.fileName || null;
  ctx.fileSize = mediaContent?.fileLength ? Number(mediaContent.fileLength) : ctx.quoted?.fileSize || null;
  ctx.isViewOnce = isViewOnce;
  ctx.isAnimated = Boolean(m?.stickerMessage?.isAnimated || mediaContent?.isAnimated || ctx.quoted?.isAnimated || false);
  ctx.media = directIsMedia ? mediaContent : ctx.quoted?.media || null;
  const text = (ctx.text || "").trim();
  let matchedPrefix = null;
  if (prefixConfig instanceof RegExp) {
    matchedPrefix = text.match(prefixConfig)?.[0] || null;
  } else if (Array.isArray(prefixConfig)) {
    matchedPrefix = prefixConfig.find(p => text.startsWith(p)) || null;
  } else if (typeof prefixConfig === "string" && text.startsWith(prefixConfig)) {
    matchedPrefix = prefixConfig;
  }
  ctx.prefix = matchedPrefix;
  if (ctx.prefix) {
    const withoutPrefix = text.slice(ctx.prefix.length).trim();
    const parts = withoutPrefix.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    ctx.cmd = parts[0]?.toLowerCase() || null;
    ctx.command = ctx.cmd;
    ctx.args = parts.slice(1);
    ctx.query = withoutPrefix.slice((parts[0] || "").length).trim();
  } else {
    const parts = text.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(p => p.replace(/^["']|["']$/g, "")) || [];
    ctx.cmd = parts[0]?.toLowerCase() || null;
    ctx.command = ctx.cmd;
    ctx.args = parts.slice(1);
    ctx.query = text.slice((parts[0] || "").length).trim();
  }
  ctx.groupMetadata = async () => {
    if (!ctx.isGroup) return null;
    return await sock.groupMetadata(ctx.chat).catch(() => ({}));
  };
  ctx.getAdminStatus = async () => {
    if (!ctx.isGroup) {
      return {
        isAdmin: false,
        isBotAdmin: false,
        participants: [],
        admins: []
      };
    }
    const meta = await ctx.groupMetadata();
    const participants = meta?.participants || [];
    const adminParticipants = participants.filter(p => p.admin === "admin" || p.admin === "superadmin");
    const adminJidSet = new Set();
    for (const p of adminParticipants) {
      const realP = await resolveLidToJid(p.id || p.lid || p.jid, sock, null, participants);
      if (realP) adminJidSet.add(realP);
    }
    const admins = Array.from(adminJidSet);
    const senderIdentities = [ctx.sender, ctx.senderAlt, ctx.userPhoneJid].filter(Boolean);
    const botIdentities = [botId, botLid].filter(Boolean);
    const isAdmin = adminParticipants.some(p => {
      const pIds = [p.id, p.lid, p.jid].filter(Boolean);
      return pIds.some(pId => senderIdentities.some(sId => areJidsSameUser(pId, sId)));
    });
    const isBotAdmin = adminParticipants.some(p => {
      const pIds = [p.id, p.lid, p.jid].filter(Boolean);
      return pIds.some(pId => botIdentities.some(bId => areJidsSameUser(pId, bId)));
    });
    ctx.isAdmin = isAdmin;
    ctx.isBotAdmin = isBotAdmin;
    ctx.participants = participants;
    ctx.groupAdmins = admins;
    return {
      isAdmin: isAdmin,
      isBotAdmin: isBotAdmin,
      participants: participants,
      admins: admins
    };
  };
  ctx.isAdmin = false;
  ctx.isBotAdmin = false;
  ctx.participants = [];
  ctx.groupAdmins = [];
  ctx.sendMessage = (targetJidOrContent, contentOrOptions = {}, maybeOptions = {}) => {
    if (typeof targetJidOrContent === "string") {
      return safeSendMessage(sock, targetJidOrContent, contentOrOptions, maybeOptions);
    }
    return safeSendMessage(sock, ctx.id, targetJidOrContent, contentOrOptions);
  };
  ctx.reply = (text, options = {}) => {
    const targetChat = !ctx.isGroup && ctx.chat?.endsWith("@lid") ? ctx.sender?.endsWith("@s.whatsapp.net") ? ctx.sender : ctx.chat : ctx.chat;
    const cleanText = typeof text === "string" ? text : text?.text || JSON.stringify(text);
    const mentions = options.mentions || options.mentionedJid || options.contextInfo?.mentionedJid || parseMention(cleanText);
    let safeQuoted = options.quoted !== undefined ? options.quoted : msg?.key ? msg : undefined;
    if (safeQuoted && !ctx.isGroup && safeQuoted.key) {
      safeQuoted = {
        ...safeQuoted,
        key: {
          ...safeQuoted.key,
          remoteJid: targetChat
        }
      };
      delete safeQuoted.key.participant;
      delete safeQuoted.key.participantAlt;
      delete safeQuoted.key.remoteJidAlt;
    }
    return safeSendMessage(sock, targetChat, {
      text: cleanText,
      mentions: mentions,
      ...options
    }, {
      quoted: safeQuoted,
      ...options
    }).catch(() => {
      return safeSendMessage(sock, targetChat, {
        text: cleanText,
        mentions: mentions,
        ...options
      });
    });
  };
  ctx.react = (emoji, key = null) => safeSendMessage(sock, ctx.chat, {
    react: {
      text: emoji,
      key: key || msg.key
    }
  }).catch(() => null);
  ctx.delete = (customKey = null) => safeSendMessage(sock, ctx.chat, {
    delete: customKey || msg.key
  }).catch(() => null);
  ctx.edit = (text, options = {}) => safeSendMessage(sock, ctx.chat, {
    text: text,
    edit: msg.key,
    ...options
  });
  ctx.forward = (jid, options = {}) => safeSendMessage(sock, jid, {
    forward: msg,
    ...options
  });
  ctx.sendPoll = async (name = "", values = [], options = {}) => {
    const pollValues = Array.isArray(values) ? values.map(v => typeof v === "string" ? v : String(v)).filter(Boolean) : [String(values)];
    return await safeSendMessage(sock, options.jid || ctx.chat, {
      poll: {
        name: name,
        values: pollValues,
        selectableCount: options.selectableCount || 1,
        toAnnouncementGroup: options.toAnnouncementGroup || false
      }
    }, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendPayment = async (amount = 1e4, currency = "IDR", note = "Payment Note", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat);
    const userJid = sock.user?.id ? decodeJid(sock.user.id) : sock.user?.jid || "";
    let backgroundFile = undefined;
    if (options.image) {
      backgroundFile = Buffer.isBuffer(options.image) ? options.image : {
        url: options.image
      };
    }
    const messageContent = proto.Message.fromObject({
      requestPaymentMessage: {
        amount: {
          currencyCode: currency,
          offset: 0,
          value: amount
        },
        expiryTimestamp: 0,
        amount1000: Math.floor(amount * 1e3),
        currencyCodeIso4217: currency,
        requestFrom: options.from || "13135550002@s.whatsapp.net",
        noteMessage: {
          extendedTextMessage: {
            text: note
          }
        },
        background: backgroundFile
      }
    });
    const messager = await generateWAMessageFromContent(jid, messageContent, {
      userJid: userJid,
      quoted: options.quoted || (msg?.key ? msg : undefined),
      upload: sock?.waUploadToServer || sock?.waUp,
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(sock, jid, messager.message, {
      messageId: messager.key.id,
      ...options
    });
    return messager;
  };
  ctx.sendEvent = async (name = "acara", description = "acara iya", joinLink = "https://call.whatsapp.com/voice/lRW39aOiDh96wmNtLouWyC", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat || ctx.id);
    const nowInSeconds = Math.floor(Date.now() / 1e3);
    const startTime = String(options.startTime || nowInSeconds + 3600);
    const endTime = String(options.endTime || nowInSeconds + 10800);
    const reminderOffsetSec = String(options.reminderOffsetSec || 3600);
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          eventMessage: {
            isCanceled: Boolean(options.isCanceled || false),
            name: String(name || "acara"),
            description: String(description || "acara iya"),
            joinLink: String(joinLink || "https://call.whatsapp.com/voice/lRW39aOiDh96wmNtLouWyC"),
            startTime: startTime,
            endTime: endTime,
            extraGuestsAllowed: options.extraGuestsAllowed !== false,
            isScheduleCall: Boolean(options.isScheduleCall || false),
            hasReminder: options.hasReminder !== false,
            reminderOffsetSec: reminderOffsetSec,
            contextInfo: {
              ...options.contextInfo
            }
          }
        }
      }
    });
    const msgEvent = await generateWAMessageFromContent(jid, messageContent, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(sock, jid, msgEvent.message, {
      messageId: msgEvent.key.id,
      ...options
    });
    return msgEvent;
  };
  ctx.requestContact = async (body = "Harap bagikan informasi kontak Anda", options = {}) => {
    const jid = decodeJid(options.jid || ctx.chat || ctx.id);
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
              text: String(body)
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: options.footer || ""
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              title: options.title || "",
              subtitle: options.subtitle || "",
              hasMediaAttachment: false
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [{
                name: "request_contact_info",
                buttonParamsJson: "{}"
              }],
              messageParamsJson: "{}"
            }),
            contextInfo: {
              ...options.contextInfo
            }
          })
        }
      }
    });
    const msgsr = await generateWAMessageFromContent(jid, messageContent, {
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
      ...options
    });
    await safeRelayInteractive(sock, jid, msgsr.message, {
      messageId: msgsr.key.id,
      ...options
    });
    return msgsr;
  };
  ctx.sendButtonsMessage = async (params = {}) => {
    const jid = decodeJid(params.jid || ctx.chat);
    const mentions = params.mentions || params.mentionedJid || params.contextInfo?.mentionedJid || parseMention(params.text || params.contentText || "");
    const messageContent = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
          },
          buttonsMessage: {
            locationMessage: params.locationMessage || undefined,
            imageMessage: params.imageMessage || undefined,
            videoMessage: params.videoMessage || undefined,
            documentMessage: params.documentMessage || undefined,
            contentText: params.text || params.contentText || "",
            footerText: params.footer || params.footerText || global.bot?.footer || "",
            buttons: params.buttons || [],
            headerType: params.headerType || (params.locationMessage ? 6 : 1),
            contextInfo: {
              ...params.contextInfo,
              mentionedJid: mentions
            }
          }
        }
      }
    });
    const generated = await generateWAMessageFromContent(jid, messageContent, {
      userJid: sock.user?.id,
      quoted: params.quoted || (msg?.key ? msg : undefined),
      ...params
    });
    await safeRelayInteractive(sock, jid, generated.message, {
      messageId: generated.key.id,
      ...params
    });
    return generated;
  };
  ctx.sendButtonLocation = async (title, text, footer, location = {}, buttons = [], options = {}) => {
    let jpegThumbnail = null;
    const thumbTarget = location.thumbnail || location.image || location.thumb || location.jpegThumbnail || location.thumbnailUrl;
    if (thumbTarget) {
      jpegThumbnail = await resizeImage(thumbTarget, 300, 150, "image/jpeg");
    }
    const formattedButtons = (buttons || []).map(b => {
      if (b.nativeFlowInfo) return b;
      if (b.name === "single_select" || b.sections) {
        return {
          buttonId: b.id || "select_menu",
          buttonText: {
            displayText: b.title || b.display_text || "Pilih Menu"
          },
          nativeFlowInfo: {
            name: "single_select",
            paramsJson: JSON.stringify({
              title: b.title || "Pilih Menu",
              sections: b.sections || []
            })
          },
          type: 1
        };
      }
      return {
        buttonId: b.id || b.buttonId || b.displayText || "button_id",
        buttonText: {
          displayText: b.display_text || b.displayText || b.text || "Klik"
        },
        type: 1
      };
    });
    return await ctx.sendButtonsMessage({
      jid: options.jid || ctx.chat,
      locationMessage: {
        degreesLatitude: location.degreesLatitude || 0,
        degreesLongitude: location.degreesLongitude || 0,
        name: location.name || title || global.bot?.name || "Location Card",
        address: location.address || `📍 ${new Date().toLocaleDateString("id-ID")}`,
        jpegThumbnail: jpegThumbnail
      },
      text: text,
      footer: footer,
      buttons: formattedButtons,
      headerType: 6,
      quoted: options.quoted || (msg?.key ? msg : undefined),
      ...options
    });
  };
  ctx.sendCta = async (body = "", footer = "", buttons = [], options = {}, retries = 2) => {
    const rawJid = options.jid || ctx.chat || ctx.id;
    let jid = decodeJid(rawJid);
    if (!ctx.isGroup && jid?.endsWith("@lid") && ctx.userPhoneJid && !ctx.userPhoneJid.endsWith("@lid")) {
      jid = ctx.userPhoneJid;
    }
    const upload = sock?.waUploadToServer || sock?.waUp;
    let preparedMedia = null;
    let locationHeader = null;
    try {
      const allText = `${body} ${options.title || options.header || ""}`;
      const mentions = Array.isArray(options.mentions) ? options.mentions : Array.isArray(options.mentionedJid) ? options.mentionedJid : Array.isArray(options.contextInfo?.mentionedJid) ? options.contextInfo.mentionedJid : typeof allText === "string" ? [...allText.matchAll(/@([0-9]{5,16})/g)].map(v => `${v[1]}@s.whatsapp.net`) : [];
      const loc = options.locationMessage || options.location;
      if (loc && typeof loc === "object") {
        let jpegThumb = loc.jpegThumbnail || loc.thumbnail || loc.image || null;
        if (typeof jpegThumb === "string") {
          if (/^https?:\/\//i.test(jpegThumb)) {
            jpegThumb = await resizeImage(jpegThumb, 300, 150, "image/jpeg").catch(() => null);
          } else {
            try {
              jpegThumb = Buffer.from(jpegThumb.replace(/^data:image\/[a-z]+;base64,/, ""), "base64");
            } catch {
              jpegThumb = null;
            }
          }
        }
        if (jpegThumb && Buffer.isBuffer(jpegThumb)) {
          if (jpegThumb.length > 70 * 1024) {
            jpegThumb = await resizeImage(jpegThumb, 300, 150, "image/jpeg").catch(() => jpegThumb);
          }
        }
        locationHeader = {
          degreesLatitude: Number(loc.degreesLatitude) || 0,
          degreesLongitude: Number(loc.degreesLongitude) || 0,
          name: loc.name || options.title || "",
          address: loc.address || "",
          url: loc.url || "",
          jpegThumbnail: jpegThumb || undefined
        };
      }
      if (!locationHeader && (options.media || options.image || options.video || options.document)) {
        const mediaTarget = options.media || options.image || options.video || options.document;
        const isVideo = options.video || options.mediaType === "video" || /video/i.test(options.mime || "");
        const isDocument = options.document || options.mediaType === "document" || /document|pdf/i.test(options.mime || "");
        let mediaPayload = mediaTarget;
        if (typeof mediaPayload === "string" && /^https?:\/\//i.test(mediaPayload)) {
          mediaPayload = {
            url: mediaPayload
          };
        }
        const mediaType = isDocument ? "document" : isVideo ? "video" : "image";
        preparedMedia = await prepareWAMessageMedia({
          [mediaType]: mediaPayload
        }, {
          upload: upload,
          ...options
        }).catch(() => null);
      }
      let headerPayload = {};
      if (locationHeader) {
        headerPayload = {
          title: typeof options.header === "string" ? options.header : options.title || "",
          subtitle: options.subtitle || "",
          hasMediaAttachment: true,
          locationMessage: locationHeader
        };
      } else if (typeof options.header === "object" && options.header !== null) {
        headerPayload = {
          hasMediaAttachment: Boolean(options.header.hasMediaAttachment ?? preparedMedia),
          ...options.header,
          ...preparedMedia
        };
      } else {
        headerPayload = {
          title: options.title || options.header || "",
          subtitle: options.subtitle || "",
          hasMediaAttachment: Boolean(preparedMedia),
          ...preparedMedia
        };
      }
      const messageContent = proto.Message.fromObject({
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({
                text: String(body || "")
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: String(footer || "")
              }),
              header: proto.Message.InteractiveMessage.Header.create(headerPayload),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: formatCtaButtons(buttons),
                messageParamsJson: typeof options.params === "string" ? options.params : JSON.stringify(options.params || {})
              }),
              contextInfo: {
                ...options.contextInfo || {},
                mentionedJid: mentions
              }
            })
          }
        }
      });
      const msgsr = await generateWAMessageFromContent(jid, messageContent, {
        quoted: options.quoted || (msg?.key ? msg : undefined),
        ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
        ...options
      });
      await safeRelayInteractive(sock, jid, msgsr.message, {
        messageId: msgsr.key.id,
        ...options
      });
      return msgsr;
    } catch (err) {
      const errorMsg = String(err?.message || "").toLowerCase();
      const statusCode = err?.output?.statusCode || err?.status;
      if (retries > 0 && (statusCode === 428 || statusCode === 499 || statusCode === 515 || errorMsg.includes("closed") || errorMsg.includes("precondition"))) {
        await sleep(1200);
        return await ctx.sendCta(body, footer, buttons, options, retries - 1);
      }
      console.error(chalk.red("[sendCta Error / Connection Issue]"), err?.message || err);
      try {
        return await sock.sendMessage(jid, {
          text: `${options.title ? `*〔 ${options.title} 〕*\n\n` : ""}${body}\n\n_${footer}_`,
          mentions: mentions
        }, {
          quoted: options.quoted || (msg?.key ? msg : undefined)
        });
      } catch {
        return null;
      }
    }
  };
  ctx.sendButton = async (text = "", footer = "", media = null, buttons = [], options = {}) => {
    return await ctx.sendCta(text, footer, buttons, {
      media: media,
      ...options
    });
  };
  ctx.sendList = async (title = "", text = "", footer = "", buttonText = "Pilih Opsi", listSections = [], options = {}) => {
    return await ctx.sendLists(title, text, footer, null, buttonText, listSections, options);
  };
  ctx.sendLists = async (title = "", text = "", footer = "", media = null, buttonText = "Pilih Menu", listSections = [], options = {}) => {
    let sections = [];
    if (Array.isArray(listSections?.[0]) && typeof listSections?.[0]?.[0] === "string") {
      sections = listSections.map(section => ({
        title: section?.[0] || "",
        rows: (section?.[1] || []).map(row => ({
          title: row?.[0] || "",
          id: row?.[1] || row?.[0] || "",
          description: row?.[2] || ""
        }))
      }));
    } else {
      sections = (listSections || []).map(section => ({
        title: section.title || "",
        rows: (section.rows || []).map(row => ({
          title: row.title || row.id || "",
          id: row.id || row.rowId || row.title || "",
          description: row.description || ""
        }))
      }));
    }
    return await ctx.sendCta(text, footer, [{
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: buttonText,
        sections: sections,
        has_multiple_buttons: true
      })
    }], {
      title: title,
      media: media,
      ...options
    });
  };
  ctx.sendSlide = async (text = "", footer = "", slides = [], options = {}) => {
    const carousel = new Carousel(sock).setBody(text).setFooter(footer);
    for (const item of slides) {
      if (Array.isArray(item)) {
        const [cardBody = "", cardFooter = "", header = "", mediaUrl, buttons = []] = item;
        const card = carousel.createCard().setHeader(header).setBody(cardBody).setFooter(cardFooter);
        if (mediaUrl) card.setMedia(mediaUrl);
        (buttons || []).forEach(b => {
          if (Array.isArray(b)) {
            const [btnText, btnId, type = "quick_reply"] = b;
            if (type === "cta_url") card.addUrl(btnText, btnId);
            else if (type === "cta_copy") card.addCopy(btnText, btnId);
            else if (type === "cta_call") card.addCall(btnText, btnId);
            else card.addReply(btnText, btnId);
          }
        });
      }
    }
    return await carousel.run(options.jid || ctx.chat, sock, options.quoted || (msg?.key ? msg : undefined), options);
  };
  ctx.sendButtonCta = async (messages = [], options = {}) => {
    return await ctx.sendCarousel("", "", "", messages, options);
  };
  ctx.ctaButton = () => new CtaButtonBuilder(sock, ctx.chat, msg?.key ? msg : undefined);
  ctx.aiRich = () => new AIRich(sock);
  ctx.carousel = () => new Carousel(sock);
  ctx.card = () => new CarouselCard();
  ctx.sendCode = async (code, language = "javascript", options = {}) => {
    if (typeof language === "object" && language !== null) {
      options = language;
      language = options.language || "javascript";
    }
    let disclaimerText = "";
    let textBefore = "";
    let textAfter = "";
    let customJid = ctx.chat;
    let customQuoted = msg?.key ? msg : undefined;
    if (typeof options === "string") {
      disclaimerText = options;
    } else if (typeof options === "object" && options !== null) {
      disclaimerText = options.disclaimerText || options.disclaimer || options.title || "";
      textBefore = options.textBefore || options.header || "";
      textAfter = options.textAfter || options.footer || "";
      if (options.jid) customJid = options.jid;
      if (options.quoted) customQuoted = options.quoted;
    }
    const rich = new AIRich(sock);
    if (disclaimerText) rich.setTitle(disclaimerText);
    if (textBefore) rich.addText(textBefore);
    rich.addCode(String(language || "javascript"), String(code || ""));
    if (textAfter) rich.addText(textAfter);
    return await rich.send(customJid, {
      quoted: customQuoted,
      forwarded: options.forwarded !== false,
      ...typeof options === "object" ? options : {}
    });
  };
  ctx.sendCarousel = async (text = "", footer = "", text2 = "", messages = [], options = {}) => {
    if (Array.isArray(messages) && messages.length > 0) {
      const carousel = new Carousel(sock).setTitle(text).setSubtitle(text2 || text).setFooter(footer);
      for (const item of messages) {
        if (Array.isArray(item)) {
          const [cardText = "", cardFooter = "", buffer, buttons = [], copy = [], urls = [], list = []] = item;
          const card = carousel.createCard().setHeader(text2, cardText).setBody(cardText).setFooter(cardFooter);
          if (buffer) card.setMedia(buffer);
          (buttons || []).forEach(([btnText, id]) => card.addReply(btnText, id));
          (copy || []).forEach(([copyText]) => card.addCopy("Copy", copyText));
          (urls || []).forEach(([urlText, url]) => card.addUrl(urlText, url));
          (list || []).forEach(([listTitle, sections]) => card.addList(listTitle, sections));
        } else if (item instanceof CarouselCard) {
          carousel.addCard(item);
        }
      }
      return await carousel.run(ctx.chat, sock, msg?.key ? msg : undefined, options);
    }
    return null;
  };
  ctx.sendRich = async (params = {}) => {
    const options = typeof params === "string" ? {
      html: params
    } : params || {};
    const {
      title = "Interactive App",
        html = "",
        trustedSources = ["example.com"],
        sourceUrl = "https://example.com",
        tabTitle = "App View",
        buttonTitle = "Open Full Screen 🌐",
        botJid = "13135550002@s.whatsapp.net",
        disclaimer = "",
        quoted = null,
        jid = ctx.chat
    } = options;
    try {
      const uuid = crypto.randomUUID ? crypto.randomUUID() : `screen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const trusted = Array.isArray(trustedSources) && trustedSources.length > 0 ? trustedSources : ["example.com"];
      const payloadData = {
        response_id: uuid,
        sections: [{
          __typename: "GenAIUnifiedResponseSection",
          view_model: {
            __typename: "GenAISingleLayoutViewModel",
            primitive: {
              __typename: "GenAIBotProgressStatusPrimitive",
              title: buttonTitle || title,
              is_in_progress: false
            }
          }
        }],
        embedded_screens: [{
          title: title || "Full Screen App",
          content: [{
            __typename: "FOAIDNixelButtonSheets",
            tabs: [{
              id: "tab_0",
              tab_header: tabTitle || "Main View",
              sections: [{
                __typename: "GenAIUnifiedResponseSection",
                view_model: {
                  __typename: "GenAISingleLayoutViewModel",
                  primitive: {
                    __typename: "GenAIaeacdsnwHtmlPrimitive",
                    payload: html || `<h2 style="font-family:sans-serif;text-align:center;padding:20px;">${title}</h2>`,
                    url: sourceUrl,
                    trusted_sources: trusted
                  }
                }
              }],
              step_entries: []
            }]
          }]
        }]
      };
      const finalQuoted = quoted || (msg?.key ? msg : undefined);
      const quotedParticipant = finalQuoted?.key?.participantAlt || finalQuoted?.key?.participant || finalQuoted?.sender || undefined;
      const contextInfo = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedAiBotMessageInfo: {
          botJid: botJid
        },
        forwardOrigin: 4,
        ...finalQuoted?.key ? {
          stanzaId: finalQuoted.key.id,
          participant: quotedParticipant,
          quotedMessage: finalQuoted.message || finalQuoted.fakeObj?.message || undefined
        } : {},
        ...options.contextInfo || {}
      };
      const submessages = [{
        messageType: 2,
        messageText: buttonTitle ? `${buttonTitle}\n\n*${title}*` : title
      }];
      const richResponseMessage = proto.AIRichResponseMessage.create({
        messageType: proto.AIRichResponseMessageType?.AI_RICH_RESPONSE_TYPE_STANDARD ?? 1,
        submessages: submessages,
        unifiedResponse: {
          data: Buffer.from(JSON.stringify(payloadData), "utf-8")
        },
        contextInfo: contextInfo
      });
      const botForwardedMessage = Baileys.wrapToBotForwardedMessage ? Baileys.wrapToBotForwardedMessage(richResponseMessage) : {
        botForwardedMessage: {
          message: {
            richResponseMessage: richResponseMessage
          }
        },
        messageContextInfo: {
          botMetadata: {
            messageDisclaimerText: disclaimer || title,
            botResponseId: uuid,
            richResponseSourcesMetadata: {}
          }
        }
      };
      if (botForwardedMessage.messageContextInfo?.botMetadata) {
        botForwardedMessage.messageContextInfo.botMetadata.messageDisclaimerText = disclaimer || title;
        botForwardedMessage.messageContextInfo.botMetadata.botResponseId = uuid;
      }
      const messageId = options.messageId || "3EB0" + crypto.randomBytes(8).toString("hex").toUpperCase();
      return await safeRelayInteractive(sock, jid, botForwardedMessage, {
        messageId: messageId,
        ...options
      });
    } catch (err) {
      console.error(chalk.red("[ctx.sendRich Error]"), err?.message || err);
      return await ctx.reply(`*〔 ${title} 〕*\n\n${disclaimer ? `_${disclaimer}_\n\n` : ""}${buttonTitle}`);
    }
  };
  ctx.sendContact = async (targetJidOrData, maybeData = null, maybeQuoted = null, options = {}) => {
    let jid = ctx.chat;
    let data = targetJidOrData;
    let quoted = maybeQuoted || (msg?.key ? msg : undefined);
    if (typeof targetJidOrData === "string" && targetJidOrData.includes("@")) {
      jid = targetJidOrData;
      data = maybeData;
    } else if (maybeData && typeof maybeData === "object" && !Array.isArray(maybeData)) {
      options = maybeData;
      quoted = options.quoted || (msg?.key ? msg : undefined);
    }
    if (!Array.isArray(data)) return null;
    if (!Array.isArray(data[0]) && typeof data[0] === "string") data = [data];
    let contacts = [];
    for (let [number, name] of data) {
      if (!number) continue;
      const cleanNumber = String(number).replace(/[^0-9]/g, "");
      const njid = cleanNumber + "@s.whatsapp.net";
      const displayName = String(name || cleanNumber);
      let biz = {};
      try {
        if (typeof sock.getBusinessProfile === "function") {
          biz = await sock.getBusinessProfile(njid) || {};
        }
      } catch {}
      let photoBase64 = "";
      if (biz.description) {
        try {
          const ppUrl = await sock.profilePictureUrl(njid, "image");
          if (ppUrl) {
            const res = await axios.get(ppUrl, {
              responseType: "arraybuffer"
            });
            photoBase64 = Buffer.from(res.data).toString("base64");
          }
        } catch {}
      }
      let vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${displayName.replace(/\n/g, "\\n")}`, "ORG:", `item1.TEL;waid=${cleanNumber}:+${cleanNumber}`, "item1.X-ABLabel:Ponsel", biz.email ? `item2.EMAIL;type=INTERNET:${(biz.email || "").replace(/\n/g, "\\n")}` : "", biz.email ? "item2.X-ABLabel:Email" : "", photoBase64 ? `PHOTO;BASE64:${photoBase64}` : "", biz.description ? `X-WA-BIZ-DESCRIPTION:${(biz.description || "").replace(/\n/g, "\\n")}` : "", `X-WA-BIZ-NAME:${displayName.replace(/\n/g, "\\n")}`, "END:VCARD"].filter(Boolean).join("\n").trim();
      contacts.push({
        vcard: vcard,
        displayName: displayName
      });
    }
    return await safeSendMessage(sock, jid, {
      ...options,
      contacts: {
        ...options,
        displayName: contacts.length >= 2 ? `${contacts.length} kontak` : contacts[0]?.displayName || null,
        contacts: contacts
      }
    }, {
      quoted: quoted,
      ...options
    });
  };
  ctx.download = async (customMedia = null) => {
    try {
      if (customMedia) return await downloadMediaNode(customMedia);
      if (ctx.quoted?.isMedia || ctx.quoted?.msg) {
        const qBuf = await downloadMediaNode(ctx.quoted.msg || ctx.quoted.message || ctx.quoted.rawMessage);
        if (qBuf) return qBuf;
      }
      if (ctx.isMedia || ctx.msg) {
        const mBuf = await downloadMediaNode(ctx.msg || ctx.message || ctx.rawMessage);
        if (mBuf) return mBuf;
      }
      return null;
    } catch (err) {
      console.error(chalk.red("[ctx.download Error]"), err?.message || err);
      return null;
    }
  };
  ctx.getName = (jid = ctx.sender) => {
    const id = lidToJid(decodeJid(jid || ctx.sender || ""), sock);
    if (!id) return "Unknown";
    const c = sock.contacts?.[id] || sock.store?.contacts?.[id] || sock.chats?.[id] || sock.store?.chats?.[id] || {};
    return cleanId(id) === cleanId(ctx.sender) && (ctx.pushname || ctx.pushName) || cleanId(id) === cleanId(botId) && (sock.user?.name || sock.user?.pushname) || c.name || c.notify || c.verifiedName || c.subject || extractNum(id) || "Unknown";
  };
  ctx.appendTextMessage = async (text, chatUpdate = {}) => {
    return await appendTextMessage(sock, msg, text, chatUpdate);
  };
  ctx.copyNForward = (jid = ctx.chat, targetMessage = msg, forwardingScore = true, options = {}, customQuoted = undefined) => {
    return copyNForward(sock, jid, targetMessage, forwardingScore, options, customQuoted);
  };
  ctx.vM = proto.WebMessageInfo.fromObject({
    key: ctx.key,
    message: ctx.rawMessage,
    messageTimestamp: ctx.messageTimestamp
  });
  const resolveQuotedFromStore = async targetId => {
    if (!targetId) return null;
    const store = global.msgStore || (typeof msgStore !== "undefined" ? msgStore : null);
    if (!store) return null;
    let cached = store.get(targetId);
    if (!cached) {
      for (const [k, v] of store.entries()) {
        if (k === targetId || v?.key?.id === targetId || v?.id === targetId) {
          cached = v;
          break;
        }
      }
    }
    if (cached) {
      if (cached.quoted !== undefined && cached.sender !== undefined) {
        return cached;
      }
      const rawTarget = cached.fakeObj || cached.vM || cached.msg || (cached.key ? cached : null);
      if (rawTarget) {
        return await SerializeMessage(sock, rawTarget);
      }
    }
    return null;
  };
  ctx.getQuotedObj = async () => {
    if (!ctx.quoted?.id) return null;
    const res = await resolveQuotedFromStore(ctx.quoted.id);
    return res || ctx.quoted;
  };
  if (ctx.quoted) {
    ctx.quoted.getQuotedObj = async () => {
      if (ctx.quoted.quoted) return ctx.quoted.quoted;
      const res = await resolveQuotedFromStore(ctx.quoted.id);
      return res?.quoted || res || ctx.quoted;
    };
  }
  if (ctx.key?.id) {
    global.msgStore.set(ctx.key.id, ctx);
  }
  return ctx;
}