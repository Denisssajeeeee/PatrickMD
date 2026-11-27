/**
 * Creator : Ryza 
 * Ch : https://whatsapp.com/channel/0029VbE4NyXFSAt8jKbRHt2o
 *  Rename : DennCode
 * note : don't claim this code
 */

import axios from 'axios'
import { sendFakeQuoted } from '../../lib/fakequoted.js'

async function twitterDownload(url) {
  const match = url.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i) || url.match(/status(?:es)?\/(\d+)/i)
  if (!match) {
    throw new Error('Link Twitter / X tidak valid. Pastikan link menyertakan ID status!')
  }
  const tweetId = match[2] || match[1]
  const username = match[2] ? match[1] : 'i'
  const endpoints = [
    `https://api.vxtwitter.com/${username}/status/${tweetId}`,
    `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
    `https://api.fxtwitter.com/${username}/status/${tweetId}`
  ]
  let data = null
  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
      })
      if (res.data && (res.data.text !== undefined || res.data.tweet)) {
        data = res.data
        break
      }
    } catch (e) {}
  }
  if (!data) {
    throw new Error('Gagal mengambil metadata dari Twitter / X. Tweet mungkin privat atau sudah dihapus.')
  }
  const isFx = Boolean(data.tweet)
  const tweet = isFx ? data.tweet : data
  const author = isFx ? tweet.author : {
    name: data.user_name,
    screen_name: data.user_screen_name,
    avatar: data.user_profile_image_url
  }
  const text = isFx ? tweet.text : data.text
  const likes = (isFx ? tweet.likes : data.likes) ?? 0
  const retweets = (isFx ? tweet.retweets : data.retweets) ?? 0
  const replies = (isFx ? tweet.replies : data.replies) ?? 0
  const date = isFx ? tweet.created_at : data.date
  const mediaList = []
  if (isFx && tweet.media) {
    if (Array.isArray(tweet.media.all)) {
      for (const m of tweet.media.all) {
        mediaList.push({
          type: m.type,
          url: m.url,
          thumbnail: m.thumbnail_url || null
        })
      }
    } else if (Array.isArray(tweet.media.videos)) {
      for (const v of tweet.media.videos) {
        mediaList.push({
          type: 'video',
          url: v.url,
          thumbnail: v.thumbnail_url || null
        })
      }
    } else if (Array.isArray(tweet.media.photos)) {
      for (const p of tweet.media.photos) {
        mediaList.push({
          type: 'photo',
          url: p.url,
          thumbnail: p.url
        })
      }
    }
  } else {
    const extended = data.media_extended || []
    if (Array.isArray(extended) && extended.length > 0) {
      for (const item of extended) {
        mediaList.push({
          type: item.type === 'image' ? 'photo' : item.type,
          url: item.url,
          thumbnail: item.thumbnail_url || null
        })
      }
    } else if (Array.isArray(data.mediaURLs) && data.mediaURLs.length > 0) {
      for (const u of data.mediaURLs) {
        const isVid = /\.mp4(\?.*)?$/i.test(u)
        mediaList.push({
          type: isVid ? 'video' : 'photo',
          url: u,
          thumbnail: null
        })
      }
    }
  }
  return {
    status: true,
    id: tweetId,
    url: isFx ? tweet.url : (data.tweetURL || `https://x.com/${author.screen_name}/status/${tweetId}`),
    text: text || '',
    author: {
      name: author.name || 'Twitter User',
      username: author.screen_name || 'user',
      avatar: author.avatar || author.avatar_url || ''
    },
    stats: {
      likes: Number(likes).toLocaleString(),
      retweets: Number(retweets).toLocaleString(),
      replies: Number(replies).toLocaleString(),
      date: date || '-'
    },
    media: mediaList
  }
}

async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 30000
  })
  return Buffer.from(res.data)
}

export default {
  command: ['twitter', 'tw', 'x', 'twitterdl', 'xdl'],
  category: 'downloader',
  description: 'Download media Twitter / X',
  execute: async (denn, m, { args, text, prefix, command }) => {
    const url = (text || args.join(' ') || '').trim()
    if (!url) {
      return sendFakeQuoted(denn, m, `Masukkan link Twitter / X.\nContoh: ${prefix + command} https://x.com/nasa/status/123456`, {
        title: 'Twitter Downloader',
        body: 'Link kosong'
      })
    }
    if (!url.includes('twitter.com') && !url.includes('x.com')) {
      return sendFakeQuoted(denn, m, 'Link tidak valid. Harus link twitter.com atau x.com', {
        title: 'Twitter Downloader',
        body: 'Link tidak valid'
      })
    }
    try {
      const result = await twitterDownload(url)
      if (!result.media || result.media.length === 0) {
        return sendFakeQuoted(denn, m, `Tweet ini tidak ada media.\n\n*${result.author.name} (@${result.author.username})*\n${result.text || '-'}\n\nLikes: ${result.stats.likes} | RT: ${result.stats.retweets} | Reply: ${result.stats.replies}`, {
          title: 'Twitter Downloader',
          body: 'Tidak ada media'
        })
      }
      let caption = `*TWITTER / X DOWNLOADER*\n\n`
      caption += `Author : ${result.author.name} (@${result.author.username})\n`
      caption += `Tanggal : ${result.stats.date}\n`
      caption += `Likes : ${result.stats.likes} | RT : ${result.stats.retweets} | Reply : ${result.stats.replies}\n\n`
      if (result.text) caption += `${result.text}\n\n`
      caption += `Media : ${result.media.length} file\nLink : ${result.url}`
      await sendFakeQuoted(denn, m, caption, {
        title: 'Twitter Downloader',
        body: `@${result.author.username}`
      })
      for (const media of result.media) {
        try {
          const buffer = await fetchBuffer(media.url)
          if (media.type === 'video' || media.type === 'gif' || media.type === 'animated_gif') {
            await denn.sendMessage(m.chat, { video: buffer, caption: `Video dari @${result.author.username}`, mimetype: 'video/mp4' }, { quoted: m })
          } else {
            await denn.sendMessage(m.chat, { image: buffer, caption: `Foto dari @${result.author.username}` }, { quoted: m })
          }
        } catch (e) {}
      }
    } catch (e) {
      return sendFakeQuoted(denn, m, `Gagal download Twitter: ${e.message}`, {
        title: 'Twitter Downloader',
        body: 'Gagal'
      })
    }
  }
}