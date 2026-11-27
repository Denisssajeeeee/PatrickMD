import axios from 'axios';
import FormData from 'form-data';
import { getBuffer } from '../../lib/helper.js';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const UPLOAD_URL = 'https://uguu.se/upload';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const GRADIO_BASE = 'https://r3gm-wan2-2-fp8da-aoti-preview.hf.space';
const GRADIO_CALL = `${GRADIO_BASE}/gradio_api/call/generate_video`;

const uploadImage = async (buffer) => {
    const form = new FormData();
    form.append('files[]', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const res = await axios.post(UPLOAD_URL, form, {
        headers: form.getHeaders(),
        timeout: 30000,
        maxBodyLength: Infinity
    });
    return res.data?.files?.[0]?.url;
};

const downloadVideo = async (url) => {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 180000,
        maxContentLength: 150 * 1024 * 1024,
        headers: { 'User-Agent': UA }
    });
    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 5000) throw new Error('File video rusak atau kosong.');
    return buf;
};

const parseSse = (text) => {
    const lines = text.split('\n');
    let eventType = '';
    let dataLines = [];
    const events = [];

    for (const line of lines) {
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
        } else if (line.trim() === '') {
            if (eventType && dataLines.length > 0) {
                events.push({ event: eventType, data: dataLines.join('\n') });
            }
            eventType = '';
            dataLines = [];
        }
    }
    if (eventType && dataLines.length > 0) {
        events.push({ event: eventType, data: dataLines.join('\n') });
    }
    return events;
};

const extractVideoUrl = (completeData) => {
    try {
        const parsed = JSON.parse(completeData);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of arr) {
            if (!item || typeof item !== 'object') continue;
            const video = item.video || item;
            if (video && typeof video === 'object') {
                if (typeof video.url === 'string' && video.url.startsWith('http')) return video.url;
                if (typeof video.path === 'string' && video.path.startsWith('http')) return video.path;
            }
            if (typeof item === 'string' && item.startsWith('http')) return item;
        }
    } catch (_) {}
    return null;
};

const tryGradio = async (imageUrl, prompt) => {
    const body = {
        data: [
            { path: imageUrl, url: imageUrl, meta: { _type: 'gradio.FileData' } },
            null,
            prompt,
            4,
            'blurry, low quality, watermark',
            5.0,
            5.0,
            5.0,
            0,
            true,
            5,
            'FlowMatchEulerDiscrete',
            3.0,
            16,
            true,
            false,
            false
        ]
    };

    const postRes = await axios.post(GRADIO_CALL, body, {
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        timeout: 30000,
        validateStatus: () => true
    });

    if (postRes.status !== 200 || !postRes.data?.event_id) {
        throw new Error(`Gradio POST gagal (HTTP ${postRes.status})`);
    }

    const eventId = postRes.data.event_id;
    const pollUrl = `${GRADIO_CALL}/${eventId}`;

    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));

        const pollRes = await axios.get(pollUrl, {
            headers: { 'User-Agent': UA },
            timeout: 30000,
            responseType: 'text',
            validateStatus: () => true
        });

        if (pollRes.status !== 200) continue;

        const events = parseSse(String(pollRes.data || ''));
        const complete = events.find(e => e.event === 'complete');
        if (complete) {
            const url = extractVideoUrl(complete.data);
            if (url) return url;
        }

        const error = events.find(e => e.event === 'error');
        if (error) throw new Error(`Gradio error: ${error.data.slice(0, 200)}`);
    }

    throw new Error('Gradio timeout (video tidak selesai dalam 5 menit).');
};

const tryPollinations = async (imageUrl, prompt) => {
    const models = ['seedance-pro', 'seedance'];

    for (const model of models) {
        for (const duration of [5, 3, 8]) {
            try {
                const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`;
                const res = await axios.get(url, {
                    params: { image: imageUrl, model, duration, aspectRatio: '16:9' },
                    responseType: 'arraybuffer',
                    timeout: 120000,
                    maxContentLength: 150 * 1024 * 1024,
                    headers: { 'User-Agent': UA },
                    validateStatus: () => true
                });

                if (res.status !== 200) continue;
                const buf = Buffer.from(res.data);
                if (buf.length > 5000) return buf;
            } catch (_) {}
        }
    }
    return null;
};

export default {
    command: ['img2video', 'i2v', 'fototovideo'],
    category: 'ai',
    execute: async (denn, m, { text, prefix }) => {
        const prompt = (text || '').trim();

        if (!prompt) {
            return sendFakeQuoted(denn, m,
                `🎬 *IMAGE TO VIDEO AI*\n\n` +
                `*Format:* Reply gambar dengan caption \`${prefix}img2video <prompt>\`\n\n` +
                `*Contoh:*\n` +
                `Reply gambar, lalu ketik:\n` +
                `\`${prefix}img2video orang ini berjalan pelan ke arah kamera\`\n\n` +
                `_Powered by Wan 2.2 (HF Space) + Pollinations AI._`,
                { title: 'Image to Video', body: 'Masukkan prompt' }
            );
        }

        if (!m.quoted || m.quoted.mtype !== 'imageMessage') {
            return sendFakeQuoted(denn, m, '❌ Kamu harus me-reply sebuah gambar!');
        }

        const wait = await sendFakeQuoted(denn, m, '⏳ Mengunggah gambar...', {
            title: 'Image to Video', body: 'Uploading...'
        }).catch(() => null);

        try {
            const buffer = await getBuffer(m.quoted.msg, 'image');
            if (!buffer || buffer.length < 100) throw new Error('Gagal mengunduh gambar.');

            const imageUrl = await uploadImage(buffer);
            if (!imageUrl) throw new Error('Gagal mengunggah gambar ke server.');

            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }

            const status = await sendFakeQuoted(denn, m, '🎬 AI sedang merender video (1-5 menit)...\n\n_Mohon tunggu, jangan spam command._', {
                title: 'Image to Video', body: 'Rendering...'
            }).catch(() => null);

            let videoBuffer = null;
            let provider = '';
            let lastErr = '';

            try {
                const gradioUrl = await tryGradio(imageUrl, prompt);
                videoBuffer = await downloadVideo(gradioUrl);
                provider = 'Wan 2.2 (HF Space)';
            } catch (e) {
                lastErr = e.message;
                try {
                    videoBuffer = await tryPollinations(imageUrl, prompt);
                    if (videoBuffer) provider = 'Pollinations AI';
                } catch (e2) {
                    lastErr = `${lastErr} | ${e2.message}`;
                }
            }

            if (status?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: status.key }); } catch (_) {}
            }

            if (!videoBuffer) {
                return sendFakeQuoted(denn, m,
                    `❌ *GAGAL MEMBUAT VIDEO*\n\n` +
                    `Provider yang dicoba gagal merender.\n\n` +
                    `*Detail:*\n\`${lastErr.slice(0, 300)}\`\n\n` +
                    `_Coba lagi 5-10 menit, atau gunakan prompt yang lebih sederhana._`,
                    { title: 'Error', body: 'Semua provider gagal' }
                );
            }

            await denn.sendMessage(m.chat, {
                video: videoBuffer,
                mimetype: 'video/mp4',
                caption: `🎬 *AI VIDEO GENERATED*\n\n📝 *Prompt:* ${prompt}\n🤖 *Provider:* ${provider}\n✨ *Request by:* ${m.pushName || 'User'}`
            }, { quoted: m });

        } catch (err) {
            if (wait?.key?.id) {
                try { await denn.sendMessage(m.chat, { delete: wait.key }); } catch (_) {}
            }
            await sendFakeQuoted(denn, m,
                `❌ *GAGAL*\n\n${err.message}`,
                { title: 'Error', body: 'Gagal' }
            );
        }
    }
};