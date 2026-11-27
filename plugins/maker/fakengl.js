import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 60000

function extractImageUrl(json) {
  if (!json) return null
  const candidates = [
    json.url,
    json.image,
    json.result && json.result.url,
    json.result && json.result.image,
    json.result && json.result.image_url,
    json.data && json.data.url,
    json.data && json.data.image,
    json.data && json.data.image_url,
    typeof json.result === 'string' ? json.result : null,
    typeof json.data === 'string' ? json.data : null
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

export default {
  command: ['fakengl', 'fake-ngl'],
  category: 'maker',
  execute: async (denn, m, { prefix, command, text }) => {
    const pesan = (text || '').trim()

    if (!pesan) {
      return sendFakeQuoted(denn, m,
        `💬 *FAKE NGL*\n\nMembuat gambar pesan anonim ala NGL.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <teks pesan>\`\n\n📝 *Contoh:*\n\`${prefix}${command} boong\`\n\`${prefix}${command} kamu siapa?\``,
        { title: 'Fake NGL', body: 'Buat pesan NGL palsu' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Membuat pesan NGL: *${pesan}*...`, {
        title: 'Fake NGL',
        body: 'Sedang memproses'
      })

      const url = `${izzxdBaseUrl}/api/maker/fake-ngl`
      const res = await axios.get(url, {
        params: {
          apikey: izzxdApiKey,
          text: pesan
        },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json, image/*' },
        responseType: 'arraybuffer',
        validateStatus: () => true
      })

      if (res.status !== 200) {
        let errText = ''
        try {
          const j = JSON.parse(Buffer.from(res.data).toString('utf-8'))
          errText = j.message || j.error || j.msg || JSON.stringify(j).slice(0, 200)
        } catch (_) {
          errText = Buffer.from(res.data).toString('utf-8').slice(0, 200)
        }
        throw new Error('HTTP ' + res.status + ' → ' + (errText || '(body kosong)'))
      }

      const contentType = String(res.headers['content-type'] || '').toLowerCase()
      const raw = Buffer.from(res.data)

      if (contentType.includes('application/json')) {
        const json = JSON.parse(raw.toString('utf-8'))
        if (json && json.status === false) {
          throw new Error(json.message || json.error || 'API mengembalikan status gagal')
        }
        const imgUrl = extractImageUrl(json)
        if (!imgUrl) {
          throw new Error('URL gambar tidak ditemukan di response')
        }
        await denn.sendMessage(m.chat, {
          image: { url: imgUrl },
          caption: '✅ *Fake NGL berhasil*'
        }, { quoted: m })
      } else if (contentType.includes('image')) {
        if (raw.length < 100) {
          throw new Error('Buffer gambar terlalu kecil (' + raw.length + ' byte)')
        }
        await denn.sendMessage(m.chat, {
          image: raw,
          caption: '✅ *Fake NGL berhasil*'
        }, { quoted: m })
      } else {
        throw new Error('Content-type tidak dikenali: ' + contentType)
      }

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal membuat Fake NGL\n\n_' + msg + '_', {
        title: 'Fake NGL',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}