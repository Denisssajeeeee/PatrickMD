/* * Name : sticker audio
   * type : ESM
   * Creator: DennCode
   * 
*/

import crypto from 'node:crypto'
import { prepareWAMessageMedia, downloadMediaMessage } from '@rexxhayanasi/elaina-baileys'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { addStickerMetadata } from '../../lib/stickerExif.js'

const sessions = new Map()
const SESSION_TIMEOUT = 5 * 60 * 1000

function cleanupSession(key) {
  const s = sessions.get(key)
  if (s && s.timeout) clearTimeout(s.timeout)
  sessions.delete(key)
}

function runFfmpeg(buffer, args = [], inExt = 'mp4', outExt = 'webp') {
  return new Promise(async (resolve, reject) => {
    const tmpDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const rand = Date.now() + '_' + Math.random().toString(36).substring(2, 8)
    const inp = path.join(tmpDir, `${rand}.${inExt}`)
    const out = path.join(tmpDir, `${rand}_out.${outExt}`)

    try {
      await fs.promises.writeFile(inp, buffer)
      const p = spawn('ffmpeg', ['-y', '-i', inp, ...args, out])
      p.on('error', err => {
        cleanup()
        reject(err)
      })
      p.on('close', async code => {
        try {
          if (code !== 0) {
            cleanup()
            return reject(new Error(`FFmpeg exited with code ${code}`))
          }
          const res = await fs.promises.readFile(out)
          cleanup()
          resolve(res)
        } catch (e) {
          cleanup()
          reject(e)
        }
      })
    } catch (e) {
      cleanup()
      reject(e)
    }

    function cleanup() {
      try { if (fs.existsSync(inp)) fs.unlinkSync(inp) } catch (_) {}
      try { if (fs.existsSync(out)) fs.unlinkSync(out) } catch (_) {}
    }
  })
}

async function imageBufferToWebp(buffer) {
  try {
    const sharp = (await import('sharp')).default
    const rawWebp = await sharp(buffer, { animated: true })
      .rotate()
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .webp({ quality: 82 })
      .toBuffer()
    return addStickerMetadata(rawWebp, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
  } catch {
    const tmpId = crypto.randomBytes(6).toString('hex')
    const tmpDir = path.join(process.cwd(), 'temp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const inPath = path.join(tmpDir, `as_img_${tmpId}.jpg`)
    const outPath = path.join(tmpDir, `as_img_out_${tmpId}.webp`)
    try {
      await fs.promises.writeFile(inPath, buffer)
      await new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', ['-y', '-i', inPath, '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '80', '-an', outPath])
        p.on('close', resolve)
        p.on('error', reject)
      })
      const rawWebp = await fs.promises.readFile(outPath)
      return addStickerMetadata(rawWebp, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
    } finally {
      try { if (fs.existsSync(inPath)) fs.unlinkSync(inPath) } catch (_) {}
      try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath) } catch (_) {}
    }
  }
}

async function videoToAnimatedWebp(videoBuf) {
  let webpBuf
  const profiles = [
    { fps: 15, q: 50 },
    { fps: 12, q: 40 },
    { fps: 10, q: 30 }
  ]
  
  for (const p of profiles) {
    webpBuf = await runFfmpeg(videoBuf, [
      '-t', '10',
      '-vf', `scale=512:512:force_original_aspect_ratio=decrease,fps=${p.fps},pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,setsar=1`,
      '-vcodec', 'libwebp',
      '-lossless', '0',
      '-compression_level', '6',
      '-q:v', String(p.q),
      '-loop', '0',
      '-preset', 'picture',
      '-an',
      '-vsync', '0',
      '-pix_fmt', 'yuva420p'
    ], 'mp4', 'webp')
    
    if (webpBuf.length < 900 * 1024) break
  }
  
  return addStickerMetadata(webpBuf, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
}

async function extractAudioToOpus(mediaBuf, inExt = 'mp4') {
  return await runFfmpeg(mediaBuf, [
    '-t', '25',
    '-vn',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-vbr', 'on',
    '-compression_level', '10'
  ], inExt, 'opus')
}

async function sendAudioSticker(conn, chat, stickerBuf, audioBuf, isAnimated = false) {
  let stickerMedia = await prepareWAMessageMedia(
    { sticker: stickerBuf, isAnimated: Boolean(isAnimated) },
    { upload: conn.waUploadToServer }
  )

  let audioMedia = await prepareWAMessageMedia(
    { audio: audioBuf, ptt: false, mimetype: 'audio/ogg; codecs=opus' },
    { upload: conn.waUploadToServer }
  )

  let rawStickerMsg = stickerMedia.stickerMessage
  let rawAudioMsg = audioMedia.audioMessage

  if (!rawStickerMsg || !rawAudioMsg) {
    throw 'Gagal mengunggah media ke server WhatsApp!'
  }

  let stickerMediaKeyBase64 = rawStickerMsg.mediaKey ? Buffer.from(rawStickerMsg.mediaKey).toString('base64') : ''
  let audioMediaKeyBase64 = rawAudioMsg.mediaKey ? Buffer.from(rawAudioMsg.mediaKey).toString('base64') : ''

  let isGroup = chat.endsWith('@g.us')
  let payload = {}
  let additionalAttrs = {}

  const stickerMessageData = {
    url: rawStickerMsg.url,
    fileSha256: rawStickerMsg.fileSha256,
    fileEncSha256: rawStickerMsg.fileEncSha256,
    mediaKey: rawStickerMsg.mediaKey,
    mimetype: rawStickerMsg.mimetype || 'image/webp',
    height: 512,
    width: 512,
    directPath: rawStickerMsg.directPath,
    fileLength: rawStickerMsg.fileLength,
    mediaKeyTimestamp: rawStickerMsg.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
    firstFrameLength: rawStickerMsg.firstFrameLength || undefined,
    firstFrameSidecar: rawStickerMsg.firstFrameSidecar || undefined,
    isAnimated: Boolean(isAnimated || rawStickerMsg.isAnimated),
    contextInfo: {
      expiration: 604800,
      disappearingMode: { initiator: 0, trigger: 0 },
      mediaDomainInfo: {
        mediaKeyDomain: 1,
        e2EeMediaKey: stickerMediaKeyBase64
      }
    },
    stickerSentTs: Date.now(),
    isAvatar: false,
    isAiSticker: false,
    isLottie: false,
    premium: 0,
    audioMessage: {
      url: rawAudioMsg.url,
      mimetype: 'audio/ogg; codecs=opus',
      fileSha256: rawAudioMsg.fileSha256,
      fileLength: rawAudioMsg.fileLength,
      seconds: rawAudioMsg.seconds || 1,
      mediaKey: rawAudioMsg.mediaKey,
      fileEncSha256: rawAudioMsg.fileEncSha256,
      directPath: rawAudioMsg.directPath,
      mediaKeyTimestamp: rawAudioMsg.mediaKeyTimestamp || Math.floor(Date.now() / 1000),
      contextInfo: {
        mediaDomainInfo: {
          mediaKeyDomain: 1,
          e2EeMediaKey: audioMediaKeyBase64
        }
      }
    }
  }

  if (isGroup) {
    payload = {
      messageContextInfo: {
        messageSecret: crypto.randomBytes(32).toString('base64')
      },
      audioStickerMessage: {
        message: {
          stickerMessage: stickerMessageData
        }
      }
    }
    additionalAttrs = { expiration: "604800" }
  } else {
    payload = {
      audioStickerMessage: {
        message: {
          stickerMessage: stickerMessageData
        }
      }
    }
    additionalAttrs = { peer_recipient_pn: chat }
  }

  await conn.relayMessage(chat, payload, { additionalAttributes: additionalAttrs })
}

export default {
  command: ['stickeraudio', 'saudio', 'audiosticker'],
  category: 'sticker',
  execute: async (denn, m, { prefix, command, text }) => {
    const sessionKey = `${m.chat}_${m.sender}`
    let q = m.quoted ? m.quoted : m
    let mime = (q.msg || q).mimetype || q.mimetype || m.mtype || (m.quoted ? m.quoted.mtype : '') || ''
    
    let isVideo = /video|mp4|mkv|webm|mov/i.test(mime) || m.mtype === 'videoMessage' || (m.quoted && m.quoted.mtype === 'videoMessage')
    let isImageOrWebp = /image|webp/i.test(mime) || m.mtype === 'imageMessage' || (m.quoted && m.quoted.mtype === 'imageMessage')
    let isAudio = /audio|ogg|opus|mp3|m4a/i.test(mime) || m.mtype === 'audioMessage' || (m.quoted && m.quoted.mtype === 'audioMessage')

    try {
      if (isVideo) {
        await m.reply('Sedang memproses audio stiker dari video...')
        let videoBuf = await downloadMediaMessage(q, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
        if (!videoBuf) throw 'Gagal mengunduh video!'

        let audioBuf = await extractAudioToOpus(videoBuf, 'mp4')
        let stickerBuf = await videoToAnimatedWebp(videoBuf)

        await sendAudioSticker(denn, m.chat, stickerBuf, audioBuf, true)
        cleanupSession(sessionKey)
        return
      }

      if (text && /^https?:\/\//i.test(text.trim())) {
        if (!isImageOrWebp) throw `Silakan reply foto atau stiker dengan command *${prefix + command} <url audio>*`
        await m.reply('Sedang memproses audio stiker...')
        let mediaBuf = await downloadMediaMessage(q, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
        if (!mediaBuf) throw 'Gagal mengunduh stiker/gambar!'

        let stickerBuf = /webp/i.test(mime)
          ? addStickerMetadata(mediaBuf, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
          : await imageBufferToWebp(mediaBuf)

        let audioRes = await axios.get(text.trim(), { responseType: 'arraybuffer' })
        if (audioRes.status !== 200) throw `Gagal mengunduh audio dari URL! Status: ${audioRes.status}`
        
        let rawAudioBuf = Buffer.from(audioRes.data)
        let audioBuf = await extractAudioToOpus(rawAudioBuf, 'mp3')

        await sendAudioSticker(denn, m.chat, stickerBuf, audioBuf, false)
        cleanupSession(sessionKey)
        return
      }

      if (isImageOrWebp) {
        let mediaBuf = await downloadMediaMessage(q, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
        if (!mediaBuf) throw 'Gagal mengunduh media stiker/gambar!'

        let stickerBuf = /webp/i.test(mime)
          ? addStickerMetadata(mediaBuf, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
          : await imageBufferToWebp(mediaBuf)

        const existingSession = sessions.get(sessionKey)
        if (existingSession?.audio) {
          await m.reply('Stiker diterima! Menggabungkan dengan audio sebelumnya...')
          await sendAudioSticker(denn, m.chat, stickerBuf, existingSession.audio, false)
          cleanupSession(sessionKey)
          return
        }

        sessions.set(sessionKey, {
          sticker: stickerBuf,
          timeout: setTimeout(() => cleanupSession(sessionKey), SESSION_TIMEOUT)
        })

        return m.reply(
          `*Stiker berhasil disimpan ke session!* 🎶\n\n` +
          `Sekarang kirim atau reply *Audio / VN (Voice Note)* yang mau dipasang ke stiker ini.\n` +
          `_Sesi berlaku selama 5 menit._`
        )
      }

      if (isAudio) {
        let rawAudioBuf = await downloadMediaMessage(q, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
        if (!rawAudioBuf) throw 'Gagal mengunduh audio!'

        let audioBuf = await extractAudioToOpus(rawAudioBuf, /ogg|opus/i.test(mime) ? 'opus' : 'mp3')

        const existingSession = sessions.get(sessionKey)
        if (existingSession?.sticker) {
          await m.reply('Audio diterima! Menggabungkan dengan stiker sebelumnya...')
          await sendAudioSticker(denn, m.chat, existingSession.sticker, audioBuf, false)
          cleanupSession(sessionKey)
          return
        }

        sessions.set(sessionKey, {
          audio: audioBuf,
          timeout: setTimeout(() => cleanupSession(sessionKey), SESSION_TIMEOUT)
        })

        return m.reply(
          `*Audio berhasil disimpan ke session!* 🖼️\n\n` +
          `Sekarang kirim atau reply *Stiker / Foto* yang mau dipasangkan ke audio ini.\n` +
          `_Sesi berlaku selama 5 menit._`
        )
      }

      throw `*Cara Penggunaan Audio Sticker:*\n\n` +
        `1. *Reply Video*: Otomatis jadi stiker video + audio. (Tanpa perlu VN lagi)\n\n` +
        `2. *Kirim/Reply Foto atau Stiker* dengan command ini.\n` +
        `   Lalu kirim *Audio / VN* untuk menggabungkannya.\n\n` +
        `3. *Reply Audio* dengan command ini.\n` +
        `   Lalu kirim *Stiker / Foto* untuk menggabungkannya.\n\n` +
        `4. *Pakai Link Audio*: *${prefix + command} <url audio>* sambil reply foto/stiker.`
    } catch (err) {
      m.reply(typeof err === 'string' ? err : (err?.message || 'Terjadi kesalahan'))
    }
  }
}

const beforeHook = async (denn, m, body) => {
  if (!m || m.key.fromMe) return false
  const sessionKey = `${m.chat}_${m.sender}`
  const session = sessions.get(sessionKey)
  if (!session) return false

  let mime = (m.msg || m).mimetype || m.mimetype || m.mtype || (m.quoted ? m.quoted.mtype : '') || ''
  let isImageOrWebp = /image|webp/i.test(mime) || m.mtype === 'imageMessage' || (m.quoted && m.quoted.mtype === 'imageMessage')
  let isAudio = /audio|ogg|opus|mp3|m4a/i.test(mime) || m.mtype === 'audioMessage' || (m.quoted && m.quoted.mtype === 'audioMessage')

  if (session.sticker && isAudio) {
    try {
      await m.reply('Audio terdeteksi! Sedang membuat stiker audio...')
      let rawAudioBuf = await downloadMediaMessage(m, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
      if (!rawAudioBuf) throw 'Gagal mengunduh audio!'

      let audioBuf = await extractAudioToOpus(rawAudioBuf, /ogg|opus/i.test(mime) ? 'opus' : 'mp3')
      await sendAudioSticker(denn, m.chat, session.sticker, audioBuf, false)
      cleanupSession(sessionKey)
      return true
    } catch (e) {
      cleanupSession(sessionKey)
      m.reply('Gagal memproses audio: ' + (e?.message || e))
      return true
    }
  }

  if (session.audio && isImageOrWebp) {
    try {
      await m.reply('Stiker/gambar terdeteksi! Sedang membuat stiker audio...')
      let mediaBuf = await downloadMediaMessage(m, 'buffer', {}, { logger: { info:()=>{}, error:()=>{}, warn:()=>{} }, reuploadRequest: denn.updateMediaMessage })
      if (!mediaBuf) throw 'Gagal mengunduh media!'

      let stickerBuf = /webp/i.test(mime)
        ? addStickerMetadata(mediaBuf, global.stickerPackname || 'PatrickMD', global.stickerAuthor || 'DennCode', ['🔊'])
        : await imageBufferToWebp(mediaBuf)

      await sendAudioSticker(denn, m.chat, stickerBuf, session.audio, false)
      cleanupSession(sessionKey)
      return true
    } catch (e) {
      cleanupSession(sessionKey)
      m.reply('Gagal memproses stiker: ' + (e?.message || e))
      return true
    }
  }

  return false
}

if (!global.passiveListeners) global.passiveListeners = new Map()
global.passiveListeners.set('*audiosticker', beforeHook)