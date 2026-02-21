/**
 * Retention policy functions for managing podcast episodes
 */
import { loadJsonFile, saveJsonFile } from './utils.js';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { deleteFromCloudStorage } from './cloud-storage.js';

/**
 * Apply retention policy to the processed articles cache
 * @param {Object} options - Retention policy options
 * @param {number} options.maxEpisodes - Maximum number of episodes to keep (0 = unlimited)
 * @param {number} options.maxAgeDays - Maximum age in days to keep episodes (0 = unlimited)
 * @param {boolean} options.deleteAudio - Whether to delete audio files as well
 * @param {boolean} options.dryRun - If true, only report what would be deleted without actually deleting
 * @returns {Promise<Object>} Stats about the cleanup operation
 */
export async function applyRetentionPolicy(options = {}) {
  const defaults = {
    maxEpisodes: 0,  // 0 means no limit
    maxAgeDays: 0,   // 0 means no limit
    deleteAudio: true,
    dryRun: false
  };
  
  const settings = { ...defaults, ...options };
  
  // Load processed articles
  const processedArticles = await loadJsonFile(config.content.cacheFile, {});
  
  // Convert to array for easier processing
  const articles = Object.entries(processedArticles).map(([link, info]) => {
    return {
      link,
      ...info,
      processedDate: new Date(info.processedDate || new Date())
    };
  });
  
  // Sort by date, newest first
  articles.sort((a, b) => b.processedDate - a.processedDate);
  
  // Determine which articles to keep
  const now = new Date();
  const toKeep = articles.filter((article, index) => {
    // Keep if within episode limit
    if (settings.maxEpisodes > 0 && index >= settings.maxEpisodes) {
      return false;
    }
    
    // Keep if within age limit
    if (settings.maxAgeDays > 0) {
      const ageInDays = (now - article.processedDate) / (1000 * 60 * 60 * 24);
      if (ageInDays > settings.maxAgeDays) {
        return false;
      }
    }
    
    // Keep by default if no constraints apply
    return true;
  });
  
  // Identify articles to remove
  const toRemove = articles.filter(article => !toKeep.some(keep => keep.link === article.link));
  
  // Stats for reporting
  const stats = {
    totalBefore: articles.length,
    totalAfter: toKeep.length,
    removed: toRemove.length,
    audioFilesRemoved: 0,
    dryRun: settings.dryRun
  };
  
  console.log(`Retention policy: Found ${toRemove.length} articles to remove out of ${articles.length} total`);
  
  // Process removals unless this is a dry run
  if (!settings.dryRun && toRemove.length > 0) {
    // Create new processed articles object with only the items to keep
    const newProcessedArticles = {};
    toKeep.forEach(article => {
      newProcessedArticles[article.link] = {
        title: article.title,
        processedDate: article.processedDate.toISOString(),
        audioPath: article.audioPath
      };
    });
    
    // Delete audio files if requested
    if (settings.deleteAudio) {
      for (const article of toRemove) {
        if (article.audioPath) {
          try {
            if (config.cloud.useCloudStorage) {
              // Extract filename from path for cloud storage
              const filename = path.basename(article.audioPath);
              await deleteFromCloudStorage(filename);
              console.log(`Deleted cloud audio file: ${filename}`);
            } else {
              // Handle local file deletion
              const localPath = article.audioPath.startsWith('/') 
                ? article.audioPath 
                : path.join(config.output.audioDir, path.basename(article.audioPath));
              await fs.unlink(localPath);
              console.log(`Deleted local audio file: ${localPath}`);
            }
            stats.audioFilesRemoved++;
          } catch (error) {
            console.error(`Failed to delete audio file for "${article.title}": ${error.message}`);
          }
        }
      }
    }
    
    // Save the updated processed articles
    await saveJsonFile(config.content.cacheFile, newProcessedArticles);
    console.log(`Updated processed articles cache. Removed ${toRemove.length} articles.`);
  } else if (settings.dryRun) {
    console.log('Dry run: No articles were actually removed');
    toRemove.forEach(article => {
      console.log(`Would remove: ${article.title} (${article.processedDate.toISOString()})`);
    });
  }
  
  return stats;
}

/**
 * Remove specific articles by URL
 * @param {Array<string>} urls - Array of article URLs to remove
 * @param {Object} options - Options
 * @param {boolean} options.deleteAudio - Whether to delete audio files as well
 * @param {boolean} options.dryRun - If true, only report what would be deleted without actually deleting
 * @returns {Promise<Object>} Stats about the cleanup operation
 */
export async function removeSpecificArticles(urls, options = {}) {
  const settings = {
    deleteAudio: true,
    dryRun: false,
    ...options
  };
  
  // Load processed articles
  const processedArticles = await loadJsonFile(config.content.cacheFile, {});
  
  // Track stats
  const stats = {
    requested: urls.length,
    found: 0,
    removed: 0,
    audioFilesRemoved: 0,
    notFound: [],
    dryRun: settings.dryRun
  };
  
  // Check each URL
  for (const url of urls) {
    if (processedArticles[url]) {
      stats.found++;
      
      if (!settings.dryRun) {
        if (settings.deleteAudio && processedArticles[url].audioPath) {
          try {
            if (config.cloud.useCloudStorage) {
              // Extract filename from path for cloud storage
              const filename = path.basename(processedArticles[url].audioPath);
              await deleteFromCloudStorage(filename);
              console.log(`Deleted cloud audio file: ${filename}`);
            } else {
              // Handle local file deletion
              const localPath = processedArticles[url].audioPath.startsWith('/') 
                ? processedArticles[url].audioPath 
                : path.join(config.output.audioDir, path.basename(processedArticles[url].audioPath));
              await fs.unlink(localPath);
              console.log(`Deleted local audio file: ${localPath}`);
            }
            stats.audioFilesRemoved++;
          } catch (error) {
            console.error(`Failed to delete audio file for "${processedArticles[url].title}": ${error.message}`);
          }
        }
        
        // Remove from processed articles
        delete processedArticles[url];
        stats.removed++;
      }
    } else {
      stats.notFound.push(url);
    }
  }
  
  // Save updated processed articles if not a dry run
  if (!settings.dryRun && stats.removed > 0) {
    await saveJsonFile(config.content.cacheFile, processedArticles);
    console.log(`Updated processed articles cache. Removed ${stats.removed} articles.`);
  } else if (settings.dryRun) {
    console.log('Dry run: No articles were actually removed');
  }
  
  return stats;
}
