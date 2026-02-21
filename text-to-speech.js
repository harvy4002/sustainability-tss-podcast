import textToSpeech from '@google-cloud/text-to-speech';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { ensureDirectoryExists, createSafeFilename } from './utils.js';
import { saveToCloudStorage, fileExistsInCloudStorage } from './cloud-storage.js';

// Create Google Cloud TTS client
const client = new textToSpeech.TextToSpeechClient();

/**
 * Converts text to speech and saves as an audio file
 * @param {string} text - The text to convert to speech
 * @param {string} title - Title for the filename
 * @param {Object} voiceConfig - The Google Cloud TTS voice configuration to use
 * @param {Function} [onProgress] - Callback for progress updates (percentage, message)
 * @returns {Promise<string>} Path to the generated audio file
 */
export async function textToAudio(text, title, voiceConfig, onProgress) {
  if (!text || text.trim() === '') throw new Error('Empty text content');
  
  // Create a safe filename and setup paths
  const filename = createSafeFilename(title) + '.mp3';
  console.log(`Processing text-to-speech for "${title}" (${text.length} characters) using voice config:`, voiceConfig);
  console.log(`Using cloud storage: ${config.cloud.useCloudStorage}`);
  
  if (onProgress) onProgress(5, 'Checking existing files...');
  
  try {
    // Check if file already exists
    if (config.cloud.useCloudStorage) {
      const fileExists = await fileExistsInCloudStorage(filename, 'audio');
      if (fileExists) {
        console.log(`Audio file ${filename} already exists in cloud storage. Skipping TTS conversion.`);
        if (onProgress) onProgress(100, 'Audio already exists');
        return `https://storage.googleapis.com/${config.cloud.bucketName}/audio/${filename}`;
      }
    } else {
      await ensureDirectoryExists(config.output.audioDir);
      const localFilePath = path.join(config.output.audioDir, filename);
      try {
        await fs.access(localFilePath);
        console.log(`Audio file ${filename} already exists locally. Skipping TTS conversion.`);
        if (onProgress) onProgress(100, 'Audio already exists');
        return localFilePath;
      } catch (err) { /* File doesn't exist, continue */ }
    }
    
    if (onProgress) onProgress(10, 'Splitting text...');
    
    // Split text into chunks if needed (GCP TTS has a limit)
    // Reducing chunk size to 1000 to avoid "sentence too long" errors from API
    const textChunks = splitTextIntoChunks(text, 1000); 
    
    // Process text chunks and combine audio
    const audioChunks = [];
    for (let i = 0; i < textChunks.length; i++) {
      const progress = 10 + Math.round(((i) / textChunks.length) * 80); // 10% to 90%
      if (onProgress) onProgress(progress, `Synthesizing audio chunk ${i + 1}/${textChunks.length}`);
      
      if (textChunks.length > 1) console.log(`Processing chunk ${i + 1}/${textChunks.length}`);
      const audioContent = await synthesizeSpeech(textChunks[i], voiceConfig);
      audioChunks.push(Buffer.from(audioContent));
    }
    
    if (onProgress) onProgress(90, 'Combining and saving audio...');
    
    // Combine all audio chunks
    const audioContent = textChunks.length === 1 ? audioChunks[0] : Buffer.concat(audioChunks);
    
    // Save audio file to storage
    if (config.cloud.useCloudStorage) {
      const publicUrl = await saveToCloudStorage(filename, audioContent, 'audio', 'audio/mpeg');
      console.log(`Audio saved to cloud storage: ${publicUrl}`);
      if (onProgress) onProgress(100, 'Complete');
      return publicUrl;
    } else {
      const outputPath = path.join(config.output.audioDir, filename);
      await fs.writeFile(outputPath, audioContent);
      console.log(`Audio saved to: ${outputPath}`);
      if (onProgress) onProgress(100, 'Complete');
      return outputPath;
    }
  } catch (error) {
    console.error('Error in text-to-speech conversion:', error);
    throw error;
  }
}

/**
 * Calls the Google Cloud TTS API
 * @param {string} text - Text to synthesize
 * @param {Object} voiceConfig - The Google Cloud TTS voice configuration to use
 * @returns {Promise<Buffer>} Audio content as buffer
 */
async function synthesizeSpeech(text, voiceConfig) {
  try {
    // Check byte length (approximation for UTF-8)
    const byteLength = new TextEncoder().encode(text).length;
    
    // Truncate if text exceeds API limit
    if (byteLength > 5000) {
      console.warn(`Text byte length (${byteLength}) exceeds Google TTS limit of 5000 bytes. Truncating.`);
      let safeText = text;
      while (new TextEncoder().encode(safeText).length > 4800) {
        safeText = safeText.substring(0, safeText.length - 100);
      }
      console.log(`Truncated text from ${text.length} to ${safeText.length} characters`);
      text = safeText;
    }
    
    // Call the API
    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: voiceConfig,
      audioConfig: config.tts.audioConfig
    });
    
    return response.audioContent;
  } catch (error) {
    console.error(`Error in synthesizeSpeech: ${error.message}`);
    
    // If input size error, try with smaller chunk
    if (error.message.includes('longer than the limit of 5000 bytes')) {
      console.log('Attempting to recover by reducing text size...');
      return synthesizeSpeech(text.substring(0, Math.floor(text.length * 0.8)), voiceConfig);
    }
    
    throw error;
  }
}

/**
 * Splits text into smaller chunks at sentence boundaries
 * @param {string} text - Text to split
 * @param {number} chunkSize - Maximum size of each chunk in characters
 * @returns {Array<string>} Array of text chunks
 */
function splitTextIntoChunks(text, chunkSize) {
  if (text.length <= chunkSize) return [text];
  
  // Use 80% of chunkSize to be safe
  const safeChunkSize = Math.floor(chunkSize * 0.8);
  const chunks = [];
  let currentChunk = '';
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;

    // If paragraph fits, add it
    if ((currentChunk + paragraph).length < safeChunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      continue;
    }

    // Process current chunk if full
    if (currentChunk) {
      chunks.push(currentChunk);
      currentChunk = '';
    }

    // If paragraph is small enough for a new chunk, use it
    if (paragraph.length <= safeChunkSize) {
      currentChunk = paragraph;
      continue;
    }

    // Paragraph too big, split by sentences
    const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [paragraph];
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length < safeChunkSize) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        continue;
      }

      // Current chunk full
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      // If sentence fits new chunk
      if (sentence.length <= safeChunkSize) {
        currentChunk = sentence;
        continue;
      }

      // Sentence too big, hard split
      let remaining = sentence;
      while (remaining.length > 0) {
        if (remaining.length <= safeChunkSize) {
          currentChunk = remaining;
          break;
        }

        // Find split point (last space within limit)
        let splitIndex = remaining.lastIndexOf(' ', safeChunkSize);
        if (splitIndex === -1) splitIndex = safeChunkSize; // No space, hard cut

        let part = remaining.substring(0, splitIndex).trim();
        
        // Ensure it ends with punctuation if it's a forced split
        if (!/[.!?]$/.test(part)) {
          part += '.';
        }

        chunks.push(part);
        remaining = remaining.substring(splitIndex).trim();
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  
  console.log(`Split text into ${chunks.length} chunks (max size: ${safeChunkSize} chars)`);
  return chunks;
}
