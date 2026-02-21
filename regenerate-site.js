import fs from 'fs/promises';
import { loadJsonFile } from './utils.js';
import { generatePodcastFeed } from './podcast-feed.js';
import { fetchRssFeed } from './rss-parser.js';
import { config } from './config.js';

// Override config for local generation
config.cloud.useCloudStorage = false;
config.podcast.siteUrl = 'https://storage.googleapis.com/instapaper-podcasts';

async function regenerate() {
  console.log('Starting local site regeneration (for manual upload)...');
  console.log(`Target URL Base: ${config.podcast.siteUrl}`);

  // 1. Load cache
  const processedArticles = await loadJsonFile(config.content.cacheFile, {});
  const processedCount = Object.keys(processedArticles).length;
  console.log(`Found ${processedCount} articles in cache.`);

  // 2. Fetch current RSS feed for metadata (optional)
  let feedItems = [];
  try {
    console.log('Fetching RSS feed for metadata...');
    feedItems = await fetchRssFeed();
  } catch (err) {
    console.warn('Could not fetch RSS feed, using cache only.');
  }
  const feedMap = new Map(feedItems.map(item => [item.link, item]));

  // 3. Build episodes list
  const episodes = [];
  for (const [link, info] of Object.entries(processedArticles)) {
    const feedItem = feedMap.get(link);
    episodes.push({
      title: info.title,
      link: link,
      pubDate: feedItem?.pubDate || feedItem?.isoDate || info.processedDate || new Date().toISOString(),
      description: feedItem?.contentSnippet || feedItem?.description || info.title || "",
      content: feedItem?.content || info.title,
      audioPath: info.audioPath
    });
  }

  // 4. Regenerate Feed (Writes to local file due to useCloudStorage=false)
  console.log('Generating feed.xml locally...');
  await generatePodcastFeed(episodes, {
    feedSiteUrl: config.podcast.siteUrl
  });

  // 5. Generate Landing Page Locally
  console.log('Generating index.html locally...');
  const html = generateLandingPageHtml(episodes);
  await fs.writeFile('index.html', html);

  console.log('----------------------------------------');
  console.log('Generation Complete.');
  console.log('To upload, run:');
  console.log('gcloud storage cp feed.xml gs://instapaper-podcasts/feed.xml');
  console.log('gcloud storage cp index.html gs://instapaper-podcasts/index.html');
  console.log('----------------------------------------');
}

function generateLandingPageHtml(episodes) {
  const feedUrl = `${config.podcast.siteUrl}/feed.xml`;
  const sortedEpisodes = [...episodes].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  const episodeHtml = sortedEpisodes.map(episode => `
    <div class="episode-card">
      <div class="episode-info">
        <h3>${episode.title}</h3>
        <p class="date">${new Date(episode.pubDate).toLocaleDateString()}</p>
        <p class="description">${(episode.description || '').substring(0, 200)}...</p>
        <a href="${episode.link}" target="_blank" class="article-link">Read Original Article</a>
      </div>
      <div class="player-container">
        <audio controls preload="none">
          <source src="${episode.audioPath}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.podcast.title}</title>
  <style>
    :root {
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --bg: #f8fafc;
      --text: #1e293b;
      --text-muted: #64748b;
      --card-bg: #ffffff;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background-color: var(--bg);
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    header {
      text-align: center;
      margin-bottom: 40px;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      color: var(--text);
    }
    .podcast-description {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 20px;
    }
    .subscription-box {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #e2e8f0;
    }
    .feed-url-container {
      margin: 15px 0;
    }
    .feed-url {
      background: #f1f5f9;
      padding: 12px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9rem;
      word-break: break-all;
      border: 1px solid #cbd5e1;
      display: block;
    }
    .button {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .button:hover {
      background: var(--primary-hover);
    }
    h2 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }
    .episode-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
      border: 1px solid #e2e8f0;
      transition: transform 0.2s;
    }
    .episode-info h3 {
      margin-top: 0;
      margin-bottom: 8px;
    }
    .date {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 12px;
    }
    .description {
      font-size: 0.95rem;
      margin-bottom: 16px;
    }
    .article-link {
      color: var(--primary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .article-link:hover {
      text-decoration: underline;
    }
    .player-container {
      margin-top: 20px;
    }
    audio {
      width: 100%;
    }
    footer {
      text-align: center;
      margin-top: 60px;
      color: var(--text-muted);
      font-size: 0.9rem;
    }
    .cover {
      max-width: 150px;
      height: auto;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: var(--shadow);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <img src="${config.podcast.imageUrl}" alt="Podcast Cover" class="cover">
      <h1>${config.podcast.title}</h1>
      <p class="podcast-description">${config.podcast.description}</p>
    </header>
    
    <div class="subscription-box">
      <h3>Subscribe to the Podcast</h3>
      <p>Add this feed to your favorite podcast app:</p>
      <div class="feed-url-container">
        <code class="feed-url">${feedUrl}</code>
      </div>
      <a href="pcast://${feedUrl.replace('https://', '')}" class="button">Open in Podcast App</a>
    </div>
    
    <section>
      <h2>Episodes</h2>
      ${episodeHtml}
    </section>
    
    <footer>
      <p>Last updated: ${new Date().toLocaleDateString()}</p>
      <p>Generated by RSS TTS Podcast</p>
    </footer>
  </div>
</body>
</html>
  `;
}

regenerate().catch(error => {
  console.error('Regeneration failed:', error);
  process.exit(1);
});