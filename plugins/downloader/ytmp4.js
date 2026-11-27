import axios from 'axios';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const S = String.fromCharCode(47);
const DS = S + S;
const HTTPS = 'https:' + DS;

export default {
    command: ['ytmp4', 'ytv', 'ytmp4api'],
    category: 'downloader',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return sendFakeQuoted(denn, m,
                '🎬 *YOUTUBE MP4 DOWNLOADER*\n\n' +
                '📌 *Format:* ' + prefix + command + ' <link> [kualitas]\n' +
                '*Contoh:* ' + prefix + command + ' ' + HTTPS + 'youtu.be' + S + 'xxx 720',
                { title: 'YouTube MP4', body: 'Masukkan link YouTube dan kualitas (opsional)' }
            );
        }
        try {
            await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });
        } catch (e) {
        }
        let wait = null;
        try {
            wait = await sendFakeQuoted(denn, m, '⏳ Memproses video...', {
                title: 'YouTube MP4', body: 'Mengunduh video, mohon tunggu...'
            });
        } catch (e) {
        }
        try {
            const args = text.trim().split(' ');
            const targetUrl = args[0];
            const quality = args[1] || '720';
            const base = String(global.jereBaseUrl || '').replace(/\/+$/, '');
            const apiUrl = base + S + 'api' + S + 'downloader' + S + 'ytmp4?apikey=' + String(global.jereApiKey || '') + '&url=' + encodeURIComponent(targetUrl) + '&quality=' + encodeURIComponent(quality);
            const res = await axios.get(apiUrl, { timeout: 30000 });
            const json = res.data;
            if (!json.status) throw new Error(json.error || 'Gagal mengunduh video YouTube');
            const videoUrl = json.downloadUrl || json.url || (json.result && (json.result.downloadUrl || json.result.url)) || null;
            if (!videoUrl) throw new Error('Link video YouTube tidak ditemukan di response API');
            const title = json.title || (json.result && json.result.title) || 'YouTube Video';
            const safeTitle = title.slice(0, 30).replace(/[^\w\s-]/g, '');
            if (wait && wait.key && wait.key.id) {
                try {
                    await denn.sendMessage(m.chat, { delete: wait.key });
                } catch (e) {
                }
            }
            const caption = '🎬 *YOUTUBE MP4 DOWNLOADER*\n\n' +
                '📌 *Judul:* ' + title + '\n' +
                '📺 *Kualitas:* ' + quality + 'p\n' +
                '✨ *Request by:* ' + (m.pushName || 'User');
            try {
                await denn.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    caption: caption,
                    fileName: (safeTitle || 'video') + '.mp4',
                    mimetype: 'video' + S + 'mp4'
                }, { quoted: m });
            } catch (e) {
                await denn.sendMessage(m.chat, {
                    document: { url: videoUrl },
                    fileName: (safeTitle || 'video') + '.mp4',
                    mimetype: 'video' + S + 'mp4',
                    caption: caption
                }, { quoted: m });
            }
            try {
                await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
            } catch (e) {
            }
        } catch (e) {
            if (wait && wait.key && wait.key.id) {
                try {
                    await denn.sendMessage(m.chat, { delete: wait.key });
                } catch (e2) {
                }
            }
            try {
                await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            } catch (e3) {
            }
            await sendFakeQuoted(denn, m, '❌ *Gagal YTMP4:*\n' + (e.message || 'Terjadi kesalahan pada server'), {
                title: 'YouTube MP4 Gagal', body: 'Server API sibuk atau video tidak tersedia'
            });
        }
    }
};