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

  // Usage Stats & Carbon HTML
  let usageHtml = '';
  let carbonHtml = '';
  
  if (usageStats) {
    const chirpLimit = 1000000; // 1 Million characters free
    const chirpUsed = usageStats.chirpChars || 0;
    const totalChars = usageStats.totalChars || 0;
    const lifetimeChars = usageStats.lifetimeTotalChars || totalChars;
    const chirpPercent = Math.min(100, (chirpUsed / chirpLimit) * 100);
    const chirpColor = chirpPercent > 90 ? '#ef4444' : (chirpPercent > 75 ? '#f59e0b' : '#10b981');
    
    const totalCost = usageStats.costEstimate > 0 ? `$${usageStats.costEstimate.toFixed(2)}` : 'Free';
    
    // Carbon Calculation (Estimates based on ASR/TTS benchmarks)
    // 1 hour audio ~ 0.5 kWh
    // 1M chars ~ 22 hours audio
    // Total ~ 11 kWh per 1M chars. We use 10.0 as a round conservative estimate.
    const kwhPerMillionChars = 10.0;
    const gramsCo2PerKwh = 200; // UK Average
    const estimatedKwh = (lifetimeChars / 1000000) * kwhPerMillionChars;
    const gramsCo2 = estimatedKwh * gramsCo2PerKwh;
    const smartphoneCharges = Math.round(estimatedKwh / 0.015); // 1 charge ~ 0.015 kWh
    
    usageHtml = `
    <div class="usage-card">
      <details>
        <summary>
          <h3>Monthly TTS Usage & Cost</h3>
        </summary>
        <div class="usage-details">
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
      </details>
    </div>
    `;

    carbonHtml = `
    <div class="carbon-card">
      <h3>
        🌱 Carbon Impact
        <div class="info-icon">
          i
          <div class="tooltip">
            <strong>Methodology:</strong><br>
            • AI Energy: ~0.5 kWh per hour of audio generated (~10 kWh per 1M chars).<br>
            • Grid Intensity: ~200g CO₂e/kWh (London).<br>
            • Smartphone: 1 full charge ≈ 0.015 kWh (15 Wh battery).
          </div>
        </div>
      </h3>
      <div class="carbon-grid">
        <div class="carbon-stat">
          <div class="carbon-value">${(gramsCo2 / 1000).toFixed(2)}kg</div>
          <div class="carbon-label">CO₂e Emitted</div>
        </div>
        <div class="carbon-stat">
          <div class="carbon-value">${estimatedKwh.toFixed(3)}</div>
          <div class="carbon-label">kWh Energy</div>
        </div>
        <div class="carbon-stat">
          <div class="carbon-value">${smartphoneCharges.toLocaleString()}</div>
          <div class="carbon-label">Phone Charges</div>
        </div>
      </div>
      <p class="carbon-note">
        Estimates based on Google Cloud region <code>europe-west2</code> (London) carbon intensity and AI inference energy models. 
      </p>
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
      --primary: #16a34a;
      --primary-hover: #15803d;
      --bg: #f0fdf4;
      --text: #064e3b;
      --text-muted: #64748b;
      --card-bg: #ffffff;
      --shadow: 0 4px 6px -1px rgb(22 163 74 / 0.1), 0 2px 4px -2px rgb(22 163 74 / 0.1);
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
    h1, h2, h3 {
      color: #15803d;
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .podcast-description {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 20px;
    }
    .experimental-notice {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      color: #92400e;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 30px;
      font-size: 0.95rem;
      text-align: center;
    }
    .add-article-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #bbf7d0;
    }
    .input-group {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    input[type="url"] {
      flex: 1;
      padding: 12px;
      border: 1px solid #86efac;
      border-radius: 6px;
      font-size: 1rem;
      background-color: #f0fdf4;
    }
    input[type="url"]:focus {
      outline: 2px solid var(--primary);
      border-color: var(--primary);
    }
    /* Progress Bar */
    .progress-wrapper {
      margin-top: 25px;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      display: none;
    }
    .progress-bar-bg {
      background: #e2e8f0;
      border-radius: 99px;
      height: 16px;
      width: 100%;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
    }
    .progress-bar-fill {
      height: 100%;
      background-color: var(--primary);
      width: 0%;
      border-radius: 99px;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .progress-text {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text);
      margin-top: 10px;
      text-align: center;
    }
    .status-message {
      margin-top: 10px;
      font-size: 0.9rem;
      display: none;
    }
    .status-message.success { color: #15803d; display: block; }
    .status-message.error { color: #ef4444; display: block; }
    
    .subscription-box {
      background: #dcfce7;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #86efac;
    }
    .feed-url {
      background: #ffffff;
      padding: 12px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9rem;
      word-break: break-all;
      border: 1px solid #86efac;
      display: block;
      color: #15803d;
      margin: 15px 0;
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
    }
    .button:hover { background: var(--primary-hover); }
    .button:disabled { background: var(--text-muted); cursor: not-allowed; }
    
    .usage-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 40px;
      box-shadow: var(--shadow);
      border: 1px solid #e2e8f0;
    }
    .usage-card summary {
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      list-style: none;
      padding-bottom: 10px;
      border-bottom: 2px solid #bbf7d0;
    }
    .usage-card summary::after { content: '+'; font-size: 1.5rem; color: #15803d; font-weight: bold; }
    .usage-card details[open] summary::after { content: '-'; }
    .usage-card summary::-webkit-details-marker { display: none; }
    
    .progress-bar-container {
      background: #e2e8f0;
      border-radius: 99px;
      height: 10px;
      margin: 10px 0;
      overflow: hidden;
    }
    .progress-bar { height: 100%; border-radius: 99px; }
    .usage-text { display: flex; justify-content: space-between; font-size: 0.9rem; }
    .cost-tag { background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
    
    .carbon-card { background: #064e3b; color: white; border-radius: 12px; padding: 24px; margin-bottom: 40px; box-shadow: var(--shadow); }
    .carbon-card h3 { color: #86efac; border-bottom: 1px solid #10b981; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; position: relative; }
    .carbon-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; text-align: center; }
    .carbon-stat { background: rgb(255 255 255 / 0.1); padding: 15px 10px; border-radius: 8px; }
    .carbon-value { font-size: 1.5rem; font-weight: bold; }
    .carbon-label { font-size: 0.85rem; color: #86efac; }
    .info-icon { background: rgba(255,255,255,0.2); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: help; position: relative; font-size: 0.9rem; }
    .tooltip { visibility: hidden; width: 280px; background: white; color: #1e293b; border-radius: 8px; padding: 12px; position: absolute; bottom: 125%; right: 0; opacity: 0; transition: opacity 0.3s; font-size: 0.85rem; box-shadow: var(--shadow); font-weight: normal; border: 1px solid #e2e8f0; }
    .info-icon:hover .tooltip { visibility: visible; opacity: 1; }
    .episode-card { background: var(--card-bg); border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: var(--shadow); border: 1px solid #e2e8f0; }
    .cover { max-width: 150px; border-radius: 12px; margin-bottom: 20px; box-shadow: var(--shadow); }
  </style>
</head>
<body>
  <div class="container">
    <div class="experimental-notice">
      <strong>⚠️ Experimental Service:</strong> Audio quality may vary depending on web page structure.
    </div>
    <header>
      <img src="${config.podcast.imageUrl}" alt="Logo" class="cover">
      <h1>${config.podcast.title}</h1>
      <p class="podcast-description">${config.podcast.description}</p>
    </header>
    <div class="add-article-card">
      <h3>Add New Article</h3>
      <form id="addArticleForm">
        <div class="input-group">
          <input type="url" id="articleUrl" placeholder="https://example.com/article" required>
          <button type="submit" class="button" id="submitBtn">Convert</button>
        </div>
        <div id="progressWrapper" class="progress-wrapper">
          <div class="progress-bar-bg"><div id="progressBar" class="progress-bar-fill"></div></div>
          <p id="progressText" class="progress-text">Warming up...</p>
        </div>
        <div id="statusMessage" class="status-message"></div>
      </form>
    </div>
    ${usageHtml}
    ${carbonHtml}
    <div class="subscription-box">
      <h3>Subscribe</h3>
      <code class="feed-url">${feedUrl}</code>
      <a href="pcast://${feedUrl.replace('https://', '')}" class="button">Open in Podcast App</a>
    </div>
    <section>
      <h2>Episodes</h2>
      ${episodeHtml || '<p>No episodes available yet.</p>'}
    </section>
    <footer>
      <p>Last updated: ${new Date().toLocaleString()}</p>
      <p>Sustainability TSS Podcast | v1.1</p>
    </footer>
  </div>
  <script>
    const form = document.getElementById('addArticleForm');
    const statusDiv = document.getElementById('statusMessage');
    const submitBtn = document.getElementById('submitBtn');
    const progressWrapper = document.getElementById('progressWrapper');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const FUNCTION_URL = '${functionUrl}';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = document.getElementById('articleUrl').value;
      submitBtn.disabled = true;
      progressWrapper.style.display = 'block';
      try {
        const response = await fetch(FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line);
            if (event.type === 'progress' || event.type === 'status') {
              if (event.percent !== undefined) progressBar.style.width = event.percent + '%';
              if (event.message) progressText.textContent = event.message;
            } else if (event.type === 'complete') {
              window.location.reload();
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          }
        }
      } catch (err) {
        progressWrapper.style.display = 'none';
        statusDiv.style.display = 'block';
        statusDiv.className = 'status-message error';
        statusDiv.textContent = err.message;
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;
  
  if (config.cloud.useCloudStorage) {
    return await saveToCloudStorage('index.html', html, '', 'text/html');
  } else {
    const outputPath = path.join(process.cwd(), 'index.html');
    await fs.writeFile(outputPath, html, 'utf8');
    return outputPath;
  }
}
