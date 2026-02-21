import { loadJsonFile, saveJsonFile } from './utils.js';
import { config } from './config.js';

const STATS_FILE = 'usage-stats.json';

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
  
  // Calculate Cost Estimate
  // Chirp 3: HD: First 1M free, then $30/1M characters
  const billableChars = Math.max(0, (stats.history[monthKey].chirpChars || 0) - 1000000);
  const chirpCost = (billableChars / 1000000) * 30;
  
  stats.history[monthKey].costEstimate = chirpCost;

  await saveJsonFile(STATS_FILE, stats);
  
  const lifetimeTotalChars = calculateLifetimeTotal(stats);
  
  return {
    ...stats.history[monthKey],
    lifetimeTotalChars
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
    costEstimate: 0 
  };
  
  const lifetimeTotalChars = calculateLifetimeTotal(stats);
  
  return {
    ...currentMonth,
    lifetimeTotalChars
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

/**
 * Determines which voice to use based on current usage
 * Picks a random female Chirp 3: HD voice
 * @returns {Promise<Object>} The voice configuration object to use
 */
export async function getOptimalVoice() {
  const randomVoice = CHIRP_FEMALE_VOICES[Math.floor(Math.random() * CHIRP_FEMALE_VOICES.length)];
  
  console.log(`Selected random Chirp 3: HD female voice: ${randomVoice}`);
  
  return {
    languageCode: 'en-US',
    name: randomVoice,
    ssmlGender: 'FEMALE'
  };
}
