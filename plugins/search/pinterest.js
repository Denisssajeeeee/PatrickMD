import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function extractPins(json) {
  if (!json) return []

  const tryArray = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      if (Array.isArray(v.pins)) return v.pins
      if (Array.isArray(v.data)) return v.data
      if (Array.isArray(v.items)) return v.items
    }
    return null
  }

  return tryArray(json.result) || tryArray(json.data) || tryArray(json) || []
}

function getImage(pin) {
  if (!pin) return null
  const candidates = [
    pin.image,
    pin.img,
    pin.thumbnail,
    pin.thumb,
    pin.url_image,
    pin.image_url,
    pin.images && pin.images.orig && pin.images.orig.url,
    pin.images && pin.images.original && pin.images.original.url,
    pin.media && pin.media.images && pin.media.images.orig && pin.media.images.orig.url
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

function getTitle(pin) {
  if (!pin) return null
  const t = pin.title || pin.name || pin.description || pin.caption
  if (typeof t === 'string' && t.trim()) {
    return t.trim().length > 120 ? t.trim().slice(0, 120) + '...' : t.trim()
  }
  return null
}

function getLink(pin) {
  if (!pin) return null
  const l = pin.link || pin.url || pin.pin_url || pin.source
  if (typeof l === 'string' && /^https?:\/\//i.test(l)) return l
  return null
}

export default {
  command: ['pin', 'pinterest', 'searchpin'],
  category: 'search',
  execute: async (denn, m, { prefix, command, text }) => {
    const query = (text || '').trim()

    if (!query) {
      return sendFakeQuoted(denn, m,
        `📌 *PINTEREST SEARCH*\n\nMencari gambar/pin di Pinterest.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <kata kunci>\`\n\n📝 *Contoh:*\n\`${prefix}${command} anime aesthetic\`\n\`${prefix}${command} wallpaper kucing\``,
        { title: 'Pinterest Search', body: 'Cari pin Pinterest' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mencari *${query}* di Pinterest...`, {
        title: 'Pinterest Search',
        body: 'Sedang mengambil data'
      })

      const url = `${jereBaseUrl}/api/search/pin`
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

      const pins = extractPins(json)
      if (pins.length === 0) {
        return sendFakeQuoted(denn, m, `📭 Tidak ada hasil untuk *${query}*.`, {
          title: 'Pinterest Search',
          body: 'Pencarian kosong'
        })
      }

      const withImage = pins.map(p => ({ pin: p, img: getImage(p) })).filter(x => x.img)
      if (withImage.length > 0) {
        const maxSend = Math.min(withImage.length, 5)
        for (let i = 0; i < maxSend; i++) {
          const { pin, img } = withImage[i]
          const title = getTitle(pin)
          const link = getLink(pin)
          let caption = `📌 *Pinterest* (${i + 1}/${maxSend})`
          if (title) caption += `\n\n${title}`
          if (link) caption += `\n\n🔗 ${link}`
          try {
            await denn.sendMessage(m.chat, {
              image: { url: img },
              caption
            }, { quoted: i === 0 ? m : undefined })
          } catch (_) {}
        }
        return
      }

      const maxShow = 5
      const lines = []
      for (let i = 0; i < Math.min(pins.length, maxShow); i++) {
        const title = getTitle(pins[i])
        const link = getLink(pins[i])
        lines.push(`*${i + 1}.* ${title || 'Tanpa judul'}`)
        if (link) lines.push(`🔗 ${link}`)
        lines.push('')
      }
      const header = `📌 *Hasil Pinterest: ${query}*\n\n`
      const footer = pins.length > maxShow ? `_... dan ${pins.length - maxShow} hasil lainnya_` : ''
      await sendFakeQuoted(denn, m, header + lines.join('\n') + footer, {
        title: 'Pinterest Search',
        body: `Hasil untuk ${query}`
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mencari di Pinterest\n\n_' + msg + '_', {
        title: 'Pinterest Search',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}