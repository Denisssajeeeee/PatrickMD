import axios from 'axios'
import { jereBaseUrl, jereApiKey } from '../../settings.js'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const T_API = 30000
const GAME_TIMEOUT = 60000

const activeGames = new Map()

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export default {
  command: ['tebakff', 'tebakkarakterff', 'nyerahff'],
  category: 'game',
  execute: async (denn, m, { prefix, command, text, args }) => {
    try {
      if (command === 'nyerahff') {
        const game = activeGames.get(m.chat)
        if (!game) {
          return sendFakeQuoted(denn, m, '❌ Tidak ada game yang sedang berjalan.', {
            title: 'Tebak Karakter FF',
            body: 'Tidak ada game aktif'
          })
        }
        clearTimeout(game.timer)
        activeGames.delete(m.chat)
        if (global.passiveListeners && global.passiveListeners.get(m.chat) === game.listener) {
          global.passiveListeners.delete(m.chat)
        }
        return sendFakeQuoted(denn, m, `🏳️ Kamu menyerah!\n\nJawabannya adalah *${game.answer}*`, {
          title: 'Tebak Karakter FF',
          body: 'Game selesai'
        })
      }

      if (activeGames.has(m.chat)) {
        return sendFakeQuoted(denn, m, '❌ Masih ada game yang sedang berjalan di chat ini.\n\nSelesaikan game tersebut atau ketik `.nyerahff` untuk menyerah.', {
          title: 'Tebak Karakter FF',
          body: 'Game sudah berjalan'
        })
      }

      await sendFakeQuoted(denn, m, '⏳ Mengambil karakter Free Fire...', {
        title: 'Tebak Karakter FF',
        body: 'Sedang mempersiapkan game'
      })

      const url = `${jereBaseUrl}/api/game/karakter-freefire`
      const res = await axios.get(url, {
        params: { apikey: jereApiKey },
        timeout: T_API,
        headers: { 'User-Agent': UA, 'Accept': 'application/json' },
        validateStatus: () => true
      })

      if (res.status !== 200) {
        throw new Error('HTTP ' + res.status)
      }

      const json = res.data
      if (!json || json.status === false || !json.result) {
        throw new Error((json && (json.message || json.error)) || 'API mengembalikan status gagal')
      }

      const karakter = json.result
      const name = karakter.name || 'Tanpa Nama'
      const gambar = karakter.gambar

      if (!gambar || !/^https?:\/\//i.test(String(gambar))) {
        throw new Error('Gambar karakter tidak tersedia')
      }

      const caption = `🎮 *TEBAK KARAKTER FREE FIRE*\n\nSiapakah nama karakter di gambar ini?\n\n⏱️ Waktu: 60 detik\n📌 Ketik jawabanmu langsung tanpa prefix (contoh: Dimitri)\nAtau ketik \`.nyerahff\` untuk menyerah.`

      await denn.sendMessage(m.chat, {
        image: { url: String(gambar) },
        caption
      }, { quoted: m })

      const listener = async (denn2, m2, body) => {
        if (!body) return false
        const game = activeGames.get(m2.chat)
        if (!game) return false

        if (normalize(body) === normalize(game.answer)) {
          clearTimeout(game.timer)
          activeGames.delete(m2.chat)
          if (global.passiveListeners && global.passiveListeners.get(m2.chat) === listener) {
            global.passiveListeners.delete(m2.chat)
          }
          await m2.reply(`✅ *Benar!*\n\nJawabannya adalah *${game.answer}*\n\nKamu berhasil menebak karakter ini!`)
          return true
        }
        return false
      }

      const timer = setTimeout(async () => {
        const game = activeGames.get(m.chat)
        if (game) {
          activeGames.delete(m.chat)
          if (global.passiveListeners && global.passiveListeners.get(m.chat) === listener) {
            global.passiveListeners.delete(m.chat)
          }
          await m.reply(`⏰ *Waktu habis!*\n\nJawabannya adalah *${game.answer}*`)
        }
      }, GAME_TIMEOUT)

      activeGames.set(m.chat, { answer: name, timer, listener })
      if (global.passiveListeners) {
        global.passiveListeners.set(m.chat, listener)
      }

    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Unknown error'
      await sendFakeQuoted(denn, m, '❌ Gagal memulai game Tebak Karakter\n\n_' + msg + '_', {
        title: 'Tebak Karakter FF',
        body: 'Terjadi kesalahan pada API'
      })
    }
  }
}