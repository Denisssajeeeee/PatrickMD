import axios from 'axios';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const API_URL = 'https://v2.api-varhad.my.id/search/lirik';

const findLongestString = (obj) => {
    let longest = "";
    const traverse = (o) => {
        if (typeof o === 'string') {
            if (o.length > longest.length) longest = o;
        } else if (o && typeof o === 'object') {
            for (const key in o) traverse(o[key]);
        }
    };
    traverse(obj);
    return longest;
};

const findValueByKeys = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key in obj) {
        if (keys.includes(key.toLowerCase()) && typeof obj[key] === 'string') {
            return obj[key];
        }
        if (typeof obj[key] === 'object') {
            const res = findValueByKeys(obj[key], keys);
            if (res) return res;
        }
    }
    return null;
};

export default {
    command: ['lirik', 'lyrics', 'carilirik'],
    category: 'search',
    execute: async (denn, m, { args, prefix }) => {
        if (!args[0]) {
            return sendFakeQuoted(denn, m,
                `🎵 *CARI LIRIK LAGU*\n\n` +
                `*Format:* \`${prefix}lirik <judul lagu>\`\n\n` +
                `*Contoh:*\n` +
                `\`${prefix}lirik Menemukannya\``,
                { title: 'Cari Lirik', body: 'Masukkan judul lagu' }
            );
        }

        const query = args.join(' ');
        const wait = await sendFakeQuoted(denn, m, `⏳ Mencari lirik *${query}*...`, {
            title: 'Cari Lirik', body: 'Memproses...'
        }).catch(() => null);

        try {
            const res = await axios.get(API_URL, {
                params: { q: query },
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0' },
                validateStatus: () => true
            });

            const data = res.data;

            if (!data) {
                throw new Error('Respons API kosong.');
            }

            const title = findValueByKeys(data, ['title', 'judul', 'song', 'lagu']) || query;
            const artist = findValueByKeys(data, ['artist', 'artis', 'singer', 'penyanyi', 'musisi']) || '-';
            
            const lyrics = findLongestString(data);

            if (!lyrics || lyrics.length < 20) {
                throw new Error('Lirik tidak ditemukan dalam respons API.');
            }

            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }

            const text =
                `🎵 *LIRIK LAGU*\n\n` +
                `🎶 *Judul:* ${title}\n` +
                `👤 *Artis:* ${artist}\n\n` +
                `📝 *Lirik:*\n${lyrics.trim()}\n\n` +
                `_Sumber: Varhad API_`;

            await sendFakeQuoted(denn, m, text, {
                title: 'Lirik Lagu',
                body: `${title} - ${artist}`
            });

        } catch (err) {
            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }
            await sendFakeQuoted(denn, m, 
                `❌ *GAGAL MENCARI LIRIK*\n\n${err.message}`, 
                { title: 'Error', body: 'Gagal' }
            );
        }
    }
};