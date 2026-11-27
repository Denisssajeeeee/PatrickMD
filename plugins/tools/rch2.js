import { ProxyAgent } from 'undici'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

async function getIkyProxyList() {
  try {
    const res = await fetch('https://api.ikyyxd.my.id/v2l/proxy-free/ikyy-xsample', {
      signal: AbortSignal.timeout(6000)
    })
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data
      .map((item) => {
        const parts = String(item).trim().split(':')
        if (parts.length === 4) {
          return { server: `http://${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3] }
        }
        if (parts.length === 2) {
          return { server: `http://${parts[0]}:${parts[1]}` }
        }
        return null
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

function createProxyAgent(proxy) {
  if (proxy.username && proxy.password) {
    const url = new URL(proxy.server)
    url.username = proxy.username
    url.password = proxy.password
    return new ProxyAgent(url.toString())
  }
  return new ProxyAgent(proxy.server)
}

async function reachChannel(url, emojis, name = 'Angela') {
  try {
    const cleanName = String(name).trim().replace(/\s+/g, ' ').slice(0, 40)
    const cleanUrl = String(url).trim()
    const cleanEmojis = String(emojis).trim()

    if (!/whatsapp\.com\/channel\/[^/]+\/[^/]+/i.test(cleanUrl)) {
      throw new Error('Format URL postingan WhatsApp Channel tidak valid.')
    }
    if (!cleanEmojis) {
      throw new Error('Emoji reaction tidak boleh kosong.')
    }

    const proxies = await getIkyProxyList()
    const maxAttempts = proxies.length > 0 ? Math.min(3, proxies.length) : 1
    let lastError = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const proxy = proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null
      const dispatcher = proxy ? createProxyAgent(proxy) : undefined

      try {
        const res = await fetch('https://www.leovan.my.id/api/react', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': 'https://www.leovan.my.id',
            'Referer': 'https://www.leovan.my.id/'
          },
          body: JSON.stringify({ name: cleanName, url: cleanUrl, emojis: cleanEmojis }),
          dispatcher,
          signal: AbortSignal.timeout(15000)
        })
        const data = await res.json()
        return {
          ok: res.ok && data?.status !== false,
          status: res.status,
          proxy: proxy ? proxy.server : 'direct',
          data
        }
      } catch (err) {
        lastError = err
      } finally {
        if (dispatcher) {
          await dispatcher.close().catch(() => {})
        }
      }
    }

    throw lastError || new Error('Gagal terhubung ke server melalui proxy')
  } catch (err) {
    return { ok: false, status: 0, error: err.message || 'Gagal terhubung ke server' }
  }
}

export default {
  command: ['reachch', 'reactch', 'rch2'],
  category: 'tools',
  execute: async (denn, m, { prefix, command, text, args }) => {
    if (!text) {
      return sendFakeQuoted(denn, m, 
        `📢 *REACH CHANNEL*\n\nMengirim reaction ke postingan WhatsApp Channel.\n\n📌 *Cara pakai:*\n\`${prefix}${command} <url> <emoji> [nama]\`\n\n📝 *Contoh:*\n\`${prefix}${command} https://whatsapp.com/channel/xxx/123 🔥\`\n\`${prefix}${command} https://whatsapp.com/channel/xxx/123 ❤️ Budi\``,
        { title: 'Reach Channel', body: 'Kirim reaction ke channel' }
      )
    }

    const url = args[0]
    const emojis = args[1]
    const name = args.slice(2).join(' ') || 'Angela'

    if (!url || !emojis) {
      return sendFakeQuoted(denn, m, '❌ URL dan emoji wajib diisi.', {
        title: 'Reach Channel', body: 'Parameter kurang'
      })
    }

    await sendFakeQuoted(denn, m, `⏳ Mengirim reaction *${emojis}* ke channel...`, {
      title: 'Reach Channel', body: 'Memproses'
    })

    const result = await reachChannel(url, emojis, name)

    if (result.ok) {
      return sendFakeQuoted(denn, m, `✅ *BERHASIL!*\n\nReaction berhasil dikirim.\nProxy: ${result.proxy}\nStatus: ${result.status}`, {
        title: 'Reach Channel', body: 'Sukses'
      })
    } else {
      return sendFakeQuoted(denn, m, `❌ *GAGAL!*\n\n${result.error || 'Gagal mengirim reaction'}\nStatus: ${result.status}`, {
        title: 'Reach Channel', body: 'Gagal'
      })
    }
  }
}