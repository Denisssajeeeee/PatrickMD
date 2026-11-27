import sharp from 'sharp'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

const BASE_URL = 'https://nasanamegenerator.com'

const LETTER_POOLS = {
  A: [0, 1, 2, 3, 4],
  B: [0, 1],
  C: [0, 1, 2],
  D: [0, 1],
  E: [0, 1, 2, 3],
  F: [0, 1],
  G: [0],
  H: [0, 1],
  I: [0, 1, 2, 3, 4],
  J: [0, 1, 2],
  K: [0, 1],
  L: [0, 1, 2, 3],
  M: [0, 1, 2],
  N: [0, 1, 2],
  O: [0, 1],
  P: [0, 1],
  Q: [0, 1],
  R: [0, 1, 2, 3],
  S: [0, 1, 2],
  T: [0, 1],
  U: [0, 1],
  V: [0, 1, 2, 3],
  W: [0, 1],
  X: [0, 1, 2],
  Y: [0, 1, 2],
  Z: [0, 1]
}

let cachedLetterData = null

async function fetchLetterData() {
  if (cachedLetterData) return cachedLetterData
  const res = await fetch(BASE_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    }
  })
  if (!res.ok) throw new Error(`Gagal mengambil halaman NASA Name Generator (HTTP ${res.status})`)
  const html = await res.text()
  const match = html.match(/const letterDataSerialized = ("[\s\S]*?");/)
  if (!match) throw new Error('Gagal mengekstrak letterData dari halaman NASA Name Generator.')
  cachedLetterData = JSON.parse(JSON.parse(match[1]))
  return cachedLetterData
}

async function generateNasaName(name) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Nama wajib diisi.')
  const letterData = await fetchLetterData()
  const usedIndices = {}
  const tiles = []
  let sequence = ''
  for (const ch of cleanName) {
    if (ch === ' ') {
      tiles.push({ char: ' ', type: 'space' })
      continue
    }
    const upper = ch.toUpperCase()
    const lower = ch.toLowerCase()
    const pool = LETTER_POOLS[upper]
    if (!pool) continue
    if (!usedIndices[upper] || usedIndices[upper].length === 0) {
      usedIndices[upper] = [...pool]
    }
    const available = usedIndices[upper]
    const randPos = Math.floor(Math.random() * available.length)
    const index = available.splice(randPos, 1)[0]
    sequence += String(index)
    const meta = (letterData[lower] && letterData[lower][index]) || {}
    tiles.push({
      char: upper,
      type: 'letter',
      variantIndex: index,
      imageUrl: `${BASE_URL}/images/letters/letter_${lower}_${index}.webp`,
      location: meta.location || null,
      coordinates: meta.coordinates || null,
      nasaLink: meta.link || null,
      mapsLink: meta.maps || null
    })
  }
  if (tiles.filter((t) => t.type === 'letter').length === 0) throw new Error('Nama harus mengandung minimal 1 huruf A-Z.')
  const cleanWord = cleanName.replace(/[^a-zA-Z ]/g, '').trim()
  const shareUrl = `${BASE_URL}/?name=${encodeURIComponent(cleanWord)}&seq=${sequence}`
  return {
    status: true,
    name: cleanWord,
    sequence,
    shareUrl,
    totalLetters: tiles.filter((t) => t.type === 'letter').length,
    tiles
  }
}

async function buildSlide(tiles, gap = 8) {
  const letterTiles = tiles.filter((t) => t.type === 'letter')
  const height = 500
  const processed = []
  for (const tile of letterTiles) {
    const res = await fetch(tile.imageUrl)
    if (!res.ok) continue
    const input = Buffer.from(await res.arrayBuffer())
    const buf = await sharp(input).resize({ height, withoutEnlargement: false }).jpeg({ quality: 90 }).toBuffer()
    const meta = await sharp(buf).metadata()
    processed.push({ buf, width: meta.width, tile })
  }
  if (processed.length === 0) throw new Error('Gagal mengunduh gambar huruf.')
  let totalWidth = 0
  for (const p of processed) totalWidth += p.width
  totalWidth += gap * (processed.length - 1)
  const composites = []
  let left = 0
  for (const p of processed) {
    composites.push({ input: p.buf, left, top: 0 })
    left += p.width + gap
  }
  const finalBuffer = await sharp({
    create: {
      width: totalWidth,
      height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  }).composite(composites).jpeg({ quality: 92 }).toBuffer()
  return finalBuffer
}

export default {
  command: ['nasaname', 'nasa', 'nasaletter'],
  category: 'maker',
  description: 'Generate nama NASA jadi 1 gambar slide',
  execute: async (denn, m, { args, text, prefix, command }) => {
    const input = (text || args.join(' ') || '').trim()
    if (!input) {
      return sendFakeQuoted(denn, m, `Masukkan nama yang mau dibuat.\nContoh: ${prefix + command} Budi`, {
        title: 'NASA Name Generator',
        body: 'Nama kosong'
      })
    }
    try {
      const result = await generateNasaName(input)
      const letterTiles = result.tiles.filter((t) => t.type === 'letter')
      const slideBuffer = await buildSlide(result.tiles, 8)
      let caption = `*NASA NAME GENERATOR*\n\n`
      caption += `Nama : ${result.name}\n`
      caption += `Total Huruf : ${result.totalLetters}\n`
      caption += `Sequence : ${result.sequence}\n\n`
      caption += `*Detail Lokasi :*\n`
      letterTiles.forEach((t, i) => {
        caption += `${i + 1}. ${t.char} - ${t.location || 'Lokasi tidak diketahui'}\n`
        if (t.coordinates) caption += `   Koordinat : ${t.coordinates}\n`
      })
      caption += `\nLink : ${result.shareUrl}`
      return denn.sendMessage(m.chat, { image: slideBuffer, caption }, { quoted: m })
    } catch (e) {
      return sendFakeQuoted(denn, m, `Gagal generate nama NASA: ${e.message}`, {
        title: 'NASA Name Generator',
        body: 'Gagal'
      })
    }
  }
}