import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function formatApp(app, index) {
  const lines = []
  const name = app.name || app.title || app.app_name || 'Tanpa Nama'
  const developer = app.developer || app.author || app.publisher || '-'
  const version = app.version || app.latest_version || '-'
  const size = app.size || app.file_size || '-'
  const link = app.link || app.url || app.download_url || null

  lines.push(`*${index + 1}. ${name}*`)
  if (developer !== '-') lines.push(`👤 ${developer}`)
  if (version !== '-') lines.push(`📦 v${version}`)
  if (size !== '-') lines.push(`💾 ${size}`)
  if (link && /^https?:\/\//i.test(String(link))) lines.push(`🔗 ${link}`)

  return lines.join('\n')
}

export default {
  command: ['apkpure', 'searchapk'],
  category: 'search',
  execute: async (denn, m, { prefix, command, text }) => {
    const query = (text || '').trim()

    if (!query) {
      return sendFakeQuoted(denn, m,
        `📱 *APKPURE SEARCH*\n\nMencari aplikasi Android di APKPure.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <nama aplikasi>\`\n\n📝 *Contoh:*\n\`${prefix}${command} WhatsApp\`\n\`${prefix}${command} Mobile Legends\``,
        { title: 'APKPure Search', body: 'Cari aplikasi Android' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mencari *${query}* di APKPure...`, {
        title: 'APKPure Search',
        body: 'Sedang mengambil data'
      })

      const url = `${jereBaseUrl}/api/search/apkpure`
      const res = await axios.get(url, {
        params: {
          apikey: jereApiKey,
          q: query,
          query: query
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

      let list = []
      if (Array.isArray(json.result)) list = json.result
      else if (Array.isArray(json.data)) list = json.data
      else if (json.result && typeof json.result === 'object') {
        if (Array.isArray(json.result.data)) list = json.result.data
        else if (Array.isArray(json.result.apps)) list = json.result.apps
        else list = [json.result]
      } else if (json.data && typeof json.data === 'object') {
        if (Array.isArray(json.data.apps)) list = json.data.apps
        else list = [json.data]
      }

      if (list.length === 0) {
        return sendFakeQuoted(denn, m, `📭 Tidak ada hasil untuk *${query}*.`, {
          title: 'APKPure Search',
          body: 'Pencarian kosong'
        })
      }

      const maxShow = 5
      const shown = list.slice(0, maxShow)
      const lines = shown.map((app, idx) => formatApp(app, idx))
      const header = `📱 *Hasil Pencarian: ${query}*\n\n`
      const footer = list.length > maxShow ? `\n\n_... dan ${list.length - maxShow} hasil lainnya_` : ''

      await sendFakeQuoted(denn, m, header + lines.join('\n\n') + footer, {
        title: 'APKPure Search',
        body: `Hasil untuk ${query}`
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mencari di APKPure\n\n_' + msg + '_', {
        title: 'APKPure Search',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}