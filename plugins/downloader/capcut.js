import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 60000

function extractVideoUrl(json) {
  if (!json) return null

  const candidates = [
    json.url,
    json.video,
    json.video_url,
    json.download_url,
    json.result && json.result.url,
    json.result && json.result.video,
    json.result && json.result.video_url,
    json.result && json.result.download_url,
    json.data && json.data.url,
    json.data && json.data.video,
    json.data && json.data.video_url,
    json.data && json.data.download_url,
    typeof json.result === 'string' ? json.result : null,
    typeof json.data === 'string' ? json.data : null
  ]

  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

function extractTitle(json) {
  if (!json) return null
  const candidates = [
    json.title,
    json.caption,
    json.description,
    json.result && json.result.title,
    json.result && json.result.caption,
    json.data && json.data.title,
    json.data && json.data.caption
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim()
  }
  return null
}

export default {
  command: ['capcut', 'capcutdl'],
  category: 'downloader',
  execute: async (denn, m, { prefix, command, text }) => {
    const inputUrl = (text || '').trim()

    if (!inputUrl) {
      return sendFakeQuoted(denn, m,
        `🎬 *CAPCUT DOWNLOADER*\n\nMengunduh video dari CapCut tanpa watermark.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <url_capcut>\`\n\n📝 *Contoh:*\n\`${prefix}${command} https://www.capcut.com/t/xxxxx\``,
        { title: 'CapCut Downloader', body: 'Unduh video CapCut' }
      )
    }

    if (!/^https?:\/\//i.test(inputUrl)) {
      return sendFakeQuoted(denn, m, '❌ *URL tidak valid.*\n\nPastikan kamu mengirim link CapCut yang benar (diawali `http://` atau `https://`).', {
        title: 'CapCut Downloader',
        body: 'URL tidak valid'
      })
    }

    try {
      await sendFakeQuoted(denn, m, '⏳ Mengambil video dari CapCut...', {
        title: 'CapCut Downloader',
        body: 'Sedang memproses'
      })

      const url = `${jereBaseUrl}/api/downloader/capcut`
      const res = await axios.get(url, {
        params: {
          apikey: jereApiKey,
          url: inputUrl
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

      const videoUrl = extractVideoUrl(json)
      if (!videoUrl) {
        throw new Error('URL video tidak ditemukan di response API')
      }

      const title = extractTitle(json)
      let caption = '🎬 *CapCut Video*'
      if (title) caption += `\n\n📝 ${title}`

      try {
        await denn.sendMessage(m.chat, {
          video: { url: videoUrl },
          caption
        }, { quoted: m })
      } catch (videoErr) {
        await denn.sendMessage(m.chat, {
          document: { url: videoUrl },
          mimetype: 'video/mp4',
          fileName: 'capcut.mp4',
          caption: caption + '\n\n_Video dikirim sebagai dokumen karena gagal dikirim sebagai video._'
        }, { quoted: m })
      }

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mengunduh video CapCut\n\n_' + msg + '_', {
        title: 'CapCut Downloader',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}