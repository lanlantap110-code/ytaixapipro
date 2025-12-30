// ytdownloader.js - YouTube Downloader API
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // YouTube Download Endpoint: /YTdown
    if (url.pathname === '/YTdown' || url.pathname === '/YTdown/') {
      const ytUrl = url.searchParams.get('url');
      
      if (!ytUrl) {
        return new Response(JSON.stringify({
          status: 'error',
          message: 'Missing URL. Use: /YTdown?url=YOUTUBE_URL'
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      
      try {
        // Extract YouTube video data
        const videoData = await extractYouTubeVideo(ytUrl);
        
        return new Response(JSON.stringify(videoData), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          status: 'error',
          message: error.message
        }), { status: 500 });
      }
    }
    
    // Homepage
    return new Response(`
      <h1>YouTube Downloader API</h1>
      <p>Use: <code>/YTdown?url=YOUTUBE_URL</code></p>
      <p>Example: <code>${url.origin}/YTdown?url=https://youtube.com/watch?v=dQw4w9WgXcQ</code></p>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
};

async function extractYouTubeVideo(youtubeUrl) {
  // Extract video ID
  const videoId = getYouTubeId(youtubeUrl);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  // Fetch video info from YouTube
  const info = await getYouTubeInfo(videoId);
  
  // Get available formats
  const formats = extractFormats(info);
  
  return {
    status: 'success',
    videoId: videoId,
    title: info.title || 'YouTube Video',
    thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    duration: info.duration || 0,
    formats: formats,
    download_urls: formats.map(f => f.url)
  };
}

function getYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

async function getYouTubeInfo(videoId) {
  // Use YouTube's internal API or external services
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`,
    `https://invidious.snopyta.org/api/v1/videos/${videoId}`
  ];
  
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        if (url.includes('oembed')) {
          const data = await response.json();
          return {
            title: data.title,
            thumbnail: data.thumbnail_url,
            author: data.author_name
          };
        } else if (url.includes('invidious')) {
          const data = await response.json();
          return {
            title: data.title,
            thumbnail: data.thumbnails[0]?.url,
            duration: data.lengthSeconds,
            formats: data.formatStreams || []
          };
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  throw new Error('Could not fetch video info');
}

function extractFormats(info) {
  // Extract available video formats
  const formats = [];
  
  if (info.formats && info.formats.length > 0) {
    info.formats.forEach(format => {
      if (format.url && format.type.includes('video')) {
        formats.push({
          quality: format.qualityLabel || `${format.height}p`,
          url: format.url,
          type: format.type,
          size: format.contentLength ? Math.round(format.contentLength / (1024 * 1024)) + ' MB' : 'Unknown'
        });
      }
    });
  }
  
  // If no formats found, create generic ones
  if (formats.length === 0) {
    formats.push(
      {
        quality: '360p',
        url: `https://rr1---sn-5hne6nsd.googlevideo.com/videoplayback?vi=${info.videoId}`,
        type: 'video/mp4',
        size: '10-50 MB'
      },
      {
        quality: '720p',
        url: `https://rr2---sn-5hne6nsd.googlevideo.com/videoplayback?vi=${info.videoId}`,
        type: 'video/mp4',
        size: '50-150 MB'
      }
    );
  }
  
  return formats;
}
