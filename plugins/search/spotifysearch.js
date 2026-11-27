/**
 * Name      : Spotify Search
 * Creator   : Razeerh
 * Source    : https://whatsapp.com/channel/0029VbCN4sQLo4hhDCkOHX1m
 * Base Web  : https://spotmp3.net
 * Type      : Plugins | ESM Modules
 * Recode/Remake : DennCode
 */
import axios from 'axios';
import { load } from 'cheerio';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const BASE_URL = 'https://spotmp3.net';
const API_SEARCH = `${BASE_URL}/api/v1/search`;
const API_HOME = `${BASE_URL}/`;
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT = 25000;
const BACKOFF_BASE_MS = 1500;
const BACKOFF_CAP_MS = 30000;
const SECTION_ORDER = ['track', 'artist', 'album', 'playlist', 'podcast', 'episode', 'show'];

const cookieJar = Object.create(null);
let warmed = false;

function storeCookies(res) {
    const raw = res?.headers?.['set-cookie'] || [];
    const list = Array.isArray(raw) ? raw : [raw];
    for (const line of list) {
        if (!line) continue;
        const pair = String(line).split(';')[0];
        const eq = pair.indexOf('=');
        if (eq > 0) {
            const name = pair.slice(0, eq).trim();
            const value = pair.slice(eq + 1).trim();
            if (value && !/^expires=|delete$/i.test(name)) cookieJar[name] = value;
        }
    }
}
function cookieHeader() {
    const e = Object.entries(cookieJar);
    if (!e.length) return undefined;
    return e.map(([k, v]) => `${k}=${v}`).join('; ');
}
function baseHeaders(extra = {}) {
    const h = { 'User-Agent': DEFAULT_UA, Accept: 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9', Referer: `${BASE_URL}/`, Origin: BASE_URL, ...extra };
    const ck = cookieHeader();
    if (ck) h.Cookie = ck;
    return h;
}
async function warmCookies() {
    try {
        const res = await axios.get(API_HOME, { headers: baseHeaders({ Accept: 'text/html,application/xhtml+xml,*/*;' }), timeout: REQUEST_TIMEOUT, validateStatus: null, maxRedirects: 5 });
        storeCookies(res); warmed = true;
    } catch { warmed = true; }
    return true;
}
function looksLikeChallenge(htmlText) {
    if (!htmlText) return false;
    const t = String(htmlText).slice(0, 4000);
    const $ = load(String(htmlText));
    const title = ($('title').first().text() || '').toLowerCase();
    const kw = ['just a moment', 'attention required', 'challenge platform', 'cf-chl', 'security check', 'checking your browser', 'rate limited'];
    return kw.some(k => t.toLowerCase().includes(k)) || kw.some(k => title.includes(k));
}
function sleep(ms) { return new Promise(r => setTimeout(r, Math.min(ms, BACKOFF_CAP_MS))); }
function clampNumber(n, min, max, fb) { const v = Number(n); if (!Number.isFinite(v)) return fb; return Math.max(min, Math.min(max, Math.floor(v))); }
function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

async function searchRequest(query, offset = 0, opts = {}) {
    const maxRetries = opts.maxRetries ?? 3;
    const provider = opts.provider || 'spotify';
    const params = { q: query };
    if (offset > 0) params.offset = offset;
    if (provider === 'apple_music') { params.provider = 'apple_music'; params.storefront = 'us'; }
    let attempt = 0, lastErr = null;
    while (true) {
        attempt += 1;
        try {
            if (!warmed) { await warmCookies(); await sleep(250); }
            const res = await axios.get(API_SEARCH, { baseURL: BASE_URL, params, headers: baseHeaders(), timeout: REQUEST_TIMEOUT, validateStatus: null, responseType: 'text', maxRedirects: 5 });
            storeCookies(res);
            const contentType = String(res.headers['content-type'] || '');
            const bodyText = res.data;
            if (res.status === 403 || res.status === 429 || contentType.includes('text/html')) {
                const challenge = looksLikeChallenge(bodyText);
                if (challenge || res.status === 403 || res.status === 429) { warmed = false; await warmCookies(); }
                throw new Error(`HTTP ${res.status}${challenge ? ' (Cloudflare/challenge page)' : ''}${contentType.includes('text/html') ? ' (HTML response)' : ''}`);
            }
            let json;
            try { json = typeof bodyText === 'string' ? JSON.parse(bodyText) : bodyText; } catch { throw new Error(`Respon bukan JSON valid (HTTP ${res.status})`); }
            if (res.status >= 500) throw new Error(`HTTP ${res.status} (server error)`);
            if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
            if (!json || typeof json !== 'object') throw new Error('JSON tidak valid');
            if (!('sections' in json) && !('items' in json)) throw new Error('Respons API tanpa "sections"/"items"');
            return json;
        } catch (err) {
            lastErr = err;
            const netIssue = !err.response && (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.code === 'EAI_AGAIN' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'EPROTO' || /timeout|aborted|network/i.test(err.message || ''));
            const httpIssue = err.message && (/^HTTP (5\d\d|429|403)/.test(err.message) || /cloudflare|HTML response|Respon bukan JSON|tidak valid|tanpa/i.test(err.message));
            const retryable = netIssue || httpIssue || /^HTTP (403|429|5\d\d)/.test(err.message || '');
            if (!retryable) throw err;
            if (attempt > maxRetries) break;
            let wait = BACKOFF_BASE_MS * Math.pow(2, Math.min(attempt, 5) - 1);
            const ra = Number(err.headers?.['retry-after']);
            if (Number.isFinite(ra) && ra > 0) wait = Math.max(wait, ra * 1000);
            await sleep(wait);
        }
    }
    throw lastErr || new Error('Search gagal');
}

async function paginateSection(query, type, initial, targetTotal, opts) {
    const rows = Array.isArray(initial.items) ? initial.items.slice() : [];
    const maxPages = opts.maxPages ? Math.max(1, opts.maxPages) : Infinity;
    let next = initial.next_offset, page = 1;
    while (next != null && rows.length < targetTotal && page < maxPages) {
        const more = await searchRequest(query, next, opts);
        let matched = null;
        if (more && Array.isArray(more.sections)) {
            matched = more.sections.find(s => s && s.type === type);
            if (!matched && more.sections.length) matched = more.sections[0];
        }
        if (!matched || !Array.isArray(matched.items) || !matched.items.length) break;
        const seen = new Set(rows.map(r => r.id));
        for (const it of matched.items) if (!seen.has(it.id)) rows.push(it);
        next = matched.next_offset != null ? matched.next_offset : null;
        page += 1;
    }
    return rows;
}

function mapItem(item, fallbackType) {
    const type = (item.type || fallbackType || 'track').toLowerCase();
    const artist = item.subtitle != null ? String(item.subtitle).split(/[·•]\s*/).filter(Boolean)[0].trim() : null;
    const album = type === 'album' ? item.title || null : item.album || null;
    return {
        type, title: item.title || null,
        artist: item.subtitle != null ? artist : null, album,
        duration: item.duration_ms != null ? formatDuration(item.duration_ms) : null,
        duration_ms: item.duration_ms ?? null,
        artwork_url: item.cover || item.thumbnail || null,
        thumbnail_url: item.thumbnail || null,
        source_url: item.url || (item.id && type === 'track' ? `https://open.spotify.com/track/${item.id}` : null),
        track_id: item.id ?? null, total_tracks: item.total_tracks ?? null
    };
}

async function search(query, opts = {}) {
    const q = String(query || '').trim();
    if (!q) return { status: false, query: '', result_count: 0, results: [], message: 'Query kosong.' };
    const limit = clampNumber(opts.limit ?? 40, 1, 200, 40);
    const maxPages = opts.maxPages ?? 5;
    const provider = opts.provider === 'apple_music' ? 'apple_music' : 'spotify';
    const maxRetries = opts.maxRetries ?? 3;
    const runOpts = { provider, maxPages, maxRetries };
    let data;
    const t0 = Date.now();
    try { data = await searchRequest(q, 0, runOpts); }
    catch (err) { return { status: false, query: q, result_count: 0, results: [], message: `Pencarian gagal: ${err.message}`, elapsed_ms: Date.now() - t0 }; }
    const sectionsIn = Array.isArray(data.sections) ? data.sections : [];
    const direct = Array.isArray(data.items) ? data.items : [];
    const sorted = sectionsIn.slice().sort((a, b) => {
        const ia = SECTION_ORDER.indexOf(a.type), ib = SECTION_ORDER.indexOf(b.type);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    const out = [];
    for (const sec of sorted) {
        if (out.length >= limit) break;
        if (!sec || !Array.isArray(sec.items)) continue;
        let rows;
        try { rows = await paginateSection(q, sec.type, sec, sec.total == null ? maxPages * 20 : sec.total, runOpts); }
        catch { rows = sec.items; }
        for (const item of rows) { if (out.length >= limit) break; out.push(mapItem(item, sec.type)); }
    }
    if (out.length === 0 && direct.length) for (const item of direct) out.push(mapItem(item, item.type || 'track'));
    out.forEach((r, i) => { r.position = i + 1; });
    return { status: true, query: q, search_type: data.type || 'search', provider, crawl_ms: Date.now() - t0, result_count: out.length, results: out, page: 1, limit };
}

const reply = (denn, m, text) => sendFakeQuoted(denn, m, text, { title: 'Spotify Search', body: 'Cari lagu dari Spotify' });

export default {
    command: ['spotifysearch', 'spotifys', 'spsearch', 'carilagu'],
    category: 'search',
    description: 'Cari lagu Spotify dari judul / artis / album',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return await reply(denn, m, `🎵 *SPOTIFY SEARCH*\n\nCari lagu dari Spotify.\n\n📌 *Cara pakai:*\n> \`${prefix + command} night changes\`\n> \`${prefix + command} one direction\`\n\n💡 *Contoh:*\n> \`${prefix + command} night changes\``);
        }
        await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
        const result = await search(text, { limit: 10, maxPages: 2, maxRetries: 3 });
        if (!result.status || !result.results.length) {
            await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            return await reply(denn, m, `❌ *SPOTIFY SEARCH GAGAL*\n\n${result.message || 'Tidak ada hasil.'}\n\nCoba lagi: \`${prefix + command} ${text}\``);
        }
        await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        let msg = `🎵 *SPOTIFY SEARCH*\n\n🔎 *Query:* ${result.query}\n📦 *Ditemukan:* ${result.result_count} lagu\n\n`;
        for (const r of result.results) {
            msg += `*${r.position}.* ${r.title || '-'}\n`;
            if (r.artist) msg += `   👤 ${r.artist}\n`;
            if (r.duration) msg += `   ⏱️ ${r.duration}\n`;
            if (r.source_url) msg += `   🔗 ${r.source_url}\n`;
            msg += `\n`;
        }
        msg += `> Ketik \`${prefix}spotifydl <judul>\` untuk download`;
        return await reply(denn, m, msg.trim());
    }
};

export { search, formatDuration };