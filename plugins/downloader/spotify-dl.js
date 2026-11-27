/**
 * Name      : Spotify Downloader
 * Creator   : Razeerh
 * Source    : https://whatsapp.com/channel/0029VbCN4sQLo4hhDCkOHX1m
 * Base Web  : https://spotidown.app/id7
 * Type      : Plugins | ESM Modules
 * Remake/Recode : DennCode
 */
import axios from 'axios';
import { load } from 'cheerio';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const SITE = 'https://spotidown.app';

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
];

const DEFAULTS = Object.freeze({ timeout: 45000, retries: 3, limit: 1, verify: true });

class Warn {
    constructor(log) { this.log = log; }
    w(msg) { if (this.log) { try { this.log('[spotidown] ' + msg); } catch {} } }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function pad2(v) { return String(v).padStart(2, '0'); }
function fmtTime(dur) {
    if (typeof dur === 'number' && Number.isFinite(dur)) {
        const h = Math.floor(dur / 3600), m = Math.floor((dur % 3600) / 60), s = Math.floor(dur % 60);
        return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
    }
    if (typeof dur !== 'string' || !dur.includes(':')) return '';
    const parts = dur.split(':').map(p => p.trim());
    if (parts.some(p => p === '')) return dur;
    if (parts.length === 2) return `${pad2(parts[0])}:${pad2(parts[1])}`;
    if (parts.length === 3) return `${parts[0]}:${pad2(parts[1])}:${pad2(parts[2])}`;
    return dur;
}

function normalizeInput(raw) {
    const input = String(raw == null ? '' : raw).trim().replace(/^["']|["']$/g, '');
    const httpMatch = input.match(/(?:https?:\/\/)?(?:www\.|open\.|embed\.)?(?:open\.spotify\.com|spotify\.link)\/[^\s]+/i);
    if (httpMatch) {
        const rawUrl = 'https://' + httpMatch[0].replace(/^https?:\/\//i, '');
        let parsed;
        try { parsed = new URL(rawUrl); } catch {}
        if (!parsed) return { type: 'query', value: input, label: input };
        const m = parsed.pathname.match(/\/(?:intl-[a-z\-]+\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]{22})/i);
        if (m) {
            const kind = m[1].toLowerCase();
            return { type: kind, value: `https://open.spotify.com/${kind}/${m[2]}`, label: input };
        }
        if (/spotify\.link$/i.test(parsed.hostname)) return { type: 'shortlink', value: parsed.href, label: input };
        return { type: 'query', value: input, label: input };
    }
    const uri = input.match(/^spotify:(track|album|playlist|episode):([a-zA-Z0-9]{22})$/i);
    if (uri) {
        const kind = uri[1].toLowerCase();
        return { type: kind, value: `https://open.spotify.com/${kind}/${uri[2]}`, label: input };
    }
    const bare = input.match(/(?:^|[\s/"'])(track|album|playlist|episode)[/:]+([a-zA-Z0-9]{22})(?:[\s/"']|$)/i);
    if (bare) {
        const kind = bare[1].toLowerCase();
        return { type: kind, value: `https://open.spotify.com/${kind}/${bare[2]}`, label: input };
    }
    const id22 = input.match(/^([a-zA-Z0-9]{22})$/);
    if (id22) return { type: 'track', value: `https://open.spotify.com/track/${id22[1]}`, label: input };
    if (input) return { type: 'query', value: input, label: input };
    return null;
}

async function resolveShortlink(client, target, warn) {
    try {
        const r = await client.get(target.value, { maxRedirects: 5, timeout: 20000 });
        const finalUrl = r.request?.res?.responseUrl || r.config?.url;
        const m = String(finalUrl || '').match(/\/(?:intl-[a-z\-]+\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]{22})/i);
        if (m) return { type: m[1].toLowerCase(), value: `https://open.spotify.com/${m[1].toLowerCase()}/${m[2]}`, label: target.label };
        throw new Error('shortlink target not parsed: ' + finalUrl);
    } catch (e) {
        warn.w('shortlink resolve gagal (' + e.message + ')');
        return null;
    }
}

function newSession() {
    const jar = new Map();
    return {
        header() { return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
        store(headers) {
            const set = headers?.['set-cookie'];
            if (!set) return;
            for (const line of [].concat(set)) {
                const m = String(line).match(/^([^=;\s]+)\s*=\s*([^;]*)/);
                if (!m) continue;
                const name = m[1].toLowerCase();
                const value = m[2];
                if (value === '' || /expires=\w+,\s*\d{2}\s+\w+\s+\d{2}.*(1970|GMT\s*$)/i.test(line)) jar.delete(name);
                else jar.set(name, value);
            }
        }
    };
}

function makeClient(session, ua, timeout) {
    const client = axios.create({ timeout, maxRedirects: 5, validateStatus: s => s >= 200 && s < 500 });
    client.interceptors.request.use(cfg => {
        cfg.headers = cfg.headers || {};
        cfg.headers['user-agent'] = ua;
        const ck = session.header();
        if (ck) cfg.headers['cookie'] = ck;
        return cfg;
    });
    client.interceptors.response.use(r => { try { session.store(r.headers); } catch {} return r; });
    return client;
}

function ajaxHeaders(extra) {
    return Object.assign({ 'accept': 'application/json, text/javascript, */*; q=0.01', 'x-requested-with': 'XMLHttpRequest', 'origin': SITE, 'referer': SITE + '/en7' }, extra || {});
}

async function dlAction(client, url) {
    const { data: json } = await client.post(SITE + '/action', new URLSearchParams({ url, 'g-recaptcha-response': '' }).toString(), ajaxHeaders({ 'content-type': 'application/x-www-form-urlencoded' }));
    return json;
}

function decodeTrackData(b64) {
    try { return JSON.parse(Buffer.from(String(b64), 'base64').toString('utf8')); } catch { return null; }
}

function parseTrackRows(html) {
    const $ = load(String(html));
    const out = [];
    $('form[name="submitspurl"]').each((_, form) => {
        const f = $(form);
        const dataB64 = f.find('input[name="data"]').attr('value');
        if (!dataB64) return;
        const info = decodeTrackData(dataB64) || {};
        out.push({
            data: dataB64,
            base: (f.find('input[name="base"]').attr('value') || '').trim(),
            token: (f.find('input[name="token"]').attr('value') || '').trim(),
            name: info.name || '', artist: info.artist || '', album: info.album || '',
            cover: info.cover || '', duration: fmtTime(info.duration || ''), tid: info.tid || ''
        });
    });
    return out;
}

async function killStream(resp) {
    try { if (resp?.data && typeof resp.data.destroy === 'function') resp.data.destroy(); } catch {}
    try { if (resp?.request && typeof resp.request.abort === 'function') resp.request.abort(); } catch {}
}
function isMp3Magic(buf) {
    if (!buf || buf.length < 3) return false;
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
    return false;
}
async function verifyMp3(client, url, warn) {
    let resp = null;
    try {
        resp = await client.get(url, { responseType: 'stream', timeout: 25000, maxRedirects: 5, headers: { referer: SITE + '/', accept: '*/*' } });
        const chunks = [];
        let size = 0;
        await new Promise(resolve => {
            resp.data.on('data', c => { chunks.push(c); size += c.length; if (size >= 65536) { killStream(resp); resolve(); } });
            resp.data.on('end', resolve);
            resp.data.on('error', () => resolve());
        });
        const buf = Buffer.concat(chunks).subarray(0, 256);
        const ctype = String(resp.headers['content-type'] || '').toLowerCase();
        const ok = isMp3Magic(buf) || ctype.includes('audio') || ctype.includes('octet-stream') || ctype.includes('mpeg');
        if (!ok) { warn.w('mp3 verify: anomali type=' + ctype); return false; }
        return true;
    } catch (e) {
        warn.w('verify mp3 dilewati (' + e.message + ')');
        return true;
    } finally { killStream(resp); }
}

async function extractDownloadUrl(client, entry, warn) {
    const fd = new FormData();
    fd.append('data', entry.data);
    fd.append('base', entry.base || '');
    fd.append('token', entry.token || '');
    const { data: json } = await client.post(SITE + '/action/track', fd, ajaxHeaders());
    if (!json || typeof json !== 'object' || json.error) throw new Error((json && json.message) || 'track endpoint refused');
    const html = json.data || '';
    if (!html) throw new Error('track endpoint returned empty html');
    const $f = load(html);
    let href = '';
    $f('a').each((_, a) => {
        if (href) return;
        const $a = $f(a);
        const text = ($a.text() || '').trim();
        const u = $a.attr('href') || '';
        if (/download\s*mp3/i.test(text) && /token=/.test(u)) href = u;
    });
    if (!href) {
        $f('a').each((_, a) => {
            if (href) return;
            const u = $f(a).attr('href') || '';
            if (/^(https:\/\/)?rapid\.spotidown\.app\/.*/i.test(u)) href = u;
        });
    }
    if (!href) {
        const any = $f('a[href*="token="]').attr('href') || '';
        if (any) href = any;
    }
    if (!href || href === '#') throw new Error('no mp3 link found in final page');
    return href;
}

async function paginate(client, firstHtml, warn) {
    let $ = load(String(firstHtml));
    let rows = parseTrackRows(String(firstHtml));
    let guard = 0;
    while (guard < 60) {
        guard += 1;
        const more = $('#load-more');
        if (!more.length) break;
        const offset = Number(more.attr('data-offset') || '-1');
        const lurl = more.attr('data-url') || '';
        const ltoken = more.attr('data-token') || '';
        if (!Number.isInteger(offset) || offset < 0 || !lurl) break;
        warn.w('pagination: loading offset ' + offset);
        const fd = new FormData();
        fd.append('url', lurl);
        fd.append('token', ltoken);
        fd.append('offset', String(offset));
        try {
            const { data: chunk } = await client.post(SITE + '/action/offset', fd, ajaxHeaders());
            if (!chunk || typeof chunk !== 'string' || chunk.trim() === '') break;
            const added = parseTrackRows(chunk);
            if (!added.length) break;
            const seen = new Set(rows.map(r => r.tid + '|' + r.name));
            const fresh = added.filter(r => !seen.has(r.tid + '|' + r.name));
            rows = rows.concat(fresh);
            if (!fresh.length) break;
            $ = load(chunk);
        } catch (e) {
            warn.w('pagination offset ' + offset + ' gagal: ' + e.message);
            break;
        }
    }
    return rows;
}

async function pipelineOnce(target, opts, warn) {
    const session = newSession();
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const client = makeClient(session, ua, opts.timeout);
    try { await client.get(SITE + '/', { headers: { accept: 'text/html,application/xhtml+xml' } }); }
    catch (e) { warn.w('seed page gagal (' + e.message + ')'); }
    let input = { type: target.type, value: target.value, label: target.label };
    if (input.type === 'shortlink') {
        const resolved = await resolveShortlink(client, input, warn);
        if (resolved) input = resolved;
    }
    const json = await dlAction(client, input.value);
    if (!json || typeof json !== 'object' || json.error !== false) throw new Error((json && json.message) || 'Gagal mengambil data dari SpotiDown');
    const rows = await paginate(client, json.data || '', warn);
    if (!rows.length) throw new Error('daftar track kosong (no tracks found)');
    let wanted = rows.slice();
    if (target.type === 'track' || target.type === 'episode') wanted = rows.slice(0, 1);
    else wanted = rows.slice(0, Math.max(1, Math.min(Number(opts.limit) || 1, rows.length)));
    const results = [];
    let primary = null;
    for (let i = 0; i < wanted.length; i++) {
        const entry = wanted[i];
        try {
            const mp3 = await extractDownloadUrl(client, entry, warn);
            if (opts.verify) {
                const ok = await verifyMp3(client, mp3, warn);
                if (!ok) throw new Error('verifikasi mp3 tidak lolos');
            }
            const item = { name_music: entry.name || '', author: entry.artist || '', time: entry.duration || '', url_audio_mp3: mp3, cover: entry.cover || '' };
            if (!primary) primary = item;
            results.push(item);
            if (i + 1 < wanted.length) await sleep(400);
        } catch (e) {
            warn.w('entry "' + entry.name + '" gagal: ' + e.message);
            if (wanted.length === 1) throw e;
        }
    }
    if (!primary) throw new Error('tidak ada hasil download yang berhasil');
    if (results.length === 1) return { status: true, name_music: primary.name_music, author: primary.author, time: primary.time, url_audio_mp3: primary.url_audio_mp3, cover: primary.cover };
    return { status: true, source: input.type, total: results.length, name_music: primary.name_music, author: primary.author, time: primary.time, url_audio_mp3: primary.url_audio_mp3, cover: primary.cover, tracks: results };
}

function finalFailure(message, extra) {
    return Object.assign({ status: false }, extra || {}, { message: String(message || 'unknown error') });
}

async function spotifyDownloader(input, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    const warn = new Warn(typeof opts.log === 'function' ? opts.log : null);
    const target = normalizeInput(input);
    if (!target) throw new Error('target tidak valid');
    let attempt = 0, lastError = '';
    while (attempt < opts.retries) {
        attempt += 1;
        try {
            const result = await pipelineOnce(target, opts, warn);
            return result;
        } catch (e) {
            lastError = e.message || String(e);
            if (attempt < opts.retries) await sleep(Math.min(12000, 1200 * Math.pow(attempt, 1.6)));
        }
    }
    return finalFailure(lastError);
}

const reply = (denn, m, text) => sendFakeQuoted(denn, m, text, { title: 'Spotify Downloader', body: 'Download lagu dari Spotify' });

export default {
    command: ['spotifydl', 'spotidl', 'spdl', 'spotifydownload'],
    category: 'download',
    description: 'Download lagu Spotify dari link / judul',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return await reply(denn, m, `🎵 *SPOTIFY DOWNLOADER*\n\nDownload lagu dari Spotify.\n\n📌 *Cara pakai:*\n> \`${prefix + command} https://open.spotify.com/track/xxx\`\n> \`${prefix + command} night changes\`\n\n💡 *Contoh:*\n> \`${prefix + command} https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC\`\n> \`${prefix + command} night changes one direction\`\n\n⚠️ *Note:* Link MP3 aktif 1 jam`);
        }
        await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
        const result = await spotifyDownloader(text, { retries: 3, limit: 1, verify: true });
        if (!result.status || !result.url_audio_mp3) {
            await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            return await reply(denn, m, `❌ *SPOTIFY DL GAGAL*\n\n${result.message || 'Tidak ada hasil.'}\n\nCoba lagi: \`${prefix + command} ${text}\``);
        }
        await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        const caption = `🎵 *SPOTIFY DOWNLOADER*\n\n🎶 *Judul:* ${result.name_music || '-'}\n👤 *Artis:* ${result.author || '-'}\n⏱️ *Durasi:* ${result.time || '-'}\n\n> Link MP3 aktif 1 jam`;
        await reply(denn, m, caption);
        try {
            await denn.sendMessage(m.chat, {
                audio: { url: result.url_audio_mp3 },
                mimetype: 'audio/mpeg',
                fileName: `${result.name_music || 'spotify'} - ${result.author || ''}.mp3`,
                ptt: false
            }, { quoted: m });
        } catch {
            return await reply(denn, m, `🎵 *LINK MP3*\n\n${result.url_audio_mp3}\n\nAudio gagal dikirim langsung, buka link di atas (aktif 1 jam).`);
        }
    }
};

export { spotifyDownloader, normalizeInput, fmtTime, parseTrackRows, DEFAULTS };