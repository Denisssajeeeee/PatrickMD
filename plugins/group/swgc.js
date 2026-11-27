import {
    jidNormalizedUser,
    generateWAMessageFromContent,
    prepareWAMessageMedia
} from '@rexxhayanasi/elaina-baileys';
import { getBuffer } from '../../lib/helper.js';
import { sendFakeQuoted } from '../../lib/fakequoted.js';

const buildContextInfo = () => ({
    forwardingScore: 0,
    isForwarded: false,
    featureEligibilities: {
        canBeReshared: true,
        canReceiveMultiReact: true
    },
    pairedMediaType: 0,
    statusSourceType: 4,
    statusAttributions: [{ type: 10 }],
    isGroupStatus: true,
    statusAudienceMetadata: {
        audienceType: 1,
        listEmoji: '',
        listName: 'Story Bot'
    }
});

const stripCommand = (text) => {
    if (!text) return '';
    return String(text).replace(/^[!.\/#\-]\w+\s+/, '').trim();
};

const resolveCaption = (typedText, isQuoted, quotedText) => {
    const typed = (typedText || '').trim();
    if (typed) return typed;

    if (isQuoted && quotedText) {
        const stripped = stripCommand(quotedText);
        return stripped;
    }

    return '';
};

export default {
    command: ['upswgc', 'swgc', 'upswgroup'],
    category: 'group',
    groupOnly: true,
    execute: async (denn, m, { text, prefix, checkAdmin }) => {
        const { isAdmin, isBotAdmin } = await checkAdmin();

        if (!isAdmin) return sendFakeQuoted(denn, m, '❌ Command ini khusus Admin grup.');
        if (!isBotAdmin) return sendFakeQuoted(denn, m, '❌ Bot harus Admin grup untuk upload status.');

        const isQuoted = !!m.quoted;
        const targetMsg = isQuoted ? m.quoted.msg : m.msg;
        const mtype = isQuoted ? m.quoted.mtype : m.mtype;
        const caption = resolveCaption(text, isQuoted, m.quoted?.text);

        const senderJid = jidNormalizedUser(denn.user?.id);
        const groupJid = m.chat;

        try {
            if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                const txt = (text || '').trim() || resolveCaption('', isQuoted, m.quoted?.text);
                if (!txt) {
                    return sendFakeQuoted(denn, m,
                        `📢 *UPLOAD SW GRUP*\n\n` +
                        `*Cara pakai:*\n` +
                        `• Reply/kirim media dengan caption \`${prefix}upswgc\`\n` +
                        `• Atau ketik \`${prefix}upswgc <teks>\`\n\n` +
                        `*Support media:* Teks, Gambar, Video.\n` +
                        `_Hanya untuk Admin grup._`,
                        { title: 'SW Group', body: 'Buat status grup' }
                    );
                }

                const innerContent = {
                    extendedTextMessage: {
                        text: txt,
                        font: 1,
                        backgroundArgb: 0xFF23313A,
                        contextInfo: {
                            forwardingScore: 0,
                            featureEligibilities: {
                                canBeReshared: true,
                                canReceiveMultiReact: true
                            },
                            pairedMediaType: 0,
                            isGroupStatus: true,
                            statusAttributions: [{
                                type: 6,
                                groupStatus: { authorJid: senderJid }
                            }]
                        }
                    }
                };

                const generated = generateWAMessageFromContent(
                    groupJid,
                    { groupStatusMessageV2: { message: innerContent } },
                    { userJid: senderJid }
                );

                await denn.relayMessage(groupJid, generated.message, { messageId: generated.key.id });

                return sendFakeQuoted(denn, m, '✅ *BERHASIL DI-UPLOAD KE SW GRUP!*', {
                    title: 'SW Group',
                    body: 'Status teks berhasil dibuat'
                });
            }

            const mediaTypeMap = {
                imageMessage: { kind: 'image', key: 'imageMessage' },
                videoMessage: { kind: 'video', key: 'videoMessage' },
                audioMessage: { kind: 'audio', key: 'audioMessage' }
            };

            const mapped = mediaTypeMap[mtype];
            if (!mapped) {
                return sendFakeQuoted(denn, m, '❌ Tipe media belum didukung. Kirim teks, gambar, video, atau audio.');
            }

            const buffer = await getBuffer(targetMsg, mapped.kind);

            const prepared = await prepareWAMessageMedia(
                { [mapped.kind]: buffer },
                { upload: denn.waUploadToServer }
            );

            const mediaObj = prepared[mapped.key];
            if (!mediaObj) throw new Error('Gagal menyiapkan media untuk status.');

            if (caption && mapped.kind !== 'audio') {
                mediaObj.caption = caption;
            }
            if (mapped.kind === 'audio') {
                mediaObj.ptt = true;
                mediaObj.mimetype = 'audio/ogg; codecs=opus';
            }
            mediaObj.contextInfo = buildContextInfo();

            const generated = generateWAMessageFromContent(
                groupJid,
                { groupStatusMessageV2: { message: { [mapped.key]: mediaObj } } },
                { userJid: senderJid }
            );

            await denn.relayMessage(groupJid, generated.message, { messageId: generated.key.id });

            return sendFakeQuoted(denn, m, '✅ *BERHASIL DI-UPLOAD KE SW GRUP!*', {
                title: 'SW Group',
                body: `Status ${mapped.kind} berhasil dibuat`
            });

        } catch (e) {
            await sendFakeQuoted(denn, m, `❌ Gagal upload SW grup:\n${e.message}`);
        }
    }
};