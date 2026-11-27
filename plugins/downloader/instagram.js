import axios from 'axios';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const fetchInstagram = async (url) => {
    const apiUrl = `${global.jereBaseUrl}/api/downloader/instagram`;
    try {
        const res = await axios.post(apiUrl, {
            apikey: global.jereApiKey,
            url
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });
        return res.data;
    } catch (_) {
        const res = await axios.get(apiUrl, {
            params: { apikey: global.jereApiKey, url },
            timeout: 60000,
            headers: { 'User-Agent': UA }
        });
        return res.data;
    }
};

const downloadMedia = async (url) => {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 45000,
        maxContentLength: 100 * 1024 * 1024,
        headers: {
            'User-Agent': UA,
            'Referer': 'https://www.instagram.com/'
        }
    });
    return Buffer.from(res.data || []);
};

export default {
    command: ['instagram', 'igdl', 'ig', 'igvideo', 'igphoto', 'igreels'],
    category: 'downloader',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return sendFakeQuoted(denn, m,
                `📸 *INSTAGRAM DOWNLOADER*\n\n` +
                `*Format:* ${prefix + command} <link_instagram>\n` +
                `*Contoh:* ${prefix + command} https://www.instagram.com/reel/xxxx`,
                { title: 'Instagram Downloader', body: 'Masukkan link Instagram (Reels/Post)' }
            );
        }

        await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});

        const wait = await sendFakeQuoted(denn, m, '⏳ Memproses media...', {
            title: 'Instagram Downloader', body: 'Mengunduh media, mohon tunggu...'
        }).catch(() => null);

        try {
            const data = await fetchInstagram(text.trim());

            if (!data || !data.status || !data.result) {
                throw new Error(data?.error || data?.detail || 'Gagal mengambil data Instagram');
            }

            const result = data.result;
            const urls = result.urls || (Array.isArray(result) ? result : [result]);

            if (!urls || urls.length === 0) {
                throw new Error('Tidak ada media ditemukan di link tersebut.');
            }

            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }

            for (let i = 0; i < urls.length; i++) {
                const item = urls[i];
                const itemUrl = typeof item === 'string' ? item : (item.url || item.downloadUrl || item.download);
                if (!itemUrl) continue;

                const isVideo = /\.(mp4|mov|avi|webm)($|\?)/i.test(itemUrl) || (typeof item === 'object' && item.type === 'video');

                const caption =
                    `📸 *INSTAGRAM DOWNLOADER*\n\n` +
                    (urls.length > 1 ? `📎 *${i + 1}/${urls.length}*\n` : '') +
                    `✨ *Request by:* ${m.pushName || 'User'}`;

                try {
                    const buf = await downloadMedia(itemUrl);
                    if (buf.length < 100) throw new Error('File media rusak atau kosong.');

                    if (isVideo) {
                        await denn.sendMessage(m.chat, {
                            video: buf,
                            mimetype: 'video/mp4',
                            fileName: `instagram_${Date.now()}.mp4`,
                            caption
                        }, { quoted: i === 0 ? m : undefined });
                    } else {
                        await denn.sendMessage(m.chat, {
                            image: buf,
                            caption
                        }, { quoted: i === 0 ? m : undefined });
                    }

                    if (i < urls.length - 1) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                } catch (_) {
                    await denn.sendMessage(m.chat, {
                        text: `⚠️ Gagal mengunduh media ke-${i + 1}.\n\n*Link Langsung:*\n${itemUrl}`
                    }, { quoted: m });
                }
            }

            await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});

        } catch (e) {
            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }
            await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            sendFakeQuoted(denn, m, `❌ *Gagal Instagram:*\n${e.message || 'Terjadi kesalahan pada server'}`, {
                title: 'Instagram Gagal', body: 'Pastikan link valid dan akun tidak private'
            });
        }
    }
};