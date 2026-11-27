import fs from 'fs'
import path from 'path'
import { getBuffer } from '../../lib/helper.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

export default {
  command: ['sf', 'savefile'],
  category: 'owner',
  execute: async (denn, m, { prefix, command, text, isOwner }) => {
    if (!isOwner) {
      return sendFakeQuoted(denn, m, global.msg.owner, {
        title: 'Save File',
        body: 'Owner Only'
      })
    }
    if (!text) {
      return sendFakeQuoted(denn, m, `Format: ${prefix + command} <path/nama_file.js>\nContoh: ${prefix + command} downloader/twitter.js`, {
        title: 'Save File',
        body: 'Format Salah'
      })
    }
    if (!m.quoted) {
      return sendFakeQuoted(denn, m, 'Reply pesan berisi kode yang mau disimpan!', {
        title: 'Save File',
        body: 'Tidak Ada Reply'
      })
    }
    let code = ''
    if (m.quoted.mtype === 'documentMessage') {
      const buffer = await getBuffer(m.quoted.msg, 'document')
      code = buffer.toString('utf-8')
    } else {
      code = m.quoted.text || m.quoted.msg?.text || m.quoted.msg?.conversation || ''
    }
    if (!code) {
      return sendFakeQuoted(denn, m, 'Tidak ada kode yang bisa disimpan!', {
        title: 'Save File',
        body: 'Kode Kosong'
      })
    }
    code = code.replace(/^```(?:javascript|js)?\n/gm, '').replace(/\n```$/gm, '').trim()
    let cleanPath = text.replace(/^\.\//, '').replace(/^\//, '').replace(/\\/g, '/')
    if (!cleanPath.endsWith('.js')) cleanPath += '.js'
    const rootDir = process.cwd()
    const knownRoots = ['plugins/', 'lib/', 'cmd/', 'source/', 'session/']
    const isKnownRoot = knownRoots.some((r) => cleanPath.startsWith(r))
    const isRootFile = !cleanPath.includes('/') && fs.existsSync(path.join(rootDir, cleanPath))
    if (!isKnownRoot && !isRootFile) cleanPath = 'plugins/' + cleanPath
    const targetPath = path.join(rootDir, cleanPath)
    if (!targetPath.startsWith(rootDir)) {
      return sendFakeQuoted(denn, m, 'Path tidak valid!', {
        title: 'Save File',
        body: 'Path Error'
      })
    }
    try {
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(targetPath, code, 'utf-8')
      const caption = `*SAVE FILE BERHASIL*\n\nFile : ${cleanPath}\nUkuran : ${Buffer.byteLength(code, 'utf-8')} byte\n\nKlik tombol di bawah buat reload plugin biar langsung aktif tanpa restart.`
      return denn.sendMessage(m.chat, {
        text: caption,
        footer: 'Patrick MD - Save File',
        buttons: [
          { buttonId: `${prefix}r`, buttonText: { displayText: 'Reload Plugins' }, type: 1 }
        ],
        headerType: 1,
        viewOnce: true
      }, { quoted: m })
    } catch (e) {
      return sendFakeQuoted(denn, m, `Gagal menyimpan file: ${e.message}`, {
        title: 'Save File',
        body: 'Gagal Simpan'
      })
    }
  }
}