import axios from 'axios'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 60000

const WEB_BASE = () => global.jereBaseUrl || 'https://api.jerexd.my.id'
const JERE_KEY = () => global.jereApiKey || ''
const log = (...a) => console.log('[FakeDana]', ...a)

function extractError(raw) {
    try {
        const parsed = JSON.parse(raw.toString('utf-8'))
        return parsed.message || parsed.error || parsed.msg || JSON.stringify(parsed)
    } catch (_) {
        return raw.toString('utf-8').slice(0, 300)
    }
}

async function sendImageResult(denn, m, res, nominal) {
    const contentType = String(res.headers['content-type'] || '').toLowerCase()
    const raw = Buffer.from(res.data)

    if (res.status !== 200) {
        throw new Error('API HTTP ' + res.status + ' → ' + extractError(raw))
    }

    const caption = `✅ *Fake DANA* — Nominal: Rp ${nominal}`

    if (contentType.includes('application/json')) {
        let json = null
        try { json = JSON.parse(raw.toString('utf-8')) } catch (e) {
            throw new Error('Response JSON tidak valid: ' + e.message)
        }
        if (json && json.status === false) {
            throw new Error(json.message || json.error || 'API status: false')
        }
        const result = (json && json.result !== undefined) ? json.result : (json ? json.data : null)
        let imgUrl = null
        if (typeof result === 'string') imgUrl = result
        else if (result && typeof result === 'object') {
            if (typeof result.url === 'string') imgUrl = result.url
            else if (typeof result.image === 'string') imgUrl = result.image
            else if (typeof result.image_url === 'string') imgUrl = result.image_url
        }
        if (!imgUrl) {
            throw new Error('URL gambar tidak ditemukan. Response: ' + raw.toString('utf-8').slice(0, 300))
        }
        await denn.sendMessage(m.chat, { image: { url: imgUrl }, caption }, { quoted: m })
    } else if (contentType.includes('image')) {
        if (raw.length < 100) throw new Error('Buffer gambar terlalu kecil (' + raw.length + ' byte)')
        await denn.sendMessage(m.chat, { image: raw, caption }, { quoted: m })
    } else {
        throw new Error('Content-type tidak dikenali: ' + contentType + ' | Body: ' + raw.toString('utf-8').slice(0, 200))
    }
}

export default {
    command: ['fakedana'],
    category: 'maker',
    execute: async (denn, m, { prefix, command, text, args }) => {
        try {
            let nominal = null
            if (args && args[0]) {
                nominal = args[0].replace(/[^0-9]/g, '')
            } else if (text) {
                nominal = text.trim().split(/\s+/)[0].replace(/[^0-9]/g, '')
            }

            if (!nominal || parseInt(nominal, 10) <= 0) {
                return sendFakeQuoted(denn, m,
                    `💳 *FAKE DANA*\n\nMembuat gambar struk DANA palsu.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <nominal>\`\n\n📝 *Contoh:*\n\`${prefix}${command} 20000\`\n\`${prefix}${command} 50000\``,
                    { title: 'Fake DANA', body: 'Buat struk DANA palsu' }
                )
            }

            await sendFakeQuoted(denn, m, `⏳ Membuat struk DANA nominal Rp ${nominal}...`, {
                title: 'Fake DANA',
                body: 'Mohon tunggu sebentar'
            })

            const url = `${WEB_BASE()}/api/maker/fakedana?apikey=${encodeURIComponent(JERE_KEY())}&nominal=${encodeURIComponent(nominal)}`
            log('Request:', url)

            const res = await axios.get(url, {
                timeout: T_API,
                headers: { 'User-Agent': UA, 'Accept': 'application/json, image/*' },
                responseType: 'arraybuffer',
                validateStatus: () => true
            })

            log('Status:', res.status, 'Content-Type:', res.headers['content-type'])
            await sendImageResult(denn, m, res, nominal)

        } catch (err) {
            const msg = (err && err.message) ? err.message : 'Unknown error'
            log('Error:', msg)
            await sendFakeQuoted(denn, m, '❌ Gagal membuat struk DANA\n\n_' + msg + '_', {
                title: 'Patrick MD',
                body: 'Terjadi kesalahan pada API Fake DANA'
            })
        }
    }
}