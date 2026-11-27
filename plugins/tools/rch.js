import axios from 'axios';
import http from 'http';
import https from 'https';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DEFAULT_REACTION = '🔥';

const keepAgent = new https.Agent({ keepAlive: true, keepAliveMsecs: 30000 });
const keepAgentHttp = new http.Agent({ keepAlive: true, keepAliveMsecs: 30000 });

const browserHeaders = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://api.nexadev.my.id',
    'Referer': 'https://api.nexadev.my.id/',
    'DNT': '1',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
};

const CHANNEL_REGEX = /https?:\/\/(www\.)?whatsapp\.com\/channel\/[a-zA-Z0-9_-]+\/\d+/i;

function getApi() {
    const base = global.nexadevBaseUrl || 'https://api.nexadev.my.id';
    const key = global.nexadevApiKey;
    if (!key) throw new Error('nexadevApiKey belum diisi di settings.js');
    return { base: base.replace(/\/+$/, ''), key };
}

function parseInput(raw) {
    if (!raw) return null;
    const trimmed = raw.trim();
    let url = '';
    let reactionRaw = DEFAULT_REACTION;
    if (trimmed.includes('|')) {
        const [u, r] = trimmed.split('|').map(s => s.trim());
        url = u;
        reactionRaw = r || DEFAULT_REACTION;
    } else {
        const match = trimmed.match(CHANNEL_REGEX);
        if (!match) return null;
        url = match[0];
        reactionRaw = trimmed.replace(match[0], '').trim() || DEFAULT_REACTION;
    }
    const urlMatch = url.match(CHANNEL_REGEX);
    if (!urlMatch) return null;
    url = urlMatch[0];
    let reactions = reactionRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (!reactions.length) reactions = [DEFAULT_REACTION];
    reactions = reactions.slice(0, 4);
    const reaction = reactions.join(',');
    return { url, reaction, reactions };
}

function isSuccess(json) {
    if (!json || typeof json !== 'object') return false;
    if (json.status === true || json.success === true || json.ok === true) return true;
    if (['success', 'Success', 'Succes', 'SUCCESS'].includes(json.status)) return true;
    const r = json.result;
    if (r && typeof r === 'object') {
        if (r.success === true || r.status === true) return true;
        if (['success', 'Success', 'Succes', 'SUCCESS'].includes(r.status)) return true;
        if (r.task && (['success', 'Success', 'Succes'].includes(r.task.status) || r.task.status === true)) return true;
        if (typeof r.message === 'string' && /berhasil|terkirim|success/i.test(r.message)) return true;
    }
    if (typeof json.message === 'string' && /berhasil|terkirim|success/i.test(json.message)) return true;
    return false;
}

async function requestApi(finalUrl, method = 'GET', body = null) {
    const config = {
        timeout: 25000,
        headers: browserHeaders,
        httpAgent: keepAgentHttp,
        httpsAgent: keepAgent,
        validateStatus: () => true,
        maxRedirects: 5
    };
    let res;
    if (method === 'POST') res = await axios.post(finalUrl, body || {}, config);
    else res = await axios.get(finalUrl, config);
    let json = res.data;
    if (typeof json === 'string') {
        try { json = JSON.parse(json); } catch { throw new Error('Response bukan JSON: ' + json.slice(0, 200)); }
    }
    return { status: res.status, json };
}

async function callRchApi(channelUrl, reaction) {
    const { base, key } = getApi();
    const getUrl = `${base}/api/rch?key=${encodeURIComponent(key)}&url=${encodeURIComponent(channelUrl)}&reaction=${encodeURIComponent(reaction)}`;
    const postUrl = `${base}/api/rch`;
    const postBody = { key, url: channelUrl, reaction };
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const { status, json } = await requestApi(getUrl, 'GET');
            if (status === 429) { lastError = new Error('Rate limited, tunggu 3 detik'); await new Promise(r => setTimeout(r, 3000)); continue; }
            if (status >= 500) { lastError = new Error(`Server error (HTTP ${status})`); await new Promise(r => setTimeout(r, 2000)); continue; }
            if (status === 200 && json) return json;
            if (status >= 400 && status < 500) return json;
            throw new Error(`HTTP ${status}`);
        } catch (e) {
            lastError = e;
            const code = e.code || '';
            if ((code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'ENOTFOUND') && attempt < 3) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            }
            if (attempt >= 3) break;
        }
    }
    try {
        const { status, json } = await requestApi(postUrl, 'POST', postBody);
        if (status === 200 && json) return json;
        if (json) return json;
    } catch (e) { lastError = e; }
    throw lastError || new Error('Gagal menghubungi API');
}

export default {
    command: ['rch', 'reactch', 'swreact'],
    category: 'tools',
    execute: async (denn, m, { prefix, command, text }) => {
        const parsed = parseInput(text);

        if (!parsed) {
            return sendFakeQuoted(denn, m,
                `🔥 *REACT CHANNEL*\n\n` +
                `*Format:* ${prefix}${command} <link_channel> [emoji]\n\n` +
                `*Contoh:*\n` +
                `• \`${prefix}${command} https://whatsapp.com/channel/0029Vb8vySGAYlUMLcZVFT3d/148 | 🥶\`\n` +
                `• \`${prefix}${command} https://whatsapp.com/channel/xxx/148 😂\`\n` +
                `• \`${prefix}${command} https://whatsapp.com/channel/xxx/148 | 🥶,💙,😝,😋\`\n\n` +
                `_Max 4 emoji, pisahkan dengan koma ( , )_`,
                { title: 'React Channel', body: 'Masukkan link post channel WA' }
            );
        }

        let waitMsg = null;
        try {
            waitMsg = await denn.sendMessage(m.chat, { text: `⏳ Mengirim reaction...\n😀 Emoji: ${parsed.reaction}\n🔗 Link: ${parsed.url}` }, { quoted: m });
        } catch (e) {
            console.log('[rch] wait gagal:', e.message);
        }

        const editWait = async (newText) => {
            if (!waitMsg?.key) {
                await denn.sendMessage(m.chat, { text: newText }, { quoted: m });
                return;
            }
            try {
                await denn.sendMessage(m.chat, { text: newText, edit: waitMsg.key });
            } catch (e) {
                console.log('[rch] edit gagal, kirim baru:', e.message);
                await denn.sendMessage(m.chat, { text: newText }, { quoted: m });
            }
        };

        try {
            const json = await callRchApi(parsed.url, parsed.reaction);

            if (!json || typeof json !== 'object') throw new Error('Response tidak valid');

            if (!isSuccess(json)) {
                const apiMsg = json.message || json.msg || json.error || json.info || json.result?.message || '';
                const jsonPreview = JSON.stringify(json, null, 2).slice(0, 1200);
                return await editWait(
                    `❌ *API MENOLAK REQUEST*\n\n` +
                    (apiMsg ? `📝 *Pesan API:* ${apiMsg}\n\n` : '') +
                    `📋 *Preview Response:*\n\`\`\`json\n${jsonPreview}\n\`\`\`\n\n` +
                    `_Kirim preview ini ke Owner._`
                );
            }

            const result = json.result || {};
            const limitRemaining = json.limit_remaining ?? result.limit_remaining ?? '-';
            const limitDeducted = json.limit_deducted ?? result.limit_deducted ?? '-';
            const responseTime = json.response_time || result.response_time || '-';
            const apiMsg = result.message || json.message || 'Reaction terkirim';

            const card = `🔥 *REACT CHANNEL BERHASIL*\n\n` +
                `🔗 *Link:* ${parsed.url}\n` +
                `😀 *Emoji:* ${parsed.reaction}\n` +
                `⏱️ *Response:* ${responseTime}\n` +
                (limitDeducted !== '-' ? `📉 *Kuota Terpakai:* ${limitDeducted}\n` : '') +
                (limitRemaining !== '-' ? `💳 *Sisa Kuota:* ${limitRemaining}\n` : '') +
                `\n_${apiMsg}_`;

            await editWait(card.trim());
            const templateButtons = [
                { index: 1, quickReplyButton: { displayText: '👑 Owner', id: `${prefix}owner` } },
                { index: 2, quickReplyButton: { displayText: '📋 Menu', id: `${prefix}menu` } },
                { index: 3, quickReplyButton: { displayText: 'ℹ️ Info', id: `${prefix}info` } }
            ];
            try {
                await denn.sendMessage(m.chat, {
                    text: 'Pilih menu di bawah:',
                    footer: 'React Channel • PatrickMD ',
                    templateButtons: templateButtons,
                    headerType: 1
                }, { quoted: m });
            } catch (e) {
                console.log('[rch] Bermasalah:', e.message);
            }

        } catch (e) {
            const code = e.code || '';
            let msg = e.message;
            if (code === 'ECONNRESET') msg = 'Server memutus koneksi. Coba lagi.';
            if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') msg = 'Server timeout. Coba lagi.';
            if (code === 'ENOTFOUND') msg = 'Server tidak ditemukan.';
            await editWait(`❌ *Gagal kirim reaction:*\n${msg}`);
        }
    }
};