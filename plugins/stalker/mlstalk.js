/**
 * Source  : https://github.com/XZEERH/KumpulanScraper/blob/main/scrape-stalkml.js
 * Feature : Stalk Mobile Legends
 * Type    : Plugins | ESM Modules
 * Recode  : DennCode
 * 
 * Original scraper by XZEERH
 * Di-remake ke ESM plugins oleh DennCode
 */
import { sendFakeQuoted } from '../../lib/fakequoted.js';
const USER_AGENT = 'mlbb-stalker/1.0.0 (+public account lookup)';
const MAX_NICKNAME = 64;
const ENDPOINTS = {
    isanFind: 'https://mlbb-api.isan.eu.org/find',
    isanNickname: 'https://api.isan.eu.org/nickname/ml',
    gopay: 'https://gopay.co.id/games/v1/order/user-account'
};

const COUNTRY_NAMES = {
    AE: 'United Arab Emirates', AR: 'Argentina', AU: 'Australia', BD: 'Bangladesh',
    BN: 'Brunei', BR: 'Brazil', CL: 'Chile', CN: 'China', CO: 'Colombia',
    DE: 'Germany', ES: 'Spain', FR: 'France', GB: 'United Kingdom', HK: 'Hong Kong',
    ID: 'Indonesia', IN: 'India', IT: 'Italy', JP: 'Japan', KH: 'Cambodia',
    KR: 'South Korea', LA: 'Laos', MM: 'Myanmar', MX: 'Mexico', MY: 'Malaysia',
    PE: 'Peru', PH: 'Philippines', PK: 'Pakistan', RU: 'Russia', SA: 'Saudi Arabia',
    SG: 'Singapore', TH: 'Thailand', TL: 'Timor-Leste', TR: 'Turkey', TW: 'Taiwan',
    US: 'United States', VN: 'Vietnam'
};
const COUNTRY_CODES = Object.fromEntries(Object.entries(COUNTRY_NAMES).map(([c, n]) => [n.toLowerCase(), c]));
const reply = (denn, m, text) => sendFakeQuoted(denn, m, text, {
    title: 'Stalk MLBB',
    body: 'Mobile Legends: Bang Bang'
});

function cleanNickname(v) {
    if (v == null) return null;
    let t = String(v).trim().replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    return Array.from(t).slice(0, MAX_NICKNAME).join('');
}
function truncate(v, max = 300) {
    const t = v == null ? '' : String(v);
    return t.length <= max ? t : t.slice(0, max - 1) + '…';
}
function norm(v) { return v == null ? '' : String(v).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase(); }
function countryCode(v) {
    if (v == null) return null;
    const t = String(v).trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(t)) return null;
    if (t === 'UK') return 'GB'; if (t === 'USA') return 'US'; if (t === 'UAE') return 'AE';
    return t;
}
function countryName(code) { return COUNTRY_NAMES[code] || null; }
function countryFromName(name) { return COUNTRY_CODES[norm(name)] || null; }
function decodeForm(v) { const t = String(v).replace(/\+/g, '%20'); try { return decodeURIComponent(t); } catch { return t; } }
function stripHtml(v) {
    return String(v).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, ' ').trim();
}
function parseJson(t) {
    if (t == null) return null;
    const b = String(t).replace(/^\uFEFF/, '').trim(); if (!b) return null;
    try { return JSON.parse(b); } catch {
        const j = /^[\w$.]+\s*\(([\s\S]*)\)\s*;?\s*$/.exec(b);
        if (j) { try { return JSON.parse(j[1]); } catch { return null; } }
        return null;
    }
}
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function parsed(id, zone, nickname) {
    return { id: id == null ? null : String(id).trim(), zone: zone == null ? null : String(zone).trim(), nickname: nickname == null ? null : cleanNickname(nickname) };
}
function parseAccountString(input) {
    const raw = String(input || '').trim(); if (!raw) return parsed(null, null, null);
    let m;
    m = /^(\d{3,20})\s*[\(\[\{]\s*(\d{1,6})\s*[\)\]\}]$/.exec(raw); if (m) return parsed(m[1], m[2], null);
    m = /^(\d{3,20})\s*[|,;:/_-]\s*(\d{1,6})$/.exec(raw); if (m) return parsed(m[1], m[2], null);
    m = /^(\d{3,20})\s+(\d{1,6})$/.exec(raw); if (m) return parsed(m[1], m[2], null);
    m = /^(\d{3,20})\s+(.+?\s:\s*\d{1,2})$/.exec(raw); if (m) return parsed(m[1], null, m[2]);
    m = /^(.+?\s:\s*\d{1,2})\s+(\d{3,20})$/.exec(raw); if (m) return parsed(m[2], null, m[1]);
    m = /^(.+?)\s+(\d{3,20})\s+(\d{1,6})$/.exec(raw); if (m && !/^\d+$/.test(m[1].trim())) return parsed(m[2], m[3], m[1]);
    m = /^(.+?)\s+(\d{1,6})\s+(\d{3,20})$/.exec(raw); if (m && !/^\d+$/.test(m[1].trim())) return parsed(m[3], m[2], m[1]);
    m = /^(\d{3,20})\s+(\d{1,6})\s+(.+)$/.exec(raw); if (m) return parsed(m[1], m[2], m[3]);
    m = /^(\d{3,20})\s+(.+?)\s+(\d{1,6})$/.exec(raw); if (m && !/^\d+$/.test(m[2].trim())) return parsed(m[1], m[3], m[2]);
    m = /^(.+?)\s+(\d{3,20})\s*[|,;:/_-]\s*(\d{1,6})$/.exec(raw); if (m && !/^\d+$/.test(m[1].trim())) return parsed(m[2], m[3], m[1]);
    m = /^(\d{3,20})$/.exec(raw); if (m) return parsed(m[1], null, null);
    return parsed(null, null, raw);
}
function validateAccount(raw) {
    const errors = [];
    const id = raw?.id?.trim() || ''; const zone = raw?.zone?.trim() || ''; const nick = cleanNickname(raw?.nickname || '');
    let outId = null, outZone = null;
    if (!id) { if (nick) errors.push(`NICKNAME_SEARCH_UNAVAILABLE: Tidak bisa cari by nickname "${truncate(nick, 60)}". Pakai ID + Zone.`); else errors.push('MISSING_USER_ID: User ID wajib diisi.'); }
    else if (!/^\d{3,20}$/.test(id)) errors.push(`INVALID_USER_ID: User ID harus 3-20 digit.`);
    else outId = id;
    if (!zone) { if (id) errors.push('MISSING_ZONE_ID: Zone ID wajib diisi. Contoh: 2687'); }
    else if (!/^\d{1,6}$/.test(zone)) errors.push(`INVALID_ZONE_ID: Zone ID harus 1-6 digit.`);
    else outZone = zone;
    return { id: outId, zone: outZone, nickname: nick, raw: { id: id || null, zone: zone || null, nickname: nick || null }, errors };
}

// ---------- HTTP + CORS ----------
const CORS = [
    u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
];
async function fetchWithCors(url, init = {}) {
    try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) }); if (r.ok) return r; } catch {}
    for (const f of CORS) {
        try { const r = await fetch(f(url), { ...init, signal: AbortSignal.timeout(25000) }); if (r.ok) return r; } catch {}
    }
    throw new Error('Semua jalur (direct + CORS proxy) gagal.');
}
class ProviderError extends Error {
    constructor(msg, o = {}) { super(msg); this.kind = o.kind || 'provider_error'; this.status = o.status || null; this.provider = o.provider || null; this.retryable = !!o.retryable; }
}
async function requestJson({ url, init, retries, provider }) {
    let last = null;
    for (let a = 0; a <= retries; a++) {
        try {
            const res = await fetchWithCors(url, { ...init, redirect: 'follow', cache: 'no-store' });
            const text = await res.text();
            const json = parseJson(text);
            if (!res.ok) {
                const msg = (json?.message || json?.error || stripHtml(text) || `HTTP ${res.status}`).slice(0, 240);
                const notFound = /not found|not recognized|invalid user account|tidak ditemukan|tidak terdaftar/i.test(msg);
                throw new ProviderError(msg, { kind: notFound ? 'not_found' : 'http_error', status: res.status, provider, retryable: !notFound && [408, 429, 500, 502, 503, 504].includes(res.status) });
            }
            if (json === null) throw new ProviderError('Response bukan JSON valid.', { kind: 'invalid_response', provider, retryable: false });
            return { json, status: res.status };
        } catch (e) {
            const n = e instanceof ProviderError ? e : new ProviderError('Network error: ' + (e?.message || e), { kind: 'network', provider, retryable: true });
            if (!n.provider) n.provider = provider;
            last = n;
            if (a >= retries || !n.retryable) throw n;
            await delay(250 * (a + 1));
        }
    }
    throw last;
}

function extractCountry(json) {
    let code = null, name = null;
    for (const c of [json?.countryCode, json?.country_code, json?.countryOrigin, json?.country_origin, json?.country]) { const n = countryCode(c); if (n) { code = n; break; } }
    for (const c of [json?.countryName, json?.country_name, json?.country, json?.region]) { if (typeof c === 'string' && c.trim() && !countryCode(c)) { name = c.trim(); break; } }
    if (!name && code) name = countryName(code);
    if (!code && name) code = countryFromName(name);
    return { country: name || null, countryCode: code || null };
}
function extractAvatar(json) {
    if (!json || typeof json !== 'object') return null;
    const list = [json.avatar, json.avatar_url, json.avatarUrl, json.photo, json.photo_url, json.photoUrl, json.profile_pic, json.profilePic, json.profile_picture, json.image, json.image_url, json.imageUrl, json.picture, json.pfp, json.icon, json.data?.avatar, json.data?.photo, json.data?.image, json.result?.avatar, json.result?.photo];
    for (const c of list) if (typeof c === 'string' && /^https?:\/\//i.test(c.trim())) return c.trim();
    return null;
}
async function lookupIsanFind(ctx) {
    const provider = 'mlbb-api.isan.eu.org';
    const url = new URL(ENDPOINTS.isanFind); url.searchParams.set('id', ctx.id); url.searchParams.set('zone', ctx.zone);
    const { json } = await requestJson({ url: url.toString(), init: { method: 'GET', headers: { accept: 'application/json', 'user-agent': ctx.userAgent } }, retries: 1, provider });
    if (json?.success === false) throw new ProviderError(json?.message || 'Provider gagal.', { kind: 'provider_error', provider });
    const nickname = cleanNickname(json?.name || json?.nickname || json?.username);
    if (!nickname) throw new ProviderError('Response tidak ada nickname.', { kind: 'invalid_response', provider });
    return { provider, nickname, avatar: extractAvatar(json), ...extractCountry(json) };
}
async function lookupIsanNickname(ctx) {
    const provider = 'api.isan.eu.org';
    const url = new URL(ENDPOINTS.isanNickname); url.searchParams.set('id', ctx.id); url.searchParams.set('zone', ctx.zone);
    const { json } = await requestJson({ url: url.toString(), init: { method: 'GET', headers: { accept: 'application/json', 'user-agent': ctx.userAgent } }, retries: 1, provider });
    if (json?.success === false) throw new ProviderError(json?.message || 'Provider gagal.', { kind: 'provider_error', provider });
    const nickname = cleanNickname(json?.name || json?.nickname || json?.username);
    if (!nickname) throw new ProviderError('Response tidak ada nickname.', { kind: 'invalid_response', provider });
    return { provider, nickname, avatar: extractAvatar(json), ...extractCountry(json) };
}
async function lookupGoPay(ctx) {
    const provider = 'gopay.co.id';
    const { json } = await requestJson({
        url: ENDPOINTS.gopay,
        init: { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', origin: 'https://gopay.co.id', referer: 'https://gopay.co.id/', 'user-agent': ctx.userAgent }, body: JSON.stringify({ code: 'MOBILE_LEGENDS', data: { userId: ctx.id, zoneId: ctx.zone } }) },
        retries: 1, provider
    });
    const data = json?.data;
    if (!data?.username) throw new ProviderError(json?.message || 'Response tidak ada username.', { kind: 'not_found', provider });
    const nickname = cleanNickname(decodeForm(data.username));
    if (!nickname) throw new ProviderError('Username kosong.', { kind: 'invalid_response', provider });
    return { provider, nickname, avatar: extractAvatar(json) || extractAvatar(data), ...extractCountry({ countryOrigin: data.countryOrigin }) };
}
const PROVIDERS = [
    { label: 'mlbb-api.isan.eu.org', priority: 1, lookup: lookupIsanFind },
    { label: 'api.isan.eu.org', priority: 2, lookup: lookupIsanNickname },
    { label: 'gopay.co.id', priority: 3, lookup: lookupGoPay }
];
async function lookupAll(ctx) {
    const settled = await Promise.allSettled(PROVIDERS.map(async p => ({ ...(await p.lookup(ctx)), priority: p.priority })));
    const ok = [], fail = [];
    settled.forEach((e, i) => {
        if (e.status === 'fulfilled' && e.value?.nickname) ok.push(e.value);
        else fail.push({ provider: PROVIDERS[i], error: e.status === 'rejected' ? e.reason : new Error('No identity') });
    });
    return { ok, fail };
}
async function scrapeStalkML(input) {
    const raw = parseAccountString(input);
    const acc = validateAccount(raw);
    if (acc.errors.length) return { status: 'failed', errors: acc.errors };
    const ctx = { id: acc.id, zone: acc.zone, userAgent: USER_AGENT };
    const { ok, fail } = await lookupAll(ctx);
    if (!ok.length) return { status: 'failed', errors: [`ACCOUNT_NOT_FOUND: ID ${acc.id} (Zone ${acc.zone}) tidak ditemukan.`, ...fail.map(f => `PROVIDER_FAILED: ${f.provider.label}: ${truncate(f.error?.message || f.error, 200)}`)] };
    const sorted = ok.sort((a, b) => a.priority - b.priority);
    const primary = sorted[0];
    let country = null, code = null, avatar = null;
    for (const s of sorted) { if (s.countryCode && !code) code = s.countryCode; if (s.country && !country) country = s.country; if (!avatar && s.avatar) avatar = s.avatar; }
    if (!country && code) country = countryName(code);
    return { status: 'success', account: { id: acc.id, zone: acc.zone, nickname: primary.nickname, country, country_code: code, avatar, verified: true } };
}

// ---------- Plugin ----------
export default {
    command: ['stalkml', 'mlstalk', 'cekml', 'mlcheck', 'stalkmlbb'],
    category: 'stalker',
    description: 'Stalk akun Mobile Legends dari ID + Zone',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return await reply(denn, m,
                `🎮 *STALK MLBB*\n\n` +
                `Cek nickname ML dari ID + Zone.\n\n` +
                `📌 *Cara pakai:*\n` +
                `> \`${prefix + command} 134972929 2687\`\n` +
                `> \`${prefix + command} 134972929|2687\`\n` +
                `> \`${prefix + command} 134972929 (2687)\`\n\n` +
                `💡 *Contoh:*\n` +
                `> \`${prefix + command} 134972929 2687\``
            );
        }
        await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
        const result = await scrapeStalkML(text);
        if (result.status === 'failed' || !result.account) {
            await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            const err = (result.errors || []).join('\n').replace(/^(NICKNAME_SEARCH_UNAVAILABLE|MISSING_USER_ID|MISSING_ZONE_ID|INVALID_USER_ID|INVALID_ZONE_ID|ACCOUNT_NOT_FOUND|LOOKUP_FAILED):\s*/gm, '• ');
            return await reply(denn, m, `❌ *STALK MLBB GAGAL*\n\n${err || 'Akun tidak ditemukan.'}\n\nCoba: \`${prefix + command} 134972929 2687\``);
        }
        await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        const acc = result.account;
        let msg = `🎮 *STALK MLBB*\n\n` +
            `👤 *Nickname:* ${acc.nickname}\n` +
            `🆔 *User ID:* ${acc.id}\n` +
            `🌍 *Zone ID:* ${acc.zone}\n`;
        if (acc.country) msg += `📍 *Country:* ${acc.country} (${acc.country_code || '-'})\n`;
        msg += `✔️ *Verified:* Ya\n`;
        if (!acc.avatar) msg += `\n📷 *PP:* Tidak tersedia dari provider (Isan / GoPay tidak ngasih foto)`;

        if (acc.avatar) {
            await denn.sendMessage(m.chat, { image: { url: acc.avatar }, caption: msg }, { quoted: m }).catch(() => {});
            return;
        }
        return await reply(denn, m, msg);
    }
};
export { scrapeStalkML, parseAccountString };