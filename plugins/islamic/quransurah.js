import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function extractSurahs(json) {
  if (!json) return []

  const tryArray = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      if (Array.isArray(v.surahs)) return v.surahs
      if (Array.isArray(v.data)) return v.data
      if (Array.isArray(v.result)) return v.result
    }
    return null
  }

  return tryArray(json.result) || tryArray(json.data) || tryArray(json.surahs) || tryArray(json) || []
}

function formatSurah(surah) {
  const number = surah.number || surah.id || surah.nomor || '-'
  const name = surah.name || surah.nama || surah.englishName || surah.name_latin || 'Tanpa Nama'
  const ayahs = surah.numberOfAyahs || surah.ayahs || surah.jumlah_ayat || '-'
  const revelation = surah.revelationType || surah.tempat_turun || surah.type || '-'
  return `*${number}.* ${name}\n📖 ${ayahs} Ayat | 📍 ${revelation}`
}

export default {
  command: ['quransurah', 'surah', 'listsurah'],
  category: 'islamic',
  execute: async (denn, m, { prefix, command, text }) => {
    const input = (text || '').trim()
    const isDetail = /^\d+$/.test(input)

    try {
      await sendFakeQuoted(denn, m, isDetail ? `⏳ Mengambil Surah ${input}...` : '⏳ Mengambil daftar surah...', {
        title: 'Quran Surah',
        body: isDetail ? 'Mengambil detail surah' : 'Mengambil daftar surah'
      })

      const url = `${izzxdBaseUrl}/api/islamic/quran-surah`
      const params = { apikey: izzxdApiKey }
      
      if (isDetail) {
        params.surah = input
        params.id = input
        params.nomor = input
      }

      const res = await axios.get(url, {
        params: params,
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

      const surahs = extractSurahs(json)
      if (surahs.length === 0) {
        throw new Error('Data surah tidak ditemukan di respons API')
      }

      if (isDetail) {
        const found = surahs.find(s => 
          String(s.number) === input || 
          String(s.id) === input || 
          String(s.nomor) === input
        )
        if (!found) {
          throw new Error(`Surah dengan nomor ${input} tidak ditemukan`)
        }
        const lines = []
        lines.push(`📖 *${found.name || found.nama || found.englishName || 'Surah'}*`)
        lines.push(`🔢 Nomor: ${found.number || found.id || found.nomor || '-'}`)
        lines.push(`📄 Ayat: ${found.numberOfAyahs || found.ayahs || found.jumlah_ayat || '-'}`)
        lines.push(`📍 Diturunkan: ${found.revelationType || found.tempat_turun || '-'}`)
        if (found.englishNameTranslation || found.arti) {
          lines.push(`🌐 Arti: ${found.englishNameTranslation || found.arti}`)
        }
        if (found.description || found.deskripsi) {
          const desc = String(found.description || found.deskripsi).replace(/\s+/g, ' ').trim()
          lines.push(`\n📝 ${desc.length > 300 ? desc.slice(0, 300) + '...' : desc}`)
        }
        return sendFakeQuoted(denn, m, lines.join('\n'), {
          title: 'Quran Surah',
          body: `Detail Surah ${input}`
        })
      }

      const maxShow = 20
      const shown = surahs.slice(0, maxShow)
      const lines = shown.map(formatSurah)
      const header = `📚 *Daftar Surah Al-Qur'an* (${surahs.length} surah)\n\n`
      const footer = surahs.length > maxShow ? `\n\n_... dan ${surahs.length - maxShow} surah lainnya_\n\n📌 Gunakan \`${prefix}${command} <nomor>\` untuk detail surah.` : `\n\n📌 Gunakan \`${prefix}${command} <nomor>\` untuk detail surah.`

      await sendFakeQuoted(denn, m, header + lines.join('\n\n') + footer, {
        title: 'Quran Surah',
        body: 'Daftar Surah'
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mengambil data surah\n\n_' + msg + '_', {
        title: 'Quran Surah',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}