import axios from 'axios'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const BASE_URL = 'https://am.kyzzz.xyz'
const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php'

const HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
}

async function createGuerrillaMail() {
  try {
    const { data } = await axios.get(`${GUERRILLA_BASE}?f=get_email_address`, { timeout: 15000 })
    const email = data?.email_addr
    const sid = data?.sid_token
    if (!email || !sid) throw new Error('Gagal membuat temporary email Guerrilla.')
    return {
      email,
      sid,
      alias: data?.alias || ''
    }
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message)
  }
}

async function sendVerificationLink(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Alamat email valid diperlukan.')
  }
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/send-link`,
      { email: email.trim() },
      { headers: HEADERS, timeout: 20000 }
    )
    return data
  } catch (error) {
    throw new Error(error.response?.data?.error || error.response?.data?.message || error.message)
  }
}

async function waitMagicLinkGuerrilla(sid, timeoutSec = 50) {
  const maxTime = timeoutSec * 1000
  const start = Date.now()

  while (Date.now() - start < maxTime) {
    await new Promise(resolve => setTimeout(resolve, 2500))
    const { data } = await axios.get(`${GUERRILLA_BASE}?f=check_email&seq=0&sid_token=${sid}`, { timeout: 15000 })
    const list = data?.list || []

    const amMsg = list.find(m => {
      const subject = (m.mail_subject || '').toLowerCase()
      const from = (m.mail_from || '').toLowerCase()
      return subject.includes('alight') || subject.includes('sign in') || from.includes('firebase') || from.includes('alight')
    })

    if (amMsg) {
      const { data: mailDetail } = await axios.get(`${GUERRILLA_BASE}?f=fetch_email&email_id=${amMsg.mail_id}&sid_token=${sid}`, { timeout: 15000 })
      const body = mailDetail?.mail_body || ''
      const urls = body.match(/https?:\/\/[^\s"'<>]+/g) || []
      const magic = urls.find(u => u.includes('oobCode') || u.includes('alight') || u.includes('apiKey') || u.includes('signInWithEmailLink'))
      if (magic) {
        return magic.replace(/&amp;/g, '&')
      }
    }
  }
  throw new Error('Timeout menunggu link verifikasi dari Alight Motion.')
}

async function verifyAccount(email, link) {
  if (!email || !link) {
    throw new Error('Email dan verification link diperlukan.')
  }
  try {
    const { data } = await axios.post(
      `${BASE_URL}/api/verify`,
      { email: email.trim(), link: link.trim() },
      { headers: HEADERS, timeout: 25000 }
    )
    return data
  } catch (error) {
    throw new Error(error.response?.data?.error || error.response?.data?.message || error.message)
  }
}

async function generateAccount() {
  const { email, sid } = await createGuerrillaMail()
  await sendVerificationLink(email)
  const magicLink = await waitMagicLinkGuerrilla(sid, 50)
  const verifData = await verifyAccount(email, magicLink)

  return {
    status: true,
    email,
    orderId: verifData?.orderId || null,
    uid: verifData?.uid || null,
    isNewUser: verifData?.isNewUser ?? true,
    magicLink
  }
}

async function bulkGenerateAccounts(count = 1, concurrency = 2) {
  const total = Math.min(Math.max(parseInt(count) || 1, 1), 5)
  const conc = Math.min(Math.max(parseInt(concurrency) || 2, 1), total)
  const queue = Array.from({ length: total }, (_, i) => i + 1)
  const success = []
  const failed = []

  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift()
      try {
        const acc = await generateAccount()
        success.push({ index: idx, ...acc })
      } catch (err) {
        failed.push({ index: idx, error: err.message })
      }
    }
  }

  const workers = Array.from({ length: conc }, () => worker())
  await Promise.all(workers)

  return {
    status: true,
    total_requested: total,
    total_success: success.length,
    total_failed: failed.length,
    accounts: success,
    errors: failed.length ? failed : undefined
  }
}

export default {
  command: ['alightmotion', 'ampro', 'ampremium'],
  category: 'tools',
  execute: async (denn, m, { prefix, command, text, args }) => {
    const count = parseInt(args[0]) || 1
    
    if (count > 3) {
      return sendFakeQuoted(denn, m, '⚠️ Maksimal pembuatan adalah *3 akun* per perintah untuk menghindari timeout sistem.', {
        title: 'Alight Motion Pro',
        body: 'Batas maksimal 3 akun'
      })
    }

    try {
      await sendFakeQuoted(denn, m, `⏳ Sedang membuat *${count}* akun Alight Motion Pro...\n\n_Mohon tunggu, proses ini membutuhkan waktu 20-50 detik per akun._`, {
        title: 'Alight Motion Pro',
        body: 'Sedang memproses'
      })

      const result = await bulkGenerateAccounts(count, Math.min(count, 2))

      if (result.total_success === 0) {
        throw new Error(result.errors?.[0]?.error || 'Gagal membuat akun.')
      }

      let caption = `✅ *BERHASIL MEMBUAT ${result.total_success} AKUN*\n\n`
      
      for (let i = 0; i < result.accounts.length; i++) {
        const acc = result.accounts[i]
        caption += `*Akun ${i + 1}:*\n`
        caption += `📧 Email: \`${acc.email}\`\n`
        if (acc.uid) caption += `🆔 UID: \`${acc.uid}\`\n`
        if (acc.orderId) caption += `🧾 Order ID: \`${acc.orderId}\`\n`
        caption += `🔗 Magic Link: ${acc.magicLink}\n\n`
      }

      if (result.total_failed > 0) {
        caption += `⚠️ *Gagal:* ${result.total_failed} akun\n`
      }

      await sendFakeQuoted(denn, m, caption.trim(), {
        title: 'Alight Motion Pro',
        body: 'Generate Berhasil'
      })

    } catch (err) {
      await sendFakeQuoted(denn, m, '❌ Gagal membuat akun Alight Motion\n\n_' + err.message + '_', {
        title: 'Alight Motion Pro',
        body: 'Terjadi kesalahan'
      })
    }
  }
}