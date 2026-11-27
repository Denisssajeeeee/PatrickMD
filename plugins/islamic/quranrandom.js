import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

export default {
  command: ['quranrandom', 'ayatrandom', 'randomquran'],
  category: 'islamic',
  execute: async (denn, m, { prefix, command }) => {
    try {
      await sendFakeQuoted(denn, m, '⏳ Mengambil ayat Al-Qur\'an acak...', {
        title: 'Quran Random',
        body: 'Sedang memilih ayat'
      })

      const url = `${izzxdBaseUrl}/api/islamic/quran-random`
      const res = await axios.get(url, {
        params: { apikey: izzxdApiKey },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        validateStatus: () => true
      })

      if (res.status !== 200) {
        throw new Error('HTTP ' + res.status)
      }

      const json = res.data
      if (!json || json.status === false || !json.result) {
        throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
      }

      const { surah, verse, audio } = json.result
      
      const surahName = surah.name_english || surah.name_translation || 'Surah'
      const surahNumber = surah.number || '-'
      const verseKey = verse.verse_key || '-'
      const arabic = verse.arabic || ''
      const transliteration = verse.transliteration || ''
      const translation = verse.translations?.indonesian || verse.translations?.sahih_international || ''

      let caption = `📖 *QS. ${surahName} (${surahNumber}) : ${verse.ayah}*\n`
      caption += `🔖 *Ayat:* ${verseKey}\n\n`
      caption += `${arabic}\n\n`
      if (transliteration) caption += `_${transliteration}_\n\n`
      if (translation) caption += `🇮🇩 *Terjemahan:*\n${translation}`

      await sendFakeQuoted(denn, m, caption, {
        title: `QS. ${surahName}`,
        body: `Ayat ${verse.ayah}`
      })

      if (Array.isArray(audio) && audio.length > 0) {
        const audioUrl = audio[0].ayah_audio
        if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
          await denn.sendMessage(m.chat, {
            audio: { url: audioUrl },
            mimetype: 'audio/mp4',
            ptt: false
          }, { quoted: m })
        }
      }

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mengambil ayat acak\n\n_' + msg + '_', {
        title: 'Quran Random',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}