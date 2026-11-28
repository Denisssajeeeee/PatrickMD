/**
 * Name : Canvas fake channel WhatsApp versi android
 * Creator : Razeerh
 * Source : https://whatsapp.com/channel/0029VbCN4sQLo4hhDCkOHX1m
 * Base Web/Apps : -
 * Type : Canvas
 * Description : Canvas fake channel lah intinya. 
 * Remake : DennCode
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadContentFromMessage } from '@rexxhayanasi/elaina-baileys'
import { renderChannel, parseDate } from '../../lib/channelCanvas.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMP_DIR = path.join(__dirname, '../../temp')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

function toNumber(value, label) {
    const n = parseInt(String(value).replace(/[.,\s]/g, ''), 10)
    if (!Number.isFinite(n) || n < 0) throw new Error(`Nilai \( {label} tidak valid: " \){value}"`)
    return n
}

function parseFields(text) {
    const fields = String(text || '').split('|').map((v) => v.trim())
    if (fields.length < 6) {
        throw new Error(
            'Format kurang. Butuh:\nnama|pengikut|deskripsi|tanggal|dijangkau|bersih\n\nContoh:\nPatrickMD|12500|Bot WhatsApp keren|20-08-2026|85000|320'
        )
    }
    const [name, followers, description, created, reached, clean] = fields
    if (!name) throw new Error('Nama channel kosong')
    return {
        name,
        followers: toNumber(followers, 'pengikut'),
        description: description || '',
        created: parseDate(created),
        reached: toNumber(reached, 'akun dijangkau'),
        clean: toNumber(clean, 'pengikut bersih')
    }
}

async function getProfileBuffer(denn, m) {
    const q = m.quoted
    const msg = q?.msg || q?.message || (m.mtype === 'imageMessage' ? m.msg : null)
    const mime = (q?.msg || q)?.mimetype || msg?.mimetype || ''
    if (msg && /image/.test(mime)) {
        const stream = await downloadContentFromMessage(msg, 'image')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        return Buffer.concat(chunks)
    }
    if (m.mtype === 'imageMessage' && m.msg) {
        const stream = await downloadContentFromMessage(m.msg, 'image')
        const chunks = []
        for await (const chunk of stream) chunks.push(chunk)
        return Buffer.concat(chunks)
    }
    return null
}

export default {
    command: ['fakechannel', 'fakech', 'channelcanvas', 'canvasch'],
    category: 'tools',
    description: 'Buat canvas fake channel WhatsApp',
    execute: async (denn, m, { prefix, command, text }) => {
        if (!text) {
            return sendFakeQuoted(
                denn, m,
                `📢 *FAKE CHANNEL CANVAS*\n\n` +
                `📌 *Format:*\n` +
                `\`${prefix + command} nama|pengikut|deskripsi|tanggal|dijangkau|bersih\`\n\n` +
                `📷 *Foto profil:* reply gambar atau kirim gambar + caption perintah\n\n` +
                `💡 *Contoh:*\n` +
                `\`${prefix + command} PatrickMD|12500|Bot WhatsApp keren|20-08-2026|85000|320\`\n\n` +
                `_Tanggal: 20-08-2026 atau 2026-08-20_`,
                { title: 'Fake Channel', body: 'Canvas channel WhatsApp' }
            )
        }

        await denn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {})

        try {
            const data = parseFields(text)
            const profileBuf = await getProfileBuffer(denn, m)
            if (!profileBuf) {
                return sendFakeQuoted(
                    denn, m,
                    '❌ Reply / kirim *foto profil* channel bersama perintah ini.',
                    { title: 'Fake Channel', body: 'Foto wajib' }
                )
            }

            const jpeg = await renderChannel({
                profile: profileBuf,
                name: data.name,
                followers: data.followers,
                description: data.description,
                created: data.created,
                reached: data.reached,
                clean: data.clean
            })

            const outPath = path.join(TEMP_DIR, `channel_${Date.now()}.jpg`)
            fs.writeFileSync(outPath, jpeg)

            await denn.sendMessage(m.chat, {
                image: fs.readFileSync(outPath),
                caption: `📢 *${data.name}*\nSaluran · ${data.followers.toLocaleString('id-ID')} pengikut`
            }, { quoted: m })

            try { fs.unlinkSync(outPath) } catch (_) {}
            await denn.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {})
        } catch (err) {
            await denn.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {})
            await sendFakeQuoted(
                denn, m,
                `❌ Gagal membuat canvas.\n\n_${err?.message || err}_`,
                { title: 'Fake Channel', body: 'Error' }
            )
        }
    }
}