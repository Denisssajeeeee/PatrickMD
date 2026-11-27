import axios from 'axios'
import { izzxdBaseUrl, izzxdApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 60000

function extractMediaUrl(json) {
  if (!json) return null
  const candidates = [
    json.url,
    json.video,
    json.video_url,
    json.result && json.result.url,
    json.result && json.result.video,
    json.data && json.data.url,
    json.data && json.data.video,
    typeof json.result === 'string' ? json.result : null,
    typeof json.data === 'string' ? json.data : null
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && /^https?:\/\//i.test(c)) return c
  }
  return null
}

function formatAccountData(account) {
  if (!account) return 'Data akun tidak ditemukan.'
  const lines = []
  const userId = account.user_id || '-'
  const screenName = account.screen_name || '-'
  const email = account.email || '-'
  const password = account.password || '-'
  const isPro = account.is_pro ? '✅ Ya' : '❌ Tidak'
  const storageQuota = account.storage?.quota || '-'
  const storageUsed = account.storage?.used || '-'
  
  lines.push(`👤 *User ID:* ${userId}`)
  lines.push(`📛 *Screen Name:* ${screenName}`)
  lines.push(`📧 *Email:* ${email}`)
  lines.push(`🔑 *Password:* ${password}`)
  lines.push(`💎 *Status Pro:* ${isPro}`)
  lines.push(`💾 *Storage:* ${storageUsed} / ${storageQuota}`)
  
  if (account.trial && account.trial.token) {
    lines.push(`\n🎁 *Trial Info:*`)
    lines.push(`🔗 *Share Link:* ${account.trial.share_link || '-'}`)
    lines.push(`🔗 *Activation:* ${account.trial.trial_activation_url || '-'}`)
  }
  
  return lines.join('\n')
}

export default {
  command: ['capcutpro', 'ccpro'],
  category: 'tools',
  execute: async (denn, m, { prefix, command, text }) => {
    const input = (text || '').trim()

    try {
      await sendFakeQuoted(denn, m, '⏳ Memproses CapCut Pro...', {
        title: 'CapCut Pro',
        body: 'Sedang mengambil data'
      })

      const url = `${izzxdBaseUrl}/api/tools/capcut-pro`
      
      const params = { apikey: izzxdApiKey }
      if (input) {
        params.url = input
        params.query = input
      }

      const res = await axios.get(url, {
        params: params,
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json, image/*, video/*' },
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
        
        const mediaUrl = extractMediaUrl(json)
        if (mediaUrl) {
          if (/\.(mp4|mov|webm|mkv)/i.test(mediaUrl)) {
            await denn.sendMessage(m.chat, { video: { url: mediaUrl }, caption: '✅ *CapCut Pro*' }, { quoted: m })
          } else if (/\.(jpg|jpeg|png|webp|gif)/i.test(mediaUrl)) {
            await denn.sendMessage(m.chat, { image: { url: mediaUrl }, caption: '✅ *CapCut Pro*' }, { quoted: m })
          } else {
            await denn.sendMessage(m.chat, { document: { url: mediaUrl }, mimetype: 'application/octet-stream', fileName: 'capcut_pro_result' }, { quoted: m })
          }
          return
        }

        const accountData = json.result?.account || json.data?.account || json.account
        
        if (accountData) {
          const caption = `✅ *CapCut Pro Berhasil*\n\n${formatAccountData(accountData)}`
          return sendFakeQuoted(denn, m, caption, {
            title: 'CapCut Pro Account',
            body: 'Detail Akun'
          })
        }

        throw new Error('Struktur respons tidak dikenali atau data akun kosong.')
        
      } else if (contentType.includes('image')) {
        if (raw.length < 100) throw new Error('Buffer gambar terlalu kecil (' + raw.length + ' byte)')
        await denn.sendMessage(m.chat, { image: raw, caption: '✅ *CapCut Pro*' }, { quoted: m })
      } else if (contentType.includes('video')) {
        if (raw.length < 100) throw new Error('Buffer video terlalu kecil (' + raw.length + ' byte)')
        await denn.sendMessage(m.chat, { video: raw, caption: '✅ *CapCut Pro*' }, { quoted: m })
      } else {
        throw new Error('Content-type tidak dikenali: ' + contentType)
      }

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal memproses CapCut Pro\n\n_' + msg + '_', {
        title: 'CapCut Pro',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}