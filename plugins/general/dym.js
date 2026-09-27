import similarity from "similarity";
global.didYouMeanCooldown = global.didYouMeanCooldown || new Map();
export default {
  name: "didyoumean",
  aliases: ["dym"],
  description: "Mendeteksi salah ketik perintah satu kata dengan rekomendasi hingga 5 pilihan",
  category: "Handler",
  execute: async () => {},
  before: async (msg, {
    sock,
    ctx,
    cmd
  }) => {
    try {
      if (!ctx || ctx.isFromMe || ctx.isBot) return;
      const rawText = (ctx.text || ctx.body || "").trim();
      if (!rawText) return;
      const prefixConfig = global.bot?.prefix || global.bot?.defaultPrefix || ["!", ".", "/", "#"];
      let usedPrefix = ctx.prefix || "";
      let hasPrefix = Boolean(usedPrefix);
      if (!hasPrefix) {
        if (prefixConfig instanceof RegExp) {
          const match = rawText.match(prefixConfig);
          if (match && rawText.startsWith(match[0])) {
            usedPrefix = match[0];
            hasPrefix = true;
          }
        } else if (Array.isArray(prefixConfig)) {
          for (const p of prefixConfig) {
            if (rawText.startsWith(p)) {
              usedPrefix = p;
              hasPrefix = true;
              break;
            }
          }
        } else if (typeof prefixConfig === "string" && rawText.startsWith(prefixConfig)) {
          usedPrefix = prefixConfig;
          hasPrefix = true;
        }
      }
      const textToParse = hasPrefix ? rawText.slice(usedPrefix.length).trim() : rawText;
      const parts = textToParse.split(/\s+/).filter(Boolean);
      if (parts.length !== 1) return;
      const inputCmd = parts[0].toLowerCase().trim();
      const cleanInput = inputCmd.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (!cleanInput || cleanInput.length < 2 || cleanInput.length > 25 || /^\d+$/.test(cleanInput)) {
        return;
      }
      if (/^(.)\1{2,}$/.test(cleanInput)) return;
      if (/^https?:\/\//i.test(inputCmd)) return;
      const loaderObj = cmd || global.cmd || global.loader;
      if (!loaderObj) return;
      const commandMap = new Map();
      if (typeof loaderObj.getCommandsByCategory === "function") {
        const cats = loaderObj.getCommandsByCategory();
        for (const list of Object.values(cats)) {
          for (const c of list || []) {
            const name = (c?.name || c)?.toLowerCase?.();
            if (name) {
              commandMap.set(name, name);
              if (Array.isArray(c?.aliases)) {
                for (const a of c.aliases) commandMap.set(a.toLowerCase(), name);
              }
            }
          }
        }
      } else if (loaderObj.commands instanceof Map) {
        for (const [k, v] of loaderObj.commands.entries()) {
          commandMap.set(k.toLowerCase(), k.toLowerCase());
          if (Array.isArray(v?.aliases)) {
            for (const a of v.aliases) commandMap.set(a.toLowerCase(), k.toLowerCase());
          }
        }
      } else if (typeof loaderObj.commands === "object" && loaderObj.commands !== null) {
        for (const [k, v] of Object.entries(loaderObj.commands)) {
          commandMap.set(k.toLowerCase(), k.toLowerCase());
          if (Array.isArray(v?.aliases)) {
            for (const a of v.aliases) commandMap.set(a.toLowerCase(), k.toLowerCase());
          }
        }
      }
      if (commandMap.has(inputCmd) || commandMap.has(cleanInput)) return;
      const allTargets = Array.from(commandMap.keys());
      if (allTargets.length === 0) return;
      const chatId = ctx.chat || ctx.id;
      const sender = ctx.sender;
      const cooldownKey = `dym_${chatId}_${sender}`;
      const now = Date.now();
      const lastTime = global.didYouMeanCooldown.get(cooldownKey) || 0;
      if (now - lastTime < 3500) return;
      const minSimilarity = hasPrefix ? .58 : .65;
      const matches = [];
      for (const target of allTargets) {
        const cleanTarget = target.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (!cleanTarget || cleanTarget.length < 2) continue;
        if (cleanInput[0] !== cleanTarget[0]) continue;
        const score = similarity(cleanInput, cleanTarget);
        if (score >= minSimilarity && score < 1) {
          matches.push({
            target: target,
            canonical: commandMap.get(target),
            rating: score
          });
        }
      }
      if (matches.length === 0) return;
      global.didYouMeanCooldown.set(cooldownKey, now);
      matches.sort((a, b) => b.rating - a.rating);
      const uniqueMatches = [];
      const seen = new Set();
      for (const m of matches) {
        if (!seen.has(m.target)) {
          seen.add(m.target);
          uniqueMatches.push(m);
        }
        if (uniqueMatches.length >= 5) break;
      }
      if (uniqueMatches.length === 0) return;
      const best = uniqueMatches[0];
      const displayPrefix = hasPrefix ? usedPrefix : global.bot?.noprefix ? "" : ".";
      if (typeof ctx.react === "function") await ctx.react("🤔").catch(() => {});
      const bodyText = `Perintah *"${hasPrefix ? usedPrefix : ""}${inputCmd}"* tidak ditemukan.\n` + `Mungkin maksud kamu: *${displayPrefix}${best.target}* (${(best.rating * 100).toFixed(0)}% cocok)\n\n` + `_Lihat ${uniqueMatches.length} daftar rekomendasi perintah di bawah:_`;
      const footerText = global.bot?.name || "WhatsApp Bot";
      let sent = false;
      if (typeof ctx.sendCta === "function") {
        try {
          const rows = uniqueMatches.map((item, idx) => ({
            id: `${displayPrefix}${item.target}`,
            title: `${idx + 1}. ${displayPrefix}${item.target}`,
            description: `Tingkat kecocokan: ${(100 * item.rating).toFixed(0)}%`
          }));
          const buttons = [{
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: `⚡ Jalankan ${displayPrefix}${best.target}`,
              id: `${displayPrefix}${best.target}`
            })
          }, {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
              title: "Pilih Saran (Top 5)",
              sections: [{
                title: `REKOMENDASI PERINTAH (${uniqueMatches.length} OPSI)`,
                rows: rows
              }]
            })
          }];
          await ctx.sendCta(bodyText, footerText, buttons, {
            jid: chatId,
            params: {
              bottom_sheet: {
                in_thread_buttons_limit: 2,
                divider_indices: [1],
                list_title: "Daftar Rekomendasi Command",
                button_title: `Lihat Rekomendasi (${uniqueMatches.length})`
              }
            },
            quoted: msg
          });
          sent = true;
        } catch (_) {}
      }
      if (!sent) {
        let fallbackText = `Perintah *"${hasPrefix ? usedPrefix : ""}${inputCmd}"* tidak ditemukan.\n\n` + `*💡 Rekomendasi Perintah Terkait:*\n`;
        fallbackText += uniqueMatches.map((s, idx) => `  ${idx + 1}. 👉 *${displayPrefix}${s.target}* _(${(s.rating * 100).toFixed(0)}% mirip)_`).join("\n");
        fallbackText += `\n\n_Ketik salah satu perintah yang disarankan di atas._`;
        await ctx.reply(fallbackText, {
          quoted: msg
        });
      }
      return true;
    } catch (_) {}
  }
};