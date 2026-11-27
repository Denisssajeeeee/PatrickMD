import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000

function formatMessage(msg) {
  const lines = []
  lines.push(`📨 *Dari:* ${msg.sender || '-'}`)
  lines.push(`⏱️ *Waktu:* ${msg.time || '-'}`)
  if (msg.otp) lines.push(`🔑 *OTP:* \`${msg.otp}\``)
  const text = String(msg.message || '').replace(/\s+/g, ' ').trim()
  const truncated = text.length > 200 ? text.slice(0, 200) + '...' : text
  lines.push(`💬 *Pesan:* ${truncated || '-'}`)
  return lines.join('\n')
}

async function fetchWithRetry(url, params, maxRetries = 2) {
  let attempt = 0
  while (attempt <= maxRetries) {
    const res = await axios.get(url, {
      params,
      timeout: T_API,
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      validateStatus: () => true
    })

    if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
      attempt++
      await new Promise(r => setTimeout(r, 1500))
      continue
    }

    return res
  }
}

export default {
  command: ['receivesms', 'sms', 'viralnumber'],
  category: 'tools',
  execute: async (denn, m, { prefix, command, text, args }) => {
    try {
      const sub = (args[0] || '').toLowerCase()
      const isRead = sub === 'read' || /^\+?[0-9]+$/.test(sub)
      const targetNumber = isRead && sub === 'read' ? args[1] : (isRead ? sub : null)

      if (isRead) {
        if (!targetNumber) {
          return sendFakeQuoted(denn, m,
            `📱 *RECEIVE SMS*\n\nMembaca SMS masuk dari nomor virtual.\n\n📌 *Cara pakai:*\n\`${prefix}${command} read <nomor>\`\n\`${prefix}${command} <nomor>\`\n\n📝 *Contoh:*\n\`${prefix}${command} read +13478245640\`\n\`${prefix}${command} +13478245640\``,
            { title: 'Receive SMS', body: 'Baca SMS dari nomor virtual' }
          )
        }

        await sendFakeQuoted(denn, m, `⏳ Mengambil SMS untuk nomor *${targetNumber}*...`, {
          title: 'Receive SMS',
          body: 'Sedang mengambil data'
        })

        const url = `${jereBaseUrl}/api/tools/receivesms`
        const res = await fetchWithRetry(url, { apikey: jereApiKey, action: 'read', number: targetNumber })

        if (res.status !== 200) {
          throw new Error('HTTP ' + res.status)
        }

        const json = res.data
        if (!json || json.status === false) {
          throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
        }

        const messages = Array.isArray(json.messages) ? json.messages : []
        if (messages.length === 0) {
          return sendFakeQuoted(denn, m, `📭 Tidak ada SMS untuk nomor *${targetNumber}*.`, {
            title: 'Receive SMS',
            body: 'Kotak masuk kosong'
          })
        }

        const recent = messages.slice(0, 5)
        const header = `📱 *SMS untuk ${json.number || targetNumber}* (${json.total_messages || messages.length} pesan)\n\n`
        const bodyText = recent.map(formatMessage).join('\n\n---\n\n')
        const footer = messages.length > 5 ? `\n\n_... dan ${messages.length - 5} pesan lainnya_` : ''

        await sendFakeQuoted(denn, m, header + bodyText + footer, {
          title: 'Receive SMS',
          body: 'Hasil pembacaan SMS'
        })
        return
      }

      if (sub === 'list' || !sub) {
        await sendFakeQuoted(denn, m, '⏳ Mengambil daftar nomor virtual...', {
          title: 'Receive SMS',
          body: 'Sedang mengambil daftar'
        })

        const url = `${jereBaseUrl}/api/tools/receivesms`
        const res = await fetchWithRetry(url, { apikey: jereApiKey })

        if (res.status !== 200) {
          throw new Error('HTTP ' + res.status)
        }

        const json = res.data
        if (!json || json.status === false) {
          throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
        }

        const list = Array.isArray(json.result) ? json.result : []
        if (list.length === 0) {
          return sendFakeQuoted(denn, m, '📭 Tidak ada nomor virtual yang tersedia.', {
            title: 'Receive SMS',
            body: 'Daftar kosong'
          })
        }

        const maxShow = 10
        const lines = list.slice(0, maxShow).map((item, idx) => {
          return `${idx + 1}. ${item.flag || '🏳️'} *${item.number}* (${item.country || '-'})`
        })
        const header = `📋 *Daftar Nomor Virtual* (${json.total || list.length} tersedia)\n\n`
        const footer = list.length > maxShow ? `\n\n_... dan ${list.length - maxShow} nomor lainnya_` : ''
        const usage = `\n\n📌 Gunakan:\n\`${prefix}${command} read <nomor>\` untuk membaca SMS.`

        await sendFakeQuoted(denn, m, header + lines.join('\n') + footer + usage, {
          title: 'Receive SMS',
          body: 'Daftar nomor virtual tersedia'
        })
        return
      }

      return sendFakeQuoted(denn, m,
        `📱 *RECEIVE SMS*\n\nMelihat daftar nomor virtual atau membaca SMS.\n\n📌 *Cara pakai:*\n\`${prefix}${command} list\` — lihat daftar nomor\n\`${prefix}${command} read <nomor>\` — baca SMS\n\`${prefix}${command} <nomor>\` — baca SMS langsung`,
        { title: 'Receive SMS', body: 'Bantuan penggunaan' }
      )

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal mengakses Receive SMS\n\n_' + msg + '_', {
        title: 'Receive SMS',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}