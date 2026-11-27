import { downloadMediaMessage } from '@rexxhayanasi/elaina-baileys'
import { idch } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

export default {
  command: ['upch', 'upchannel'],
  category: 'downloader',
  execute: async (denn, m, { prefix, command, isOwner }) => {
    if (!isOwner) {
      return sendFakeQuoted(denn, m, '❌ Fitur ini khusus Owner!', { 
        title: 'Akses Ditolak', 
        body: 'Hanya owner yang bisa menggunakan fitur ini' 
      })
    }

    if (!m.quoted) {
      return sendFakeQuoted(denn, m, 
        `📤 *UPLOAD CHANNEL*\n\nFitur ini digunakan untuk meneruskan media ke WhatsApp Channel.\n\n📌 *Cara pakai:*\nReply gambar/video/audio/dokumen dengan perintah:\n\`${prefix}${command}\``,
        { title: 'Upload Channel', body: 'Bantuan' }
      )
    }

    const allowedTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
    if (!allowedTypes.includes(m.quoted.mtype)) {
      return sendFakeQuoted(denn, m, '❌ Tipe media tidak didukung. Reply gambar, video, audio, atau dokumen.', { 
        title: 'Upload Channel', 
        body: 'Error' 
      })
    }

    await sendFakeQuoted(denn, m, '⏳ Mengunduh dan mengirim media ke Channel...', { 
      title: 'Upload Channel', 
      body: 'Memproses media' 
    })

    try {
      const targetChannel = idch.includes('@newsletter') ? idch : `${idch}@newsletter`
      
      const buffer = await downloadMediaMessage(
        m.quoted,
        'buffer',
        {},
        {
          logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} },
          reuploadRequest: denn.updateMediaMessage
        }
      )
      
      if (!buffer || buffer.length === 0) {
        throw new Error('Gagal mengunduh media atau file kosong.')
      }

      const mimetype = m.quoted.msg?.mimetype || 'application/octet-stream'
      const caption = m.quoted.msg?.caption || ''
      const fileName = m.quoted.msg?.fileName || `file_${Date.now()}`

      let payload = {}

      if (m.quoted.mtype === 'imageMessage') {
        payload = { image: buffer, caption: caption }
      } else if (m.quoted.mtype === 'videoMessage') {
        payload = { video: buffer, caption: caption }
      } else if (m.quoted.mtype === 'audioMessage') {
        payload = { audio: buffer, mimetype: mimetype, ptt: false }
      } else if (m.quoted.mtype === 'documentMessage') {
        payload = { document: buffer, mimetype: mimetype, fileName: fileName, caption: caption }
      } else if (m.quoted.mtype === 'stickerMessage') {
        payload = { sticker: buffer }
      }

      try {
        await denn.sendMessage(targetChannel, payload)
        return sendFakeQuoted(denn, m, '✅ Media berhasil dikirim ke Channel!', { 
          title: 'Upload Channel', 
          body: 'Sukses' 
        })
      } catch (mediaErr) {
        if (m.quoted.mtype !== 'documentMessage') {
          await denn.sendMessage(targetChannel, { 
            document: buffer, 
            mimetype: mimetype,
            fileName: fileName
          })
          return sendFakeQuoted(denn, m, '✅ Media berhasil dikirim ke Channel (sebagai dokumen)!', { 
            title: 'Upload Channel', 
            body: 'Sukses (Fallback)' 
          })
        }
        throw mediaErr
      }
    } catch (err) {
      return sendFakeQuoted(denn, m, '❌ Gagal:\n\n_' + err.message + '_', { 
        title: 'Upload Channel', 
        body: 'Error' 
      })
    }
  }
}