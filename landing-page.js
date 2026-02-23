import { config } from './config.js';
import { saveToCloudStorage } from './cloud-storage.js';
import fs from 'fs/promises';
import path from 'path';
import Handlebars from 'handlebars';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  
  // Generate QR Code for the site
  const qrCodeDataUrl = await QRCode.toDataURL(config.podcast.siteUrl, {
    margin: 2,
    color: {
      dark: '#15803d',
      light: '#ffffff'
    }
  });

  // Sort episodes by date (newest first) and format for display
  const sortedEpisodes = [...episodes]
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .map(episode => ({
      ...episode,
      pubDate: new Date(episode.pubDate).toLocaleDateString(),
      description: (episode.description || '').substring(0, 200) + ((episode.description || '').length > 200 ? '...' : '')
    }));

  // Usage Stats View Model
  let usage = null;
  let carbon = null;
  
  if (usageStats) {
    const chirpLimit = 1000000; // 1 Million characters free
    const chirpUsed = usageStats.chirpChars || 0;
    const totalChars = usageStats.totalChars || 0;
    const lifetimeChars = usageStats.lifetimeTotalChars || totalChars;
    const chirpPercent = Math.min(100, (chirpUsed / chirpLimit) * 100);
    const chirpColor = chirpPercent > 90 ? '#ef4444' : (chirpPercent > 75 ? '#f59e0b' : '#10b981');
    const totalCost = usageStats.costEstimate > 0 ? `$${usageStats.costEstimate.toFixed(2)}` : 'Free';
    
    usage = {
      percent: chirpPercent,
      color: chirpColor,
      used: chirpUsed.toLocaleString(),
      limit: chirpLimit.toLocaleString(),
      cost: totalCost,
      isOverLimit: chirpUsed >= chirpLimit
    };
    
    // Carbon Calculation
    const kwhPerMillionChars = 10.0;
    const gramsCo2PerKwh = 200; // UK Average
    const estimatedKwh = (lifetimeChars / 1000000) * kwhPerMillionChars;
    const gramsCo2 = estimatedKwh * gramsCo2PerKwh;
    const smartphoneCharges = Math.round(estimatedKwh / 0.015);
    const hoursProcessed = lifetimeChars / 48000; // Approx 48k chars per hour (800 chars/min)
    
    carbon = {
      co2: (gramsCo2 / 1000).toFixed(2),
      energy: estimatedKwh.toFixed(3),
      charges: smartphoneCharges.toLocaleString(),
      hours: hoursProcessed.toFixed(1),
      articleCount: usageStats.lifetimeArticleCount || episodes.length
    };
  }

  // Read Template
  const templatePath = path.join(__dirname, 'templates', 'landing-page.hbs');
  const templateSource = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateSource);
  
  // Render HTML
  const html = template({
    config,
    feedUrl,
    feedUrlNoProtocol: feedUrl.replace('https://', ''),
    functionUrl,
    qrCodeDataUrl,
    episodes: sortedEpisodes,
    usage,
    carbon,
    lastUpdated: new Date().toLocaleString()
  });
  
  if (config.cloud.useCloudStorage) {
    return await saveToCloudStorage('index.html', html, '', 'text/html');
  } else {
    const outputPath = path.join(process.cwd(), 'index.html');
    await fs.writeFile(outputPath, html, 'utf8');
    return outputPath;
  }
}