import { sendFakeQuoted } from '../../lib/fakequoted.js';
const reply = (denn, m, text) => sendFakeQuoted(denn, m, text, { title: 'Group Setting', body: 'Open & Close Group' });
const norm = (id) => (id || '').toString().split('@')[0].split(':')[0];

function isParticipantAdmin(participants, myIds) {
    const myNorms = myIds.filter(Boolean).map(norm);
    for (const p of participants) {
        const candidates = [
            p.id, p.jid, p.lid, p.phoneNumber,
            p.id?.split('@')[0], p.jid?.split('@')[0]
        ].filter(Boolean).map(norm);

        const match = candidates.some(c => myNorms.includes(c));
        if (!match) continue;
        if (p.admin === 'admin' || p.admin === 'superadmin') return true;
        if (p.isAdmin === true || p.isSuperAdmin === true) return true;
        if (p.role === 'admin' || p.role === 'superadmin') return true;
        return false; 
    }
    return false;
}

export default {
    command: ['open', 'close'],
    category: 'group',
    description: 'Buka / tutup grup (hanya admin)',
    execute: async (denn, m, { command }) => {
        const jid = m.chat;
        if (!jid.endsWith('@g.us')) {
            return await reply(denn, m, '❌ Fitur ini cuma bisa dipake di grup.');
        }

        try {
            const metadata = await denn.groupMetadata(jid);
            const participants = metadata.participants || [];

            console.log('[openclose] metadata participants:', JSON.stringify(participants.slice(0, 3), null, 2));
            console.log('[openclose] denn.user:', JSON.stringify(denn.user));
            console.log('[openclose] m.sender:', m.sender, '| m.key:', JSON.stringify(m.key));

            const senderIds = [
                m.sender,
                m.key?.participant,
                m.key?.participantAlt,
                m.participant,
                m.author,
            ];
            const botIds = [
                denn.user?.id,
                denn.user?.jid,
                denn.user?.lid,
                denn.authState?.creds?.me?.id,
                denn.authState?.creds?.me?.jid,
                denn.authState?.creds?.me?.lid,
            ];
            if (typeof denn.decodeJid === 'function') {
                try { botIds.push(denn.decodeJid(denn.user?.id)); } catch {}
            }

            const isAdmin = isParticipantAdmin(participants, senderIds) || m.fromMe;
            let isBotAdmin = isParticipantAdmin(participants, botIds);

            console.log('[openclose] isAdmin:', isAdmin, '| isBotAdmin:', isBotAdmin, '| botIds:', botIds);

            if (!isAdmin) {
                return await reply(denn, m, '❌ Fitur ini khusus admin grup.');
            }
            if (!isBotAdmin) {
                console.log('[openclose] deteksi bot admin gagal, tetep coba groupSettingUpdate...');
            }

            const isOpen = command === 'open';
            try {
                await denn.groupSettingUpdate(jid, isOpen ? 'not_announcement' : 'announcement');
            } catch (updateErr) {
                console.error('[openclose] groupSettingUpdate gagal:', updateErr);
                return await reply(denn, m, '❌ Bot harus jadi admin dulu buat ubah setting grup.\n\nError WA: ' + (updateErr?.message || updateErr));
            }

            await denn.sendMessage(m.chat, { react: { text: isOpen ? '🔓' : '🔒', key: m.key } }).catch(() => {});
            await reply(denn, m,
                isOpen
                    ? `🔓 *GRUP DIBUKA*\n\nSekarang semua member bisa mengirim chat.`
                    : `🔒 *GRUP DITUTUP*\n\nSekarang hanya admin yang bisa mengirim chat.`
            );
        } catch (e) {
            console.error('[openclose error]', e);
            await reply(denn, m, '❌ Error: ' + (e?.message || e));
        }
    }
};