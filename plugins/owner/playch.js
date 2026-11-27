import { downloadMediaMessage } from '@rexxhayanasi/elaina-baileys'
import { idch } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

export default {
  command: ['playch'],
  category: 'downloader',
  execute: async (denn, m, { prefix, command, isOwner }) => {
    if (!isOwner) {
      return sendFakeQuoted(denn, m, '❌ Fitur ini khusus Owner!', { 
        title: 'Akses Ditolak', 
        body: 'Hanya owner yang bisa menggunakan fitur ini' 
      })
    }

    const isAudio = m.quoted && (
      m.quoted.mtype === 'audioMessage' || 
      (m.quoted.mtype === 'documentMessage' && m.quoted.msg?.mimetype?.includes('audio'))
    )

    if (!isAudio) {
      return sendFakeQuoted(denn, m, 
        `🎵 *PLAY CHANNEL*\n\nFitur ini digunakan untuk meneruskan audio ke WhatsApp Channel.\n\n📌 *Cara pakai:*\nReply pesan audio (atau dokumen audio) dengan perintah:\n\`${prefix}${command}\``,
        { title: 'Play Channel', body: 'Bantuan' }
      )
    }

    await sendFakeQuoted(denn, m, '⏳ Memproses audio ke Channel...', { 
      title: 'Play Channel', 
      body: 'Mengunduh audio' 
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
        throw new Error('Gagal mengunduh audio atau file kosong.')
      }

      let mimetype = m.quoted.msg?.mimetype || 'audio/mp4'
      
      try {
        await denn.sendMessage(targetChannel, { 
          audio: buffer, 
          mimetype: mimetype,
          ptt: false
        })
        return sendFakeQuoted(denn, m, '✅ Audio berhasil dikirim ke Channel!', { 
          title: 'Play Channel', 
          body: 'Sukses' 
        })
      } catch (audioErr) {
        await denn.sendMessage(targetChannel, { 
          document: buffer, 
          mimetype: mimetype,
          fileName: `Audio_${Date.now()}.mp3`
        })
        return sendFakeQuoted(denn, m, '✅ Audio berhasil dikirim ke Channel (sebagai dokumen)!', { 
          title: 'Play Channel', 
          body: 'Sukses' 
        })
      }
    } catch (err) {
      return sendFakeQuoted(denn, m, '❌ Gagal:\n\n_' + err.message + '_', { 
        title: 'Play Channel', 
        body: 'Error' 
      })
    }
  }
}