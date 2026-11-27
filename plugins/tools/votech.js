import axios from 'axios';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const CORS_PROXY = 'https://corsproxy.io/?';

const buildApiUrl = (targetUrl, number) => {
    const key = global.nexadevApiKey;
    if (!key) throw new Error('nexadevApiKey belum diatur di settings.js');
    const base = `https://api.nexadev.my.id/api/vote/?key=${encodeURIComponent(key)}`;
    return `${base}&url=${encodeURIComponent(targetUrl)}&number=${encodeURIComponent(number)}`;
};

const fetchVote = async (apiUrl) => {
    const useProxy = global.nexadevUseCorsProxy === true;
    const finalUrl = useProxy ? CORS_PROXY + encodeURIComponent(apiUrl) : apiUrl;

    const res = await axios.get(finalUrl, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        validateStatus: () => true
    });

    return res.data;
};

export default {
    command: ['vote', 'votech'],
    category: 'tools',
    execute: async (denn, m, { args, prefix }) => {
        if (args.length < 2) {
            return sendFakeQuoted(denn, m,
                `🗳️ *VOTE POLLING*\n\n` +
                `*Format:* \`${prefix}vote <url_polling> <nomor_pilihan>\`\n\n` +
                `*Contoh:*\n` +
                `\`${prefix}vote https://whatsapp.com/channel/0029Vb8vySGAYlUMLcZVFT3d/123 1\``,
                { title: 'Vote Polling', body: 'Kirim suara ke polling' }
            );
        }

        const targetUrl = args[0];
        const number = args[1];

        if (!/^https?:\/\//i.test(targetUrl)) {
            return sendFakeQuoted(denn, m, '❌ URL polling tidak valid. Harus diawali http:// atau https://');
        }

        if (!/^\d+$/.test(number)) {
            return sendFakeQuoted(denn, m, '❌ Nomor pilihan harus berupa angka.');
        }

        // === PROSES: pesan ASLI tapi tampilan FAKEQUOTED, biar bisa di-EDIT ===
        let waitMsg = null;
        try {
            waitMsg = await denn.sendMessage(m.chat, {
                text: `⏳ Mengirim vote... Mohon tunggu.\n🗳️ Polling: ${targetUrl}\n🔢 Pilihan: ${number}`,
                contextInfo: {
                    externalAdReply: {
                        title: 'Vote Polling',
                        body: 'Memproses...',
                        thumbnailUrl: 'https://i.imgur.com/8Qm8Z8x.png',
                        mediaType: 1,
                        renderLargerThumbnail: false,
                        sourceUrl: targetUrl
                    }
                }
            }, { quoted: m });
        } catch (e) {
            console.log('[vote] wait gagal:', e.message);
            waitMsg = await sendFakeQuoted(denn, m, '⏳ Mengirim vote... Mohon tunggu.', { title: 'Vote Polling', body: 'Memproses...' }).catch(() => null);
        }

        // === EDIT: gak ada delete sama sekali ===
        const editWait = async (newText) => {
            if (!waitMsg?.key) {
                return sendFakeQuoted(denn, m, newText, { title: 'Hasil Vote', body: 'Selesai' });
            }
            try {
                await denn.sendMessage(m.chat, {
                    text: newText,
                    edit: waitMsg.key,
                    contextInfo: {
                        externalAdReply: {
                            title: 'Vote Polling',
                            body: `Pilihan: ${number}`,
                            thumbnailUrl: 'https://i.imgur.com/8Qm8Z8x.png',
                            mediaType: 1,
                            renderLargerThumbnail: false,
                            sourceUrl: targetUrl
                        }
                    }
                });
            } catch (e) {
                console.log('[vote] edit gagal, kirim fakequoted baru:', e.message);
                await sendFakeQuoted(denn, m, newText, { title: 'Hasil Vote', body: 'Selesai' });
            }
        };

        try {
            const apiUrl = buildApiUrl(targetUrl, number);
            const data = await fetchVote(apiUrl);

            let replyText = '';
            let isOk = false;
            if (data && typeof data === 'object') {
                if (data.status === true || data.success === true) {
                    isOk = true;
                    const apiMsg = data.message || data.result?.message || '';
                    replyText = `✅ *VOTE BERHASIL DIKIRIM*\n\n📊 Polling: ${targetUrl}\n🔢 Pilihan: ${number}` +
                        (apiMsg ? `\n\n_${apiMsg}_` : '');
                } else {
                    const errMsg = data.message || data.error || data.result?.message || JSON.stringify(data).slice(0, 800);
                    replyText = `❌ *GAGAL VOTE*\n\n${errMsg}`;
                }
            } else {
                isOk = true;
                replyText = `✅ *VOTE TERKIRIM*\n\n📊 Polling: ${targetUrl}\n🔢 Pilihan: ${number}\n\nRespons mentah: ${String(data).slice(0, 300)}`;
            }

            // 1. EDIT pesan proses jadi hasil
            await editWait(replyText);

            // 2. Button terpisah, kalo gagal hasil tetep aman
            if (isOk) {
                const templateButtons = [
                    { index: 1, quickReplyButton: { displayText: '👑 Owner', id: `${prefix}owner` } },
                    { index: 2, quickReplyButton: { displayText: '📋 Menu', id: `${prefix}menu` } },
                    { index: 3, quickReplyButton: { displayText: 'ℹ️ Info', id: `${prefix}info` } }
                ];
                try {
                    await denn.sendMessage(m.chat, {
                        text: 'Pilih menu di bawah:',
                        footer: 'Vote Polling • NexaDev API',
                        templateButtons: templateButtons,
                        headerType: 1,
                        contextInfo: {
                            externalAdReply: {
                                title: 'Vote Polling',
                                body: `Pilihan ${number} terkirim`,
                                thumbnailUrl: 'https://i.imgur.com/8Qm8Z8x.png',
                                mediaType: 1,
                                renderLargerThumbnail: false,
                                sourceUrl: targetUrl
                            }
                        }
                    }, { quoted: m });
                } catch (e) {
                    console.log('[vote] button gagal, kirim fakequoted:', e.message);
                    await sendFakeQuoted(denn, m, `*— Menu Cepat —*\n👑 Owner: \`${prefix}owner\`\n📋 Menu: \`${prefix}menu\`\nℹ️ Info: \`${prefix}info\``, {
                        title: 'Vote Polling', body: `Pilihan ${number} terkirim`
                    });
                }
            }

        } catch (err) {
            await editWait(
                `❌ *GAGAL VOTE*\n\n${err.message}\n\n` +
                `_Jika error terkait CORS/blokir, coba aktifkan \`nexadevUseCorsProxy = true\` di settings.js._`
            );
        }
    }
};