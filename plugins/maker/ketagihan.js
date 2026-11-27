/*
 * Creator      : Kyu masih pemula
 * Note         : dont claim this code
 *
 * Copyright © Mommy Kyu 2026
 * All Rights Reserved.
 *
 * Converted to Patrick MD by Denn
 * Credit tetap milik Kyu, jangan dihapus
 */

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import axios from 'axios'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const TEMPLATE_URL = 'https://raw.githubusercontent.com/KyuuX444/media-bot/main/ketagihan.jpeg'
const FONT_URL = 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Medium.ttf'
const FONT_PATH = path.join(os.tmpdir(), 'Roboto-Medium.ttf')
let fontLoaded = false

async function ensureFont() {
  if (fontLoaded) return
  if (!fs.existsSync(FONT_PATH)) {
    const { data } = await axios.get(FONT_URL, { responseType: 'arraybuffer', timeout: 20000 })
    fs.writeFileSync(FONT_PATH, Buffer.from(data))
  }
  GlobalFonts.registerFromPath(FONT_PATH, 'Roboto')
  fontLoaded = true
}

export default {
  command: ['ketagihan'],
  category: 'maker',
  description: 'Bikin Canvas ketagihan',
  execute: async (denn, m, { text, prefix, command }) => {
    if (!text) {
      return sendFakeQuoted(denn, m, `Masukkan teksnya!\n\nContoh:\n${prefix + command} Patrick`, {
        title: 'Ketagihan Maker',
        body: 'Teks kosong'
      })
    }
    const customText = text.trim()
    if (customText.length > 25) {
      return sendFakeQuoted(denn, m, 'Teks maksimal 25 karakter agar tetap rapi!', {
        title: 'Ketagihan Maker',
        body: 'Teks terlalu panjang'
      })
    }
    try {
      await ensureFont()
      const img = await loadImage(TEMPLATE_URL)
      const canvas = createCanvas(img.width, img.height)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const cleanTop = customText.replace(/\?+$/, '')
      const topText = `${cleanTop.toUpperCase()}?`
      const topFontSize = cleanTop.length > 11 ? Math.max(48, Math.floor(88 * (11 / cleanTop.length))) : 88
      ctx.fillStyle = '#FFFFFF'
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 4
      ctx.font = `900 ${topFontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText(topText, canvas.width / 2, 628, 760)
      ctx.fillText(topText, canvas.width / 2, 628, 760)
      const cleanSub = cleanTop.replace(/^main\s+/i, '')
      ctx.fillStyle = '#141414'
      ctx.fillRect(118, 1095, 880, 54)
      ctx.fillStyle = '#F1F1F1'
      ctx.font = '41px Roboto'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`Main ${cleanSub} ...`, 124, 1122, 860)
      const buffer = canvas.toBuffer('image/jpeg')
      return denn.sendMessage(m.chat, {
        image: buffer,
        caption: `KETAGIHAN ${customText.toUpperCase()}?`
      }, { quoted: m })
    } catch (e) {
      return sendFakeQuoted(denn, m, `Gagal membuat gambar: ${e.message}`, {
        title: 'Ketagihan Maker',
        body: 'Gagal'
      })
    }
  }
}