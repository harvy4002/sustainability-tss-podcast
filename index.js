import { processArticle } from './article-parser.js';
import { textToAudio } from './text-to-speech.js';
import { generatePodcastFeed } from './podcast-feed.js';
import { createLandingPage } from './landing-page.js';
import { 
  ensureDirectoryExists, 
  loadJsonFile, 
  saveJsonFile 
} from './utils.js';
import { config } from './config.js';

/**
 * Main application function for local testing
 */
async function main() {
  try {
    console.log('Sustainability TSS Podcast Generator Starting...');
    
    // Get URL from command line args
    const articleUrl = process.argv[2];
    
    if (!articleUrl) {
      console.log('Usage: node index.js <article-url>');
      // If no URL provided, just regenerate feed from existing cache
      console.log('No URL provided. Regenerating feed from cache...');
    } else {
      console.log(`Processing article: ${articleUrl}`);
    }
    
    // Ensure output directory exists
    await ensureDirectoryExists(config.output.audioDir);
    
    // Load cache of already processed articles
    const processedArticles = await loadJsonFile(
      config.content.cacheFile, 
      {}
    );
    
    let newEpisode = null;

    if (articleUrl) {
      // check if already processed
      const altUrl = articleUrl.endsWith('/') ? articleUrl.slice(0, -1) : articleUrl + '/';
      if (processedArticles[articleUrl] || processedArticles[altUrl]) {
        console.log(`Article already processed: ${articleUrl}`);
      } else {
        try {
          // Process Article
          const article = await processArticle(articleUrl);
          console.log(`Title: ${article.title}`);
          
          // Convert to Audio
          console.log(`Converting to audio...`);
          const audioPath = await textToAudio(
            article.content, 
            article.title
          );
          
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
            description: article.description
          };
          
          // Save cache
          await saveJsonFile(config.content.cacheFile, processedArticles);
          console.log('Article processed successfully.');
          
        } catch (error) {
          console.error(`Error processing article "${articleUrl}":`, error.message);
        }
      }
    }
    
    // Generate Feed from Cache
    const allEpisodes = [];
    for (const [link, info] of Object.entries(processedArticles)) {
      allEpisodes.push({
        title: info.title,
        link: link,
        pubDate: info.processedDate || new Date().toISOString(),
        description: info.description || info.title,
        content: info.title || "No content available",
        audioPath: info.audioPath
      });
    }

    if (allEpisodes.length > 0) {
      await generatePodcastFeed(allEpisodes);
      console.log(`Successfully generated podcast with ${allEpisodes.length} total episodes`);
      
      // Generate landing page
      if (config.cloud.useCloudStorage) {
        await createLandingPage(allEpisodes);
        console.log('Successfully generated landing page');
      }
    } else {
      console.log('No episodes available to generate feed');
    }
    
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
}

// Run the application
main().then(() => {
  console.log('Processing completed');
}).catch(error => {
  console.error('Application failed:', error);
  process.exit(1);
});