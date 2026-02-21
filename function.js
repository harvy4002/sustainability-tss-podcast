import { processArticle } from './article-parser.js';
import { textToAudio } from './text-to-speech.js';
import { generatePodcastFeed } from './podcast-feed.js';
import { createLandingPage } from './landing-page.js';
import { ensureDirectoryExists, loadJsonFile, saveJsonFile } from './utils.js';
import { config } from './config.js';
import { trackUsage, getCurrentMonthStats, getOptimalVoice } from './usage-tracker.js';

/**
 * Cloud Function entry point
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 */
export async function generatePodcast(req, res) {
  // Set CORS headers for preflight requests
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  // Enable streaming
  res.set('Content-Type', 'application/x-ndjson');
  res.set('Transfer-Encoding', 'chunked');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Helper to stream events
  const sendEvent = (type, data) => {
    res.write(JSON.stringify({ type, ...data }) + '\n');
  };

  try {
    console.log('Sustainability TSS Podcast Generator Starting...');
    sendEvent('status', { message: 'Starting process...' });
    
    // Get Article URL from query parameter or body
    const articleUrl = req.query.url || req.body.url;
    
    // Ensure output directory exists (for local runs)
    if (!config.cloud.useCloudStorage) {
      await ensureDirectoryExists(config.output.audioDir);
    }
    
    // Load cache
    const processedArticles = await loadJsonFile(config.content.cacheFile, {});
    let newEpisode = null;
    let voiceUsedForThisRun = null;
    let totalCharsProcessed = 0;

    if (articleUrl) {
      console.log(`Received request to process article: ${articleUrl}`);
      sendEvent('progress', { percent: 0, message: 'Fetching article content...' });
      
      // Check if already processed
      // Check normalized URL (with/without trailing slash)
      const altUrl = articleUrl.endsWith('/') ? articleUrl.slice(0, -1) : articleUrl + '/';
      
      if (processedArticles[articleUrl] || processedArticles[altUrl]) {
        console.log(`Article already processed: ${articleUrl}`);
        sendEvent('status', { message: 'Article already processed. Regenerating feed...' });
      } else {
        try {
          // Process Article
          const article = await processArticle(articleUrl);
          
          // Determine optimal voice
          const optimalVoiceConfig = await getOptimalVoice();
          voiceUsedForThisRun = optimalVoiceConfig.name;
          
          console.log(`Converting article to audio: ${article.title} (Voice: ${voiceUsedForThisRun})`);
          
          const audioPath = await textToAudio(
            article.content, // content is already cleaned text
            article.title,
            optimalVoiceConfig,
            (percent, message) => sendEvent('progress', { percent, message })
          );
          
          // Track usage
          totalCharsProcessed += article.content.length;
          
          // Create episode object
          newEpisode = {
            title: article.title,
            link: article.link,
            pubDate: new Date().toISOString(),
            description: article.description || article.title,
            content: article.content,
            audioPath: audioPath
          };
          
          // Add to cache
          processedArticles[article.link] = {
            title: article.title,
            processedDate: new Date().toISOString(),
            audioPath: audioPath,
            description: article.description,
            // Store minimal info needed for feed generation
          };
          
          // Save cache immediately
          await saveJsonFile(config.content.cacheFile, processedArticles);
          
        } catch (error) {
          console.error(`Error processing article "${articleUrl}":`, error.message);
          sendEvent('error', { message: `Error processing article: ${error.message}` });
          res.end();
          return;
        }
      }
    } else {
      console.log('No URL provided. Regenerating feed/landing page only.');
      sendEvent('status', { message: 'Regenerating feed and landing page...' });
    }
    
    // Update usage stats if we processed anything
    let updatedStats = await getCurrentMonthStats();
    if (totalCharsProcessed > 0) {
      updatedStats = await trackUsage(totalCharsProcessed, voiceUsedForThisRun);
      console.log(`Processed ${totalCharsProcessed} characters.`);
    }

    sendEvent('progress', { percent: 100, message: 'Finalizing...' });

    // Generate Feed and Landing Page from Cache
    // We modify generateFeedResponse to return data instead of sending it
    const responseData = await generateFeedResponseData(processedArticles, newEpisode, updatedStats);
    sendEvent('complete', responseData);
    res.end();
    
  } catch (error) {
    console.error('Application error:', error);
    sendEvent('error', { message: `Internal Error: ${error.message}` });
    res.end();
  }
}

/**
 * Generate feed data
 */
async function generateFeedResponseData(processedArticles, newEpisode, usageStats) {
  const allEpisodes = [];
  
  // Convert processedArticles object to array of episodes
  for (const [link, info] of Object.entries(processedArticles)) {
    allEpisodes.push({
      title: info.title,
      link: link,
      pubDate: info.processedDate || new Date().toISOString(),
      description: info.description || info.title || "No description available",
      content: info.title || "No content available",
      audioPath: info.audioPath
    });
  }
  
  if (allEpisodes.length === 0) {
     const landingPageUrl = config.cloud.useCloudStorage
        ? await createLandingPage([], usageStats)
        : null;

    return {
        message: 'No episodes available. Please add an article.',
        landingPage: landingPageUrl
    };
  }
  
  // Generate feed with custom options
  const feedOptions = {
    feedTitle: config.podcast.title,
    feedDescription: config.podcast.description,
    feedSiteUrl: config.podcast.siteUrl,
    author: { name: config.podcast.author },
    outputFileName: 'feed.xml',
    sortOrder: 'desc' // newest first
  };
  
  const feedPath = await generatePodcastFeed(allEpisodes, feedOptions);
  const feedUrl = config.cloud.useCloudStorage
    ? `https://storage.googleapis.com/${config.cloud.bucketName}/feed.xml`
    : feedPath;
  
  // Create landing page if using cloud storage
  let landingPageUrl = null;
  if (config.cloud.useCloudStorage) {
    landingPageUrl = await createLandingPage(allEpisodes, usageStats);
  }
  
  const message = newEpisode
    ? `Successfully processed article: "${newEpisode.title}"`
    : `Podcast feed regenerated with ${allEpisodes.length} episodes`;
  
  return {
    message,
    feedUrl,
    subscribeUrl: feedUrl,
    landingPage: landingPageUrl || `https://storage.googleapis.com/${config.cloud.bucketName}/index.html`,
    usage: usageStats,
    newEpisode: newEpisode
  };
}

// Old generateFeedResponse removed/replaced