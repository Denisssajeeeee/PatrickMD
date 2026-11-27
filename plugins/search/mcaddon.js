import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function extractAddons(json) {
  if (!json) return []

  const tryArray = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      if (Array.isArray(v.addons)) return v.addons
      if (Array.isArray(v.result)) return v.result
      if (Array.isArray(v.data)) return v.data
      if (Array.isArray(v.items)) return v.items
    }
    return null
  }

  return tryArray(json.result) || tryArray(json.data) || tryArray(json.addons) || tryArray(json) || []
}

function formatAddon(addon, index) {
  const lines = []
  const title = addon.title || addon.name || addon.addon_name || 'Tanpa Judul'
  const desc = addon.description || addon.desc || ''
  const version = addon.version || addon.ver || '-'
  const download = addon.download || addon.url || addon.link || addon.file || null
  const thumbnail = addon.thumbnail || addon.image || addon.icon || null

  lines.push(`*${index + 1}. ${title}*`)
  if (desc) {
    const clean = String(desc).replace(/\s+/g, ' ').trim()
    lines.push(`📝 ${clean.length > 120 ? clean.slice(0, 120) + '...' : clean}`)
  }
  if (version !== '-') lines.push(`📦 Versi: ${version}`)
  if (download && /^https?:\/\//i.test(String(download))) lines.push(`🔗 ${download}`)

  return { text: lines.join('\n'), thumbnail }
}

export default {
  command: ['mcaddon', 'searchmcaddon', 'mcpedl'],
  category: 'search',
  execute: async (denn, m, { prefix, command, text }) => {
    const query = (text || '').trim()

    if (!query) {
      return sendFakeQuoted(denn, m,
        `🧱 *MCADDON SEARCH*\n\nMencari add-on Minecraft Bedrock.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <kata kunci>\`\n\n📝 *Contoh:*\n\`${prefix}${command} orbital strike cannon\`\n\`${prefix}${command} furniture\``,
        { title: 'MCAddon Search', body: 'Cari add-on Minecraft' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mencari add-on *${query}*...`, {
        title: 'MCAddon Search',
        body: 'Sedang mengambil data'
      })

      const url = `${izzxdBaseUrl}/api/search/mcaddon`
      const res = await axios.get(url, {
        params: {
          apikey: izzxdApiKey,
          query: query,
          q: query
        },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        validateStatus: () => true
      })

      if (res.status !== 200) {
        let errText = ''
        try {
          const j = res.data
          errText = (j && (j.message || j.error || j.msg)) || JSON.stringify(j).slice(0, 200)
        } catch (_) {
          errText = String(res.data || '').slice(0, 200)
        }
        throw new Error('HTTP ' + res.status + ' → ' + (errText || '(body kosong)'))
      }

      const json = res.data
      if (!json || json.status === false) {
        throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
      }

      const addons = extractAddons(json)
      if (addons.length === 0) {
        return sendFakeQuoted(denn, m, `📭 Tidak ada add-on ditemukan untuk *${query}*.`, {
          title: 'MCAddon Search',
          body: 'Pencarian kosong'
        })
      }

      const maxShow = 5
      const shown = addons.slice(0, maxShow)
      const formatted = shown.map((addon, idx) => formatAddon(addon, idx))
      
      let caption = `🧱 *Hasil Pencarian MCAddon: ${query}*\n\n`
      caption += formatted.map(f => f.text).join('\n\n')
      if (addons.length > maxShow) {
        caption += `\n\n_... dan ${addons.length - maxShow} hasil lainnya_`
      }

      const firstThumb = formatted.find(f => f.thumbnail && /^https?:\/\//i.test(String(f.thumbnail)))?.thumbnail

      if (firstThumb) {
        try {
          await denn.sendMessage(m.chat, {
            image: { url: String(firstThumb) },
            caption
          }, { quoted: m })
          return
        } catch (_) {}
      }

      await sendFakeQuoted(denn, m, caption, {
        title: 'MCAddon Search',
        body: `Hasil untuk ${query}`
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mencari add-on\n\n_' + msg + '_', {
        title: 'MCAddon Search',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}