import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 120000

function extractDownloadUrl(json) {
  if (!json) return null
  const candidates = [
    json.url,
    json.download,
    json.download_url,
    json.result && json.result.url,
    json.result && json.result.download,
    json.data && json.data.url,
    json.data && json.data.download,
    typeof json.result === 'string' ? json.result : null,
    typeof json.data === 'string' ? json.data : null
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

export default {
  command: ['web2zip', 'site2zip'],
  category: 'tools',
  execute: async (denn, m, { prefix, command, text }) => {
    const targetUrl = (text || '').trim()

    if (!targetUrl) {
      return sendFakeQuoted(denn, m,
        `📦 *WEB2ZIP*\n\nMengunduh seluruh halaman website menjadi file ZIP.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <url_website>\`\n\n📝 *Contoh:*\n\`${prefix}${command} https://example.com\``,
        { title: 'Web2Zip', body: 'Unduh website jadi ZIP' }
      )
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      return sendFakeQuoted(denn, m, '❌ *URL tidak valid.*\n\nPastikan URL diawali dengan `http://` atau `https://`.', {
        title: 'Web2Zip',
        body: 'URL tidak valid'
      })
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Mengunduh *${targetUrl}*...`, {
        title: 'Web2Zip',
        body: 'Sedang memproses website'
      })

      const url = `${izzxdBaseUrl}/api/tools/web2zip`
      const res = await axios.get(url, {
        params: {
          apikey: izzxdApiKey,
          url: targetUrl,
          output: 'zip'
        },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/zip, application/json' },
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

      if (contentType.includes('application/zip') || (contentType.includes('application/octet-stream') && !contentType.includes('json'))) {
        if (raw.length < 100) {
          throw new Error('File ZIP terlalu kecil (' + raw.length + ' byte)')
        }
        await denn.sendMessage(m.chat, {
          document: raw,
          mimetype: 'application/zip',
          fileName: `website_${Date.now()}.zip`,
          caption: `✅ *Web2Zip berhasil*\n\n📦 Sumber: ${targetUrl}`
        }, { quoted: m })
        return
      }

      if (contentType.includes('application/json')) {
        const json = JSON.parse(raw.toString('utf-8'))
        if (json && json.status === false) {
          throw new Error(json.message || json.error || 'API mengembalikan status gagal')
        }

        const downloadUrl = extractDownloadUrl(json)
        if (!downloadUrl) {
          throw new Error('Tautan unduhan ZIP tidak ditemukan di respons API')
        }

        try {
          const zipRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: T_API,
            headers: { 'User-Agent': UA },
            maxContentLength: 100 * 1024 * 1024
          })
          const zipBuffer = Buffer.from(zipRes.data)
          if (zipBuffer.length < 100) {
            throw new Error('File ZIP dari tautan unduhan terlalu kecil')
          }
          await denn.sendMessage(m.chat, {
            document: zipBuffer,
            mimetype: 'application/zip',
            fileName: `website_${Date.now()}.zip`,
            caption: `✅ *Web2Zip berhasil*\n\n📦 Sumber: ${targetUrl}`
          }, { quoted: m })
        } catch (_) {
          await sendFakeQuoted(denn, m,
            `✅ *Web2Zip selesai*\n\n📦 Sumber: ${targetUrl}\n🔗 Unduhan: ${downloadUrl}`,
            { title: 'Web2Zip', body: 'Tautan unduhan tersedia' }
          )
        }
        return
      }

      throw new Error('Content-type tidak dikenali: ' + contentType)

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mengunduh website\n\n_' + msg + '_', {
        title: 'Web2Zip',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}