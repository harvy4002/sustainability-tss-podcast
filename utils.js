import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sanitize from 'sanitize-filename';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { 
  loadFromCloudStorage, 
  saveToCloudStorage 
} from './cloud-storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dirPath - Path to the directory
 */
export async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    // Directory doesn't exist, create it
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Creates a safe filename from a title
 * @param {string} title - The title to convert to a filename
 * @returns {string} A safe filename
 */
export function createSafeFilename(title) {
  const safeTitle = sanitize(title).replace(/\s+/g, '-').toLowerCase();
  return `${safeTitle}-${uuidv4().slice(0, 8)}`;
}

/**
 * Loads a JSON file
 * @param {string} filePath - Path to the JSON file
 * @param {any} defaultValue - Default value if file doesn't exist
 * @returns {Promise<any>} The parsed JSON data
 */
export async function loadJsonFile(filePath, defaultValue = {}) {
  // Use Cloud Storage if configured
  if (config.cloud.useCloudStorage) {
    const cloudPath = path.basename(filePath);
    return loadFromCloudStorage(cloudPath, defaultValue);
  }
  
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is invalid
    return defaultValue;
  }
}

/**
 * Saves data to a JSON file
 * @param {string} filePath - Path to save the JSON file
 * @param {any} data - Data to save
 */
export async function saveJsonFile(filePath, data) {
  const jsonString = JSON.stringify(data, null, 2);
  
  // Use Cloud Storage if configured
  if (config.cloud.useCloudStorage) {
    const fileName = path.basename(filePath);
    await saveToCloudStorage(fileName, jsonString, '', 'application/json');
    return;
  }
  
  await fs.writeFile(filePath, jsonString, 'utf8');
}

/**
 * Formats a date for RSS feed
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
  return date.toUTCString();
}

/**
 * Calculates the file size in bytes
 * @param {string} filePath - Path to the file
 * @returns {Promise<number>} File size in bytes
 */
export async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Calculates the audio duration in seconds based on text length
 * This is a rough estimation - actual TTS duration varies
 * @param {string} text - The text content
 * @returns {number} Estimated duration in seconds
 */
export function estimateAudioDuration(text) {
  // Average reading speed is about 150 words per minute
  // We'll use a rough estimation of 3 words per second
  const wordCount = text.split(/\s+/).length;
  return Math.round(wordCount / 3);
}
