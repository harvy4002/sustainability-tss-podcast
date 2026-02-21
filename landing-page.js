import { config } from './config.js';
import { saveToCloudStorage } from './cloud-storage.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Creates a simple landing page
 * @param {Array} episodes - List of podcast episodes to display
 * @param {Object} usageStats - Usage statistics for the current month
 * @returns {Promise<string>} URL or path of the landing page
 */
export async function createLandingPage(episodes = [], usageStats = null) {
  const feedUrl = config.cloud.useCloudStorage
    ? `https://storage.googleapis.com/${config.cloud.bucketName}/feed.xml`
    : `${config.podcast.siteUrl}/feed.xml`;
    
  const functionUrl = config.api.functionUrl;
  
  // Sort episodes by date (newest first)
  const sortedEpisodes = [...episodes].sort((a, b) => {
    return new Date(b.pubDate) - new Date(a.pubDate);
  });

  const episodeHtml = sortedEpisodes.map(episode => `
    <div class="episode-card">
      <div class="episode-info">
        <h3>${episode.title}</h3>
        <p class="date">${new Date(episode.pubDate).toLocaleDateString()}</p>
        <p class="description">${(episode.description || '').substring(0, 200)}${(episode.description || '').length > 200 ? '...' : ''}</p>
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

  // Usage Stats HTML
  let usageHtml = '';
  if (usageStats) {
    const chirpLimit = 1000000; // 1 Million characters free
    const chirpUsed = usageStats.chirpChars || 0;
    const chirpPercent = Math.min(100, (chirpUsed / chirpLimit) * 100);
    const chirpColor = chirpPercent > 90 ? '#ef4444' : (chirpPercent > 75 ? '#f59e0b' : '#10b981');
    
    const totalCost = usageStats.costEstimate > 0 ? `$${usageStats.costEstimate.toFixed(2)}` : 'Free';
    
    usageHtml = `
    <div class="usage-card">
      <h3>Monthly TTS Usage & Cost</h3>
      
      <h4>Chirp 3: HD Voice (Premium)</h4>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${chirpPercent}%; background-color: ${chirpColor};"></div>
      </div>
      <div class="usage-text">
        <span>${chirpUsed.toLocaleString()} / ${chirpLimit.toLocaleString()} chars</span>
        <span class="cost-tag">${chirpUsed >= chirpLimit ? 'Charges Apply' : 'Free Tier'}</span>
      </div>
      <p class="usage-note">Using high-fidelity Chirp 3: HD models (1M chars free, then $30/1M).</p>
      
      <h4 style="margin-top: 30px;">Estimated Total Cost This Month: ${totalCost}</h4>
      <p class="usage-note">Usage and cost estimates reset on the 1st of each month.</p>
    </div>
    `;
  }
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.podcast.title}</title>
  <style>
    :root {
      --primary: #16a34a; /* Green-600 */
      --primary-hover: #15803d; /* Green-700 */
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
    /* Add Article Form */
    .add-article-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #e2e8f0;
    }
    .input-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    input[type="url"] {
      flex: 1;
      padding: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 1rem;
    }
    .status-message {
      margin-top: 10px;
      font-size: 0.9rem;
      display: none;
    }
    .status-message.success { color: #10b981; display: block; }
    .status-message.error { color: #ef4444; display: block; }
    .status-message.loading { color: var(--primary); display: block; }
    
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
      border: none;
      cursor: pointer;
      font-size: 1rem;
    }
    .button:hover {
      background: var(--primary-hover);
    }
    .button:disabled {
      background: var(--text-muted);
      cursor: not-allowed;
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
    /* Usage Stats Styles */
    .usage-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #e2e8f0;
    }
    .usage-card h3 {
      margin-top: 0;
      font-size: 1.5rem;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .usage-card h4 {
      margin-top: 25px;
      margin-bottom: 8px;
      font-size: 1.1rem;
      color: var(--text);
    }
    .progress-bar-container {
      background: #e2e8f0;
      border-radius: 99px;
      height: 10px;
      width: 100%;
      margin: 8px 0;
      overflow: hidden;
    }
    .progress-bar {
      height: 100%;
      border-radius: 99px;
      transition: width 0.5s ease-in-out;
    }
    .usage-text {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      font-weight: 500;
      margin-top: 5px;
    }
    .cost-tag {
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
      color: var(--text-muted);
    }
    .usage-note {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 10px;
      margin-bottom: 0;
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
    
    <div class="add-article-card">
        <h3>Add New Article</h3>
        <p>Paste a link to convert it to audio:</p>
        <form id="addArticleForm">
            <div class="input-group">
                <input type="url" id="articleUrl" name="url" placeholder="https://example.com/article" required>
                <button type="submit" class="button" id="submitBtn">Convert</button>
            </div>
            <div id="statusMessage" class="status-message"></div>
        </form>
    </div>
    
    ${usageHtml}
    
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
      ${episodeHtml || '<p>No episodes available yet.</p>'}
    </section>
    
    <footer>
      <p>Last updated: ${new Date().toLocaleString()}</p>
      <p>Generated by Sustainability TSS Podcast</p>
    </footer>
  </div>

  <script>
    const form = document.getElementById('addArticleForm');
    const statusDiv = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');
    const input = document.getElementById('articleUrl');
    
    // The Cloud Function URL
    const FUNCTION_URL = '${functionUrl}';
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = input.value;
        
        if (!url) return;
        
        // UI Loading State
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';
        statusDiv.className = 'status-message loading';
        statusDiv.textContent = 'Fetching article and generating audio. This may take a minute...';
        
        try {
            // Construct URL with query param for GET request, or use POST if preferred
            // Using GET for simplicity as per original design, but POST is better. 
            // The function handles both now. Let's use POST.
            const response = await fetch(FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to process article');
            }
            
            const data = await response.json();
            
            statusDiv.className = 'status-message success';
            statusDiv.textContent = 'Success! Reloading page...';
            
            // Clear input
            input.value = '';
            
            // Reload page to show new episode (after a short delay to allow GCS to update)
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error(error);
            statusDiv.className = 'status-message error';
            statusDiv.textContent = 'Error: ' + error.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'Convert';
        }
    });
  </script>
</body>
</html>
  `;
  
    if (config.cloud.useCloudStorage) {
  
      const publicUrl = await saveToCloudStorage(
  
        'index.html',
  
        html,
  
        '',
  
        'text/html'
  
      );
  
      console.log(`Landing page created at: ${publicUrl}`);
  
      return publicUrl;
  
    } else {
  
      // Local write
  
      const outputPath = path.join(process.cwd(), 'index.html');
  
      await fs.writeFile(outputPath, html, 'utf8');
  
      console.log(`Landing page generated locally at: ${outputPath}`);
  
      return outputPath;
  
    }
  
  }
  
  