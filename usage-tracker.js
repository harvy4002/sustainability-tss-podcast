import { loadJsonFile, saveJsonFile } from './utils.js';
import { config } from './config.js';

const STATS_FILE = 'usage-stats.json';
const LOG_FILE = 'processing-log.json';

const CHIRP_FEMALE_VOICES = [
  'en-US-Chirp3-HD-Achernar',
  'en-US-Chirp3-HD-Aoede',
  'en-US-Chirp3-HD-Autonoe',
  'en-US-Chirp3-HD-Callirrhoe',
  'en-US-Chirp3-HD-Despina',
  'en-US-Chirp3-HD-Erinome',
  'en-US-Chirp3-HD-Gacrux',
  'en-US-Chirp3-HD-Kore',
  'en-US-Chirp3-HD-Laomedeia',
  'en-US-Chirp3-HD-Leda',
  'en-US-Chirp3-HD-Pulcherrima',
  'en-US-Chirp3-HD-Sulafat',
  'en-US-Chirp3-HD-Vindemiatrix',
  'en-US-Chirp3-HD-Zephyr'
];

const CHIRP_MALE_VOICES = [
  'en-US-Chirp3-HD-Bellatrix',
  'en-US-Chirp3-HD-Canopus',
  'en-US-Chirp3-HD-Castor',
  'en-US-Chirp3-HD-Enif',
  'en-US-Chirp3-HD-Fenrir',
  'en-US-Chirp3-HD-Hadar',
  'en-US-Chirp3-HD-Helvetios',
  'en-US-Chirp3-HD-Isonoe',
  'en-US-Chirp3-HD-Menkar',
  'en-US-Chirp3-HD-Miram',
  'en-US-Chirp3-HD-Orion',
  'en-US-Chirp3-HD-Polaris',
  'en-US-Chirp3-HD-Rigel',
  'en-US-Chirp3-HD-Sirius',
  'en-US-Chirp3-HD-Spica',
  'en-US-Chirp3-HD-Tarazed'
];

/**
 * Logs a detailed processing event for future analysis
 * @param {Object} data - Event data (url, title, charCount, voice, etc.)
 */
export async function logProcessingEvent(data) {
  const log = await loadJsonFile(LOG_FILE, { events: [] });
  
  log.events.push({
    timestamp: new Date().toISOString(),
    ...data,
    region: 'europe-west2', // Current deployment region
    metricsVersion: 1
  });
  
  await saveJsonFile(LOG_FILE, log);
  console.log(`Logged processing event for "${data.title}"`);
}

/**
 * Updates the usage statistics with new character counts
 * @param {number} charCount - Number of characters processed
 * @param {string} voiceName - The name of the voice used
 * @returns {Promise<Object>} Updated stats for the current month
 */
export async function trackUsage(charCount, voiceName) {
  if (charCount === 0) return await getCurrentMonthStats();

  const stats = await loadJsonFile(STATS_FILE, { history: {} });
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  // Initialize month if not exists
  if (!stats.history[monthKey]) {
    stats.history[monthKey] = {
      chirpChars: 0,
      totalChars: 0,
      costEstimate: 0
    };
  }

  // Update counts
  stats.history[monthKey].chirpChars = (stats.history[monthKey].chirpChars || 0) + charCount;
  stats.history[monthKey].totalChars += charCount;
  stats.history[monthKey].articleCount = (stats.history[monthKey].articleCount || 0) + 1;
  
  // Calculate Cost Estimate
  // Chirp 3: HD: First 1M free, then $30/1M characters
  const billableChars = Math.max(0, (stats.history[monthKey].chirpChars || 0) - 1000000);
  const chirpCost = (billableChars / 1000000) * 30;
  
  stats.history[monthKey].costEstimate = chirpCost;

  await saveJsonFile(STATS_FILE, stats);
  
  const lifetimeTotalChars = calculateLifetimeTotal(stats);
  const lifetimeArticleCount = calculateLifetimeArticles(stats);
  
  return {
    ...stats.history[monthKey],
    lifetimeTotalChars,
    lifetimeArticleCount
  };
}

/**
 * Gets the stats for the current month
 */
export async function getCurrentMonthStats() {
  const stats = await loadJsonFile(STATS_FILE, { history: {} });
  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const currentMonth = stats.history[monthKey] || { 
    chirpChars: 0, 
    totalChars: 0, 
    costEstimate: 0,
    articleCount: 0
  };
  
  const lifetimeTotalChars = calculateLifetimeTotal(stats);
  const lifetimeArticleCount = calculateLifetimeArticles(stats);
  
  return {
    ...currentMonth,
    lifetimeTotalChars,
    lifetimeArticleCount
  };
}

function calculateLifetimeTotal(stats) {
  let total = 0;
  if (stats && stats.history) {
    for (const key in stats.history) {
      if (stats.history[key].totalChars) {
        total += stats.history[key].totalChars;
      }
    }
  }
  return total;
}

function calculateLifetimeArticles(stats) {
  let total = 0;
  if (stats && stats.history) {
    for (const key in stats.history) {
      if (stats.history[key].articleCount) {
        total += stats.history[key].articleCount;
      }
    }
  }
  return total;
}

/**
 * Determines which voice to use based on current usage
 * Picks a random voice from both male and female Chirp 3: HD pools
 * @returns {Promise<Object>} The voice configuration object to use
 */
export async function getOptimalVoice() {
  const isMale = Math.random() < 0.5;
  const pool = isMale ? CHIRP_MALE_VOICES : CHIRP_FEMALE_VOICES;
  const randomVoice = pool[Math.floor(Math.random() * pool.length)];
  const gender = isMale ? 'MALE' : 'FEMALE';
  
  console.log(`Selected random Chirp 3: HD ${gender} voice: ${randomVoice}`);
  
  return {
    languageCode: 'en-US',
    name: randomVoice,
    ssmlGender: gender
  };
}