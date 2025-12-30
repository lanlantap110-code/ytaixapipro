// yt-api.js - Working YouTube Downloader
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // YouTube Download Endpoint
    if (url.pathname === '/YTdown' || url.pathname === '/YTdown/') {
      const ytUrl = url.searchParams.get('url');
      
      if (!ytUrl) {
        return jsonResponse({
          status: 'error',
          message: 'Missing URL parameter. Use: /YTdown?url=YOUTUBE_URL'
        }, 400, corsHeaders);
      }
      
      try {
        const videoData = await getYouTubeVideoInfo(ytUrl);
        return jsonResponse(videoData, 200, corsHeaders);
        
      } catch (error) {
        return jsonResponse({
          status: 'error',
          message: error.message
        }, 500, corsHeaders);
      }
    }
    
    // Homepage
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube Downloader API</title></head>
      <body>
        <h1>YouTube Downloader API</h1>
        <p><strong>Endpoint:</strong> <code>/YTdown?url=YOUTUBE_URL</code></p>
        <p><strong>Example:</strong></p>
        <code>${url.origin}/YTdown?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ</code>
      </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });
  }
};

// Helper function for JSON responses
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

// Main function to extract YouTube video info
async function getYouTubeVideoInfo(youtubeUrl) {
  // Extract video ID
  const videoId = extractYouTubeVideoId(youtubeUrl);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Provide a valid YouTube video URL.');
  }
  
  console.log(`Processing YouTube video ID: ${videoId}`);
  
  // Method 1: Try yt-dlp style extraction
  try {
    const videoInfo = await extractWithInvidious(videoId);
    if (videoInfo.formats && videoInfo.formats.length > 0) {
      return videoInfo;
    }
  } catch (e) {
    console.log('Method 1 failed:', e.message);
  }
  
  // Method 2: Try YouTube embed method
  try {
    const videoInfo = await extractFromEmbed(videoId);
    if (videoInfo.formats && videoInfo.formats.length > 0) {
      return videoInfo;
    }
  } catch (e) {
    console.log('Method 2 failed:', e.message);
  }
  
  // Method 3: Return basic info with generic URLs
  return {
    status: 'success',
    videoId: videoId,
    title: 'YouTube Video',
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    thumbnail_small: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: 0,
    formats: [
      {
        quality: '360p',
        url: `https://youtube.com/watch?v=${videoId}`,
        type: 'video/mp4',
        note: 'Use yt-dlp or similar tool to download'
      }
    ],
    alternative_methods: [
      `yt-dlp https://youtube.com/watch?v=${videoId}`,
      `Use online YouTube downloader websites`
    ]
  };
}

// Extract video ID from URL
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Method 1: Use Invidious API
async function extractWithInvidious(videoId) {
  const invidiousInstances = [
    'https://inv.riverside.rocks',
    'https://invidious.private.coffee',
    'https://vid.puffyan.us',
    'https://yt.artemislena.eu'
  ];
  
  for (const instance of invidiousInstances) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}`;
      console.log(`Trying Invidious: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Process formats
        const formats = [];
        
        if (data.formatStreams && data.formatStreams.length > 0) {
          data.formatStreams.forEach(stream => {
            if (stream.url) {
              formats.push({
                quality: stream.qualityLabel || `${stream.height}p`,
                url: stream.url,
                type: stream.type || 'video/mp4',
                size: stream.contentLength ? Math.round(stream.contentLength / (1024 * 1024)) + ' MB' : 'Unknown'
              });
            }
          });
        }
        
        // Also check adaptiveFormats for more options
        if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
          data.adaptiveFormats.forEach(format => {
            if (format.url && (format.type.includes('video') || format.type.includes('audio'))) {
              formats.push({
                quality: format.qualityLabel || format.bitrate ? Math.round(format.bitrate / 1000) + 'kbps' : 'audio',
                url: format.url,
                type: format.type,
                size: format.contentLength ? Math.round(format.contentLength / (1024 * 1024)) + ' MB' : 'Unknown'
              });
            }
          });
        }
        
        return {
          status: 'success',
          videoId: videoId,
          title: data.title || 'YouTube Video',
          thumbnail: data.thumbnails && data.thumbnails[3] ? data.thumbnails[3].url : 
                    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          duration: data.lengthSeconds || 0,
          author: data.author || 'Unknown',
          viewCount: data.viewCount || 0,
          formats: formats.slice(0, 10), // Limit to 10 formats
          note: formats.length > 0 ? 'Direct download available' : 'No direct URLs found'
        };
      }
    } catch (e) {
      console.log(`Invidious instance failed: ${e.message}`);
      continue;
    }
  }
  
  throw new Error('All Invidious instances failed');
}

// Method 2: Extract from YouTube embed page
async function extractFromEmbed(videoId) {
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Embed fetch failed: ${response.status}`);
  }
  
  const html = await response.text();
  
  // Try to extract player config
  const playerConfigMatch = html.match(/ytplayer\.config\s*=\s*({.*?});/);
  if (playerConfigMatch && playerConfigMatch[1]) {
    try {
      const config = JSON.parse(playerConfigMatch[1]);
      const args = config.args || {};
      
      return {
        status: 'success',
        videoId: videoId,
        title: args.title || 'YouTube Video',
        thumbnail: args.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        duration: args.length_seconds || 0,
        formats: [{
          quality: 'Various',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          type: 'video/mp4',
          note: 'Use third-party tools for direct download'
        }]
      };
    } catch (e) {
      console.log('Failed to parse player config:', e.message);
    }
  }
  
  throw new Error('Could not extract from embed page');
}
