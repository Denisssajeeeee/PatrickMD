import axios from 'axios';
import { sendFakeQuoted } from '../../lib/fakequoted.js';
const API_URL = 'https://v2.api-varhad.my.id/random/ba';

export default {
    command: ['bluearchive', 'ba', 'bluearchivepic'],
    category: 'anime',
    execute: async (denn, m) => {
        const wait = await sendFakeQuoted(denn, m, '⏳ Mengambil gambar Blue Archive...', {
            title: 'Blue Archive', body: 'Memproses...'
        }).catch(() => null);

        try {
            const res = await axios.get(API_URL, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const contentType = String(res.headers['content-type'] || '').toLowerCase();
            let imageBuffer;

            if (contentType.includes('application/json')) {
                const json = JSON.parse(Buffer.from(res.data).toString('utf8'));
                const imageUrl = json.url || json.result || json.data || json.image;
                
                if (!imageUrl) throw new Error('Gagal mendapatkan URL gambar dari API');
                
                const imgRes = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                imageBuffer = Buffer.from(imgRes.data);
            } else {
                imageBuffer = Buffer.from(res.data);
            }

            if (!imageBuffer || imageBuffer.length < 100) {
                throw new Error('Gambar kosong atau rusak');
            }

            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }

            await denn.sendMessage(m.chat, {
                image: imageBuffer,
                caption: `🌸 *BLUE ARCHIVE*\n\n✨ *Request by:* ${m.pushName || 'User'}`
            }, { quoted: m });

        } catch (err) {
            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }
            await sendFakeQuoted(denn, m, `❌ Gagal mengambil gambar:\n${err.message}`, {
                title: 'Error', body: 'Gagal'
            });
        }
    }
};