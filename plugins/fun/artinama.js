import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function extractArti(json) {
  if (!json) return null

  const tryValue = (v) => {
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (v && typeof v === 'object') {
      return v.arti || v.meaning || v.description || v.text || v.result || null
    }
    return null
  }

  const fromResult = tryValue(json.result)
  if (fromResult) return fromResult

  const fromData = tryValue(json.data)
  if (fromData) return fromData

  if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()

  return null
}

export default {
  command: ['artinama', 'arti'],
  category: 'fun',
  execute: async (denn, m, { prefix, command, text }) => {
    const nama = (text || '').trim()

    if (!nama) {
      return sendFakeQuoted(denn, m,
        `📖 *ARTI NAMA (PRIMBON)*\n\nMencari arti nama berdasarkan primbon Jawa.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <nama>\`\n\n📝 *Contoh:*\n\`${prefix}${command} Budi\`\n\`${prefix}${command} Siti Rahayu\``,
        { title: 'Primbon Arti Nama', body: 'Cari arti nama' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mencari arti nama *${nama}*...`, {
        title: 'Primbon Arti Nama',
        body: 'Sedang mengambil data'
      })

      const url = `${jereBaseUrl}/api/primbon/artinama`
      const res = await axios.get(url, {
        params: {
          apikey: jereApiKey,
          nama: nama,
          name: nama
        },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        validateStatus: () => true
      })

      if (res.status !== 200) {
        throw new Error('HTTP ' + res.status)
      }

      const json = res.data
      if (!json || json.status === false) {
        throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
      }

      const arti = extractArti(json)
      if (!arti) {
        throw new Error('Arti nama tidak ditemukan di response API')
      }

      const caption = `📖 *ARTI NAMA: ${nama.toUpperCase()}*\n\n${arti}`

      await sendFakeQuoted(denn, m, caption, {
        title: 'Primbon Arti Nama',
        body: `Arti nama ${nama}`
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mencari arti nama\n\n_' + msg + '_', {
        title: 'Primbon Arti Nama',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}