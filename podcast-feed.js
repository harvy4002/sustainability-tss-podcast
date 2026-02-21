import { Feed } from 'feed';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { formatDate, getFileSize, estimateAudioDuration } from './utils.js';
import { saveToCloudStorage } from './cloud-storage.js';

// Default podcast feed options that can be overridden by the caller
const DEFAULT_FEED_OPTIONS = {
  feedTitle: 'RSS Feed', feedDescription: 'Generated feed of content',
  feedSiteUrl: 'https://example.com', feedLanguage: 'en',
  feedImageUrl: '', faviconUrl: '', generator: 'Content Syndication Generator',
  author: { name: 'Feed Generator', email: '', link: '' },
  copyright: `Copyright ${new Date().getFullYear()}`,
  categories: ['Technology'], itunesCategory: 'Technology', itunesExplicit: 'false',
  outputFileName: 'feed.xml', contentType: 'audio/mpeg',
  sortOrder: 'desc' // 'asc' for oldest first, 'desc' for newest first
};

/**
 * Generates a podcast RSS feed from processed content items
 * @param {Array} items - Array of content items to include in feed
 * @param {Object} customOptions - Optional configuration to override defaults
 * @returns {Promise<string>} Path to the generated feed file
 */
export async function generatePodcastFeed(items, customOptions = {}) {
  // Merge default options with custom options
  const options = { ...DEFAULT_FEED_OPTIONS, ...customOptions };
  
  // Handle cloud storage paths
  const feedLink = config.cloud.useCloudStorage 
    ? `https://storage.googleapis.com/${config.cloud.bucketName}/${options.outputFileName}`
    : `${options.feedSiteUrl}/${options.outputFileName}`;
  
  // Create feed with metadata
  const feed = new Feed({
    title: options.feedTitle || config.podcast.title,
    description: options.feedDescription || config.podcast.description,
    id: options.feedSiteUrl || config.podcast.siteUrl,
    link: options.feedSiteUrl || config.podcast.siteUrl,
    language: options.feedLanguage || config.podcast.language,
    image: options.feedImageUrl || config.podcast.imageUrl,
    favicon: options.faviconUrl || `${options.feedSiteUrl}/favicon.ico`,
    copyright: options.copyright,
    updated: new Date(),
    generator: options.generator,
    feedLinks: { rss: feedLink },
    author: {
      name: options.author.name || config.podcast.author,
      email: options.author.email,
      link: options.author.link || options.feedSiteUrl
    },
    // Add iTunes specific tags for podcast feeds
    custom: {
      'itunes:author': options.author.name || config.podcast.author,
      'itunes:explicit': options.itunesExplicit,
      'itunes:summary': options.feedDescription || config.podcast.description,
      'itunes:owner': [
        { 'itunes:name': options.author.name || config.podcast.author },
        { 'itunes:email': options.author.email || '' }
      ],
      'itunes:image': { _attr: { href: options.feedImageUrl || config.podcast.imageUrl } },
      'itunes:category': (options.categories || config.podcast.categories).map(category => ({
        _attr: { text: category }
      }))
    }
  });

  // Add each item to the feed
  console.log(`Processing ${items.length} items for the feed`);
  
  // Sort items by date
  const sortedItems = [...items].sort((a, b) => {
    const dateA = new Date(a.pubDate || a.date || new Date());
    const dateB = new Date(b.pubDate || b.date || new Date());
    return options.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
  });
  
  console.log(`Sorted items by date, ${options.sortOrder === 'desc' ? 'newest' : 'oldest'} first`);
  
  // Add normalized items to the feed
  sortedItems.forEach(item => feed.addItem(normalizeItemData(item, options)));

  // Generate the RSS feed XML and check if all items are included
  const baseRssOutput = feed.rss2({ indent: true });
  console.log(`Feed has ${feed.items.length} items to include in the XML`);
  
  // Check if all items are included or we need custom XML generation
  let rssOutput = baseRssOutput;
  const itemCount = baseRssOutput.match(/<item>/g)?.length || 0;
  
  if (itemCount !== feed.items.length) {
    console.log(`WARNING: Feed library only included ${itemCount} items instead of ${feed.items.length}!`);
    console.log('Using custom XML generation to include all items...');
    
    // Extract the channel part and manually add all items
    const itemStart = baseRssOutput.indexOf('<item>');
    
    // Build a complete XML with all items
    rssOutput = baseRssOutput.substring(0, itemStart);
    
    // Add all items manually
    sortedItems.forEach(item => {
      rssOutput += generateItemXml(normalizeItemData(item, options), options);
    });
    
    // Add the closing tags
    rssOutput += '\n    </channel>\n</rss>';
    console.log(`Custom RSS feed generation completed with ${sortedItems.length} items.`);
  } else {
    console.log('Feed library included all items correctly.');
  }
  
  // Save to storage or local file
  if (config.cloud.useCloudStorage) {
    const publicUrl = await saveToCloudStorage(
      options.outputFileName, rssOutput, '', 'application/rss+xml'
    );
    console.log(`Feed saved to cloud storage: ${publicUrl}`);
    return `https://storage.googleapis.com/${config.cloud.bucketName}/${options.outputFileName}`;
  } else {
    const outputPath = path.join(path.dirname(config.output.feedPath), options.outputFileName);
    await fs.writeFile(outputPath, rssOutput);
    console.log(`Feed generated at: ${outputPath}`);
    return outputPath;
  }
}

/**
 * Normalize item data to a standard format for feed generation
 * @param {Object} item - Source item with data
 * @param {Object} options - Feed options
 * @returns {Object} Normalized item ready for feed
 */
function normalizeItemData(item, options) {
  // Extract common fields with fallbacks
  const title = item.title || 'Untitled';
  const link = item.link || item.url || '';
  const description = item.description || item.summary || item.contentSnippet || title;
  const content = item.content || item.fullContent || description;
  const pubDate = item.pubDate || item.date || item.isoDate || new Date().toISOString();
  
  // Handle media files and duration
  let fileUrl, fileSize, duration;
  if (content) duration = item.duration || estimateAudioDuration(content);
  
  // Handle different media path structures
  if (item.audioPath || item.mediaPath || item.enclosure?.url) {
    fileUrl = item.audioPath || item.mediaPath || item.enclosure?.url;
    fileSize = item.enclosure?.size || (content && !item.fileSize ? Math.round(content.length * 1.5) : item.fileSize || 0);
  }
  
  // Create the normalized item
  const normalizedItem = {
    title, id: item.id || link, link, description, content,
    author: item.author ? (Array.isArray(item.author) ? item.author : [item.author]) : 
            [{ name: options.author.name, link: options.author.link }],
    contributor: item.contributor || [],
    date: new Date(pubDate)
  };
  
  // Add enclosure if media is available
  if (fileUrl) {
    const enclosureUrl = config.cloud.useCloudStorage ? fileUrl : 
                        `${options.feedSiteUrl}/audio/${path.basename(fileUrl)}`;
    normalizedItem.enclosure = {
      url: enclosureUrl,
      size: fileSize,
      type: item.enclosure?.type || options.contentType
    };
  }
  
  // Add iTunes specific tags for podcasts
  normalizedItem.custom = {
    'itunes:author': options.author.name,
    'itunes:summary': description,
    'itunes:explicit': options.itunesExplicit,
    ...(duration && { 'itunes:duration': formatDuration(duration) })
  };
  
  return normalizedItem;
}

/**
 * Generate XML for a single item to be included in the feed
 * @param {Object} item - The normalized item data
 * @param {Object} options - Feed options
 * @returns {string} XML string for the item
 */
function generateItemXml(item, options) {
  const pubDate = new Date(item.date).toUTCString();
  let xml = `
        <item>
            <title><![CDATA[${item.title}]]></title>
            <link>${item.link}</link>
            <guid isPermaLink="false">${item.id || item.link}</guid>
            <pubDate>${pubDate}</pubDate>
            <description><![CDATA[${item.description}]]></description>`;
  
  // Add enclosure if present
  if (item.enclosure) {
    xml += `
            <enclosure url="${item.enclosure.url}" length="${item.enclosure.size}" type="${item.enclosure.type}"/>`;
  }
  
  // Add iTunes tags for podcasts
  if (item.custom) {
    for (const [key, value] of Object.entries(item.custom)) {
      if (value && typeof value === 'string') {
        xml += key === 'itunes:summary' 
          ? `\n            <${key}><![CDATA[${value}]]></${key}>`
          : `\n            <${key}>${value}</${key}>`;
      }
    }
  }
  
  xml += '\n        </item>';
  return xml;
}

/**
 * Formats duration in HH:MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    : `${minutes}:${secs.toString().padStart(2, '0')}`;
}
