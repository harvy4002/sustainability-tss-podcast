import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { convert } from 'html-to-text'; // Fallback
import { config } from './config.js';

// HTML-to-text conversion options (Fallback)
const htmlConversionOptions = {
  wordwrap: false,
  selectors: [
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'img', format: 'skip' },
    { selector: 'script', format: 'skip' },
    { selector: 'style', format: 'skip' }
  ]
};

/**
 * Extracts the content from an article URL using Mozilla Readability
 * @param {string} url - The article URL
 * @returns {Promise<Object>} The extracted article data (title, content, etc.)
 */
export async function extractArticleContent(url) {
  try {
    console.log(`Fetching article content from: ${url}`);
    const response = await axios.get(url, {
      headers: { 
        'User-Agent': config.content.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
      },
      timeout: 15000 // 15 second timeout
    });
    
    let text = '';
    let title = '';
    let description = '';

    try {
      // Use JSDOM and Readability for high-quality extraction
      const dom = new JSDOM(response.data, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article) {
        text = article.textContent;
        title = article.title;
        description = article.excerpt || '';
      } else {
        console.warn(`Readability failed to parse ${url}, falling back to html-to-text`);
        text = convert(response.data, htmlConversionOptions);
        // Try to extract title from title tag if Readability failed
        const titleMatch = response.data.match(/<title>(.*?)<\/title>/);
        title = titleMatch ? titleMatch[1] : 'Untitled Article';
      }
    } catch (parseError) {
      console.error(`Error parsing with Readability: ${parseError.message}, falling back to html-to-text`);
      text = convert(response.data, htmlConversionOptions);
       // Try to extract title from title tag if Readability failed
       const titleMatch = response.data.match(/<title>(.*?)<\/title>/);
       title = titleMatch ? titleMatch[1] : 'Untitled Article';
    }
    
    // Feature 1: Collapse long dash sequences (don't truncate the whole text)
    // If there are 4 or more consecutive dashes, replace them with a space
    text = text.replace(/-{4,}/g, ' ');

    // Clean up whitespace
    text = text.trim().replace(/\n{3,}/g, '\n\n');

    // Feature 2: Strict Length Limit (Cost Safety)
    if (text.length > config.content.maxTextLength) {
      console.warn(`Article content (${text.length} chars) exceeds limit of ${config.content.maxTextLength}. Truncating.`);
      text = text.substring(0, config.content.maxTextLength) + 
        '. [Article truncated to save audio generation costs]';
    }
    
    return {
      title,
      content: text,
      description,
      link: url
    };
  } catch (error) {
    console.error(`Error extracting article content from ${url}:`, error.message);
    throw error;
  }
}

/**
 * Processes a single article URL
 * @param {string} url - The article URL
 * @returns {Promise<Object>} Processed item with full content
 */
export async function processArticle(url) {
  try {
    const articleData = await extractArticleContent(url);
    
    return {
      title: articleData.title,
      link: articleData.link,
      description: articleData.description,
      content: articleData.content, // Original content
      fullContent: articleData.content, // For compatibility
      pubDate: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error processing article "${url}":`, error.message);
    throw error;
  }
}