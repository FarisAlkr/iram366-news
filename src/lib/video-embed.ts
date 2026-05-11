/**
 * Parses third-party video URLs into iframe-embeddable form.
 *
 * Supports YouTube (incl. Shorts), TikTok, Instagram (posts/reels),
 * X / Twitter, and Facebook. Returns the embed src and a hint about
 * the natural aspect ratio so the page can reserve the right space
 * before the iframe loads.
 *
 * Privacy note: YouTube embeds use youtube-nocookie.com so visitors
 * aren't tracked unless they actually press play.
 */

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'facebook'

export type VideoAspect = 'wide' | 'tall' | 'square'

export interface ParsedVideo {
  platform: VideoPlatform
  embedSrc: string
  aspect: VideoAspect
}

const RX = {
  youtube: /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([\w-]{11})/i,
  youtubeShorts: /youtube\.com\/shorts\//i,
  tiktok: /tiktok\.com\/(?:@[^/]+\/video\/|v\/)(\d+)/i,
  instagram: /instagram\.com\/(p|reel|tv)\/([\w-]+)/i,
  twitter: /(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i,
  facebookVideo: /facebook\.com\/(?:[^/]+\/videos\/|watch\/?\?v=)(\d+)/i,
  facebookGeneric: /facebook\.com\//i,
}

export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
  if (!raw) return null
  const url = raw.trim()
  if (!url) return null

  // YouTube — covers watch?v=, youtu.be/, /shorts/, /embed/
  const yt = url.match(RX.youtube)
  if (yt) {
    const id = yt[1]
    const isShort = RX.youtubeShorts.test(url)
    return {
      platform: 'youtube',
      embedSrc: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
      aspect: isShort ? 'tall' : 'wide',
    }
  }

  // TikTok
  const tt = url.match(RX.tiktok)
  if (tt) {
    return {
      platform: 'tiktok',
      embedSrc: `https://www.tiktok.com/embed/v2/${tt[1]}`,
      aspect: 'tall',
    }
  }

  // Instagram (posts, reels, tv)
  const ig = url.match(RX.instagram)
  if (ig) {
    const kind = ig[1] // p | reel | tv
    const id = ig[2]
    return {
      platform: 'instagram',
      embedSrc: `https://www.instagram.com/${kind}/${id}/embed/`,
      aspect: kind === 'reel' ? 'tall' : 'square',
    }
  }

  // X / Twitter
  const tw = url.match(RX.twitter)
  if (tw) {
    return {
      platform: 'twitter',
      embedSrc: `https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}`,
      aspect: 'wide',
    }
  }

  // Facebook — needs the original URL passed to the plugin
  if (RX.facebookGeneric.test(url)) {
    return {
      platform: 'facebook',
      embedSrc: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
      aspect: RX.facebookVideo.test(url) ? 'wide' : 'wide',
    }
  }

  return null
}

export function aspectClass(aspect: VideoAspect): string {
  switch (aspect) {
    case 'tall':
      return 'aspect-[9/16]'
    case 'square':
      return 'aspect-square'
    case 'wide':
    default:
      return 'aspect-video'
  }
}
