#!/usr/bin/env node
/**
 * CLI tool for managing podcast articles
 * 
 * Usage:
 *   node cleanup-podcast.js [options]
 * 
 * Options:
 *   --max-episodes N  Keep only N most recent episodes
 *   --max-age N       Delete episodes older than N days
 *   --delete-url URL  Delete a specific article by URL
 *   --dry-run         Show what would be deleted without making changes
 *   --no-audio        Don't delete audio files, just remove from feed
 *   --list            List all articles in the feed
 *   --help            Show this help
 */

import { applyRetentionPolicy, removeSpecificArticles } from './retention-policy.js';
import { loadJsonFile } from './utils.js';
import { config } from './config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  maxEpisodes: 0,
  maxAgeDays: 0,
  deleteUrls: [],
  deleteAudio: true,
  dryRun: false,
  list: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--max-episodes' && i + 1 < args.length) {
    options.maxEpisodes = parseInt(args[++i], 10);
  } else if (arg === '--max-age' && i + 1 < args.length) {
    options.maxAgeDays = parseInt(args[++i], 10);
  } else if (arg === '--delete-url' && i + 1 < args.length) {
    options.deleteUrls.push(args[++i]);
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--no-audio') {
    options.deleteAudio = false;
  } else if (arg === '--list') {
    options.list = true;
  } else if (arg === '--help') {
    options.help = true;
  }
}

// Show help
if (options.help || args.length === 0) {
  console.log(`
Podcast Article Manager

Usage:
  node cleanup-podcast.js [options]

Options:
  --max-episodes N  Keep only N most recent episodes
  --max-age N       Delete episodes older than N days
  --delete-url URL  Delete a specific article by URL
  --dry-run         Show what would be deleted without making changes
  --no-audio        Don't delete audio files, just remove from feed
  --list            List all articles in the feed
  --help            Show this help

Examples:
  # List all articles
  node cleanup-podcast.js --list
  
  # Keep only 50 most recent episodes
  node cleanup-podcast.js --max-episodes 50
  
  # Delete episodes older than 90 days
  node cleanup-podcast.js --max-age 90
  
  # Delete a specific article
  node cleanup-podcast.js --delete-url https://example.com/article
  
  # Dry run to see what would be deleted
  node cleanup-podcast.js --max-episodes 50 --dry-run
  `);
  process.exit(0);
}

// Main function
async function main() {
  try {
    // List all articles
    if (options.list) {
      const processedArticles = await loadJsonFile(config.content.cacheFile, {});
      const articles = Object.entries(processedArticles).map(([link, info]) => {
        return {
          link,
          title: info.title,
          processedDate: new Date(info.processedDate || new Date()),
          audioPath: info.audioPath
        };
      });
      
      // Sort by date, newest first
      articles.sort((a, b) => b.processedDate - a.processedDate);
      
      console.log(`\nFound ${articles.length} articles in podcast feed:\n`);
      articles.forEach((article, index) => {
        const date = article.processedDate.toISOString().substring(0, 10);
        console.log(`${index + 1}. [${date}] ${article.title}`);
        console.log(`   ${article.link}`);
        console.log(`   Audio: ${article.audioPath}`);
        console.log('');
      });
      
      return;
    }
    
    // Delete specific URLs
    if (options.deleteUrls.length > 0) {
      console.log(`Removing ${options.deleteUrls.length} specific articles...`);
      const result = await removeSpecificArticles(options.deleteUrls, {
        deleteAudio: options.deleteAudio,
        dryRun: options.dryRun
      });
      
      console.log('\nRemoval Results:');
      console.log(`- Requested URLs: ${result.requested}`);
      console.log(`- Found: ${result.found}`);
      console.log(`- Removed: ${result.removed}`);
      console.log(`- Audio files removed: ${result.audioFilesRemoved}`);
      
      if (result.notFound.length > 0) {
        console.log('\nURLs not found:');
        result.notFound.forEach(url => console.log(`- ${url}`));
      }
      
      return;
    }
    
    // Apply retention policy
    if (options.maxEpisodes > 0 || options.maxAgeDays > 0) {
      console.log('Applying retention policy...');
      
      if (options.maxEpisodes > 0) {
        console.log(`- Keep only ${options.maxEpisodes} most recent episodes`);
      }
      
      if (options.maxAgeDays > 0) {
        console.log(`- Remove episodes older than ${options.maxAgeDays} days`);
      }
      
      const result = await applyRetentionPolicy({
        maxEpisodes: options.maxEpisodes,
        maxAgeDays: options.maxAgeDays,
        deleteAudio: options.deleteAudio,
        dryRun: options.dryRun
      });
      
      console.log('\nRetention Policy Results:');
      console.log(`- Total articles before: ${result.totalBefore}`);
      console.log(`- Total articles after: ${result.totalAfter}`);
      console.log(`- Articles removed: ${result.removed}`);
      console.log(`- Audio files removed: ${result.audioFilesRemoved}`);
      
      if (result.dryRun) {
        console.log('\nThis was a dry run - no changes were made.');
      }
      
      return;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
