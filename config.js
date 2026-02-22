import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Determine if running in Google Cloud
const isCloudEnvironment = process.env.K_SERVICE ? true : false;

export const config = {
  // Running environment
  isCloudEnvironment: isCloudEnvironment,
  
  // Google Cloud configuration
  cloud: {
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    bucketName: process.env.GCS_BUCKET_NAME,
    useCloudStorage: isCloudEnvironment || process.env.USE_CLOUD_STORAGE === 'true'
  },
  
  // Google Cloud Text-to-Speech configuration
  tts: {
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Chirp3-HD-Achernar', // Default to Chirp 3: HD voice
      ssmlGender: 'FEMALE'
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0,
      volumeGainDb: 0.0,
      effectsProfileId: ['headphone-class-device']
    }
  },
  
  // API Endpoint for processing
  api: {
    functionUrl: process.env.FUNCTION_URL || 'https://europe-west2-hippo-ideas.cloudfunctions.net/sustainability-tss-podcast'
  },
  
  // Podcast metadata
  podcast: {
    title: process.env.PODCAST_TITLE || 'Sustainability Podcast Generator',
    description: process.env.PODCAST_DESCRIPTION || 'Articles on sustainability read aloud',
    author: process.env.PODCAST_AUTHOR || 'Sustainability TTS',
    siteUrl: process.env.PODCAST_SITE_URL || 'https://storage.googleapis.com/sustainability-podcast',
    imageUrl: process.env.PODCAST_IMAGE_URL || 'https://storage.googleapis.com/sustainability-podcast/logo.png',
    language: 'en',
    categories: ['Technology', 'News']
  },
  
  // Output configuration
  output: {
    audioDir: process.env.AUDIO_OUTPUT_DIR 
      ? path.resolve(process.env.AUDIO_OUTPUT_DIR) 
      : path.join(__dirname, 'audio'),
    feedPath: process.env.FEED_OUTPUT_PATH
      ? path.resolve(process.env.FEED_OUTPUT_PATH)
      : path.join(__dirname, 'feed.xml')
  },
  
  // Content processing
  content: {
    maxTextLength: 50000, // Max characters to process per article
    cacheFile: process.env.CACHE_FILE_PATH 
      ? path.resolve(process.env.CACHE_FILE_PATH)
      : path.join(__dirname, 'processed-articles.json'),
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
  }
};
