import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function extractWallpapers(json) {
  if (!json) return []

  const tryArray = (v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      if (Array.isArray(v.wallpapers)) return v.wallpapers
      if (Array.isArray(v.data)) return v.data
      if (Array.isArray(v.items)) return v.items
      if (Array.isArray(v.results)) return v.results
    }
    return null
  }

  return tryArray(json.result) || tryArray(json.data) || tryArray(json) || []
}

function getImageUrl(item) {
  if (!item) return null

  const candidates = [
    item.url,
    item.image,
    item.img,
    item.thumbnail,
    item.thumb,
    item.image_url,
    item.url_image,
    item.link,
    item.source,
    item.path,
    item.download,
    item.original,
    item.full,
    item.hd,
    item.images && item.images.orig && item.images.orig.url,
    item.images && item.images.original && item.images.original.url,
    item.images && item.images.large && item.images.large.url,
    item.media && item.media.images && item.media.images.orig && item.media.images.orig.url,
    item.media && item.media.images && item.media.images.original && item.media.images.original.url
  ]

  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }

  if (item.image && typeof item.image === 'object') {
    const nested = [item.image.url, item.image.src, item.image.link, item.image.path]
    for (const n of nested) {
      if (typeof n === 'string' && /^https?:\/\//i.test(n)) return n
    }
  }

  return null
}

function getTitle(item) {
  if (!item) return null
  const t = item.title || item.name || item.description || item.caption || item.tag
  if (typeof t === 'string' && t.trim()) {
    const clean = t.trim().replace(/\s+/g, ' ')
    return clean.length > 120 ? clean.slice(0, 120) + '...' : clean
  }
  return null
}

function getLink(item) {
  if (!item) return null
  const l = item.link || item.url || item.source || item.page_url
  if (typeof l === 'string' && /^https?:\/\//i.test(l)) return l
  return null
}

export default {
  command: ['wallpaper', 'wp', 'searchwallpaper'],
  category: 'search',
  execute: async (denn, m, { prefix, command, text }) => {
    const query = (text || '').trim()

    if (!query) {
      return sendFakeQuoted(denn, m,
        `🖼️ *WALLPAPER SEARCH*\n\nMencari wallpaper berkualitas tinggi.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <kata kunci>\`\n\n📝 *Contoh:*\n\`${prefix}${command} anime aesthetic\`\n\`${prefix}${command} nature 4k\`\n\`${prefix}${command} kucing lucu\``,
        { title: 'Wallpaper Search', body: 'Cari wallpaper' }
      )
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mencari wallpaper *${query}*...`, {
        title: 'Wallpaper Search',
        body: 'Sedang mengambil data'
      })

      const url = `${jereBaseUrl}/api/search/wallpaper`
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

      const items = extractWallpapers(json)
      if (items.length === 0) {
        return sendFakeQuoted(denn, m, `📭 Tidak ada wallpaper untuk *${query}*.`, {
          title: 'Wallpaper Search',
          body: 'Pencarian kosong'
        })
      }

      const withImage = items.map(it => ({ item: it, img: getImageUrl(it) })).filter(x => x.img)

      if (withImage.length > 0) {
        const maxSend = Math.min(withImage.length, 5)
        for (let i = 0; i < maxSend; i++) {
          const { item, img } = withImage[i]
          const title = getTitle(item)
          const link = getLink(item)
          let caption = `🖼️ *Wallpaper* (${i + 1}/${maxSend})`
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
      for (let i = 0; i < Math.min(items.length, maxShow); i++) {
        const title = getTitle(items[i])
        const link = getLink(items[i])
        lines.push(`*${i + 1}.* ${title || 'Tanpa judul'}`)
        if (link) lines.push(`🔗 ${link}`)
        lines.push('')
      }
      const header = `🖼️ *Hasil Wallpaper: ${query}*\n\n`
      const footer = items.length > maxShow ? `_... dan ${items.length - maxShow} hasil lainnya_` : ''
      await sendFakeQuoted(denn, m, header + lines.join('\n') + footer, {
        title: 'Wallpaper Search',
        body: `Hasil untuk ${query}`
      })

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mencari wallpaper\n\n_' + msg + '_', {
        title: 'Wallpaper Search',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}