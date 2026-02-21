import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

// Create Storage client
const storage = new Storage();

/**
 * Checks if a file exists in Google Cloud Storage
 * @param {string} fileName - Name of the file
 * @param {string} destination - Destination path in the bucket
 * @returns {Promise<boolean>} True if the file exists, false otherwise
 */
export async function fileExistsInCloudStorage(fileName, destination) {
  try {
    const bucketName = config.cloud.bucketName;
    const bucket = storage.bucket(bucketName);
    const destinationPath = destination ? `${destination}/${fileName}` : fileName;
    const file = bucket.file(destinationPath);
    
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('Error checking if file exists in Cloud Storage:', error);
    return false;
  }
}

/**
 * Uploads a file to Google Cloud Storage
 * @param {string} filePath - Local path to the file
 * @param {string} destination - Destination path in the bucket
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export async function uploadToCloudStorage(filePath, destination) {
  try {
    const bucketName = config.cloud.bucketName;
    const bucket = storage.bucket(bucketName);
    const fileName = path.basename(filePath);
    
    // Upload the file
    console.log(`Uploading ${filePath} to gs://${bucketName}/${destination}/${fileName}`);
    await bucket.upload(filePath, {
      destination: `${destination}/${fileName}`,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      }
      // Skip setting per-object ACLs since bucket has uniform access
    });
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destination}/${fileName}`;
    console.log(`File uploaded to: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Cloud Storage:', error);
    
    // If we get uniform access error, log a clearer message
    if (error.message && error.message.includes('uniform bucket-level access')) {
      console.log('Your bucket has uniform access control enabled. Individual object ACLs are not supported.');
      console.log('The file was uploaded but makePublic() failed. If your bucket has public access, the file should still be accessible.');
      
      // Return the URL anyway since the file was uploaded
      const fileName = path.basename(filePath);
      const publicUrl = `https://storage.googleapis.com/${config.cloud.bucketName}/${destination}/${fileName}`;
      return publicUrl;
    }
    
    throw error;
  }
}

/**
 * Saves a file to Google Cloud Storage
 * @param {string} fileName - Name of the file
 * @param {Buffer|string} content - Content to save
 * @param {string} destination - Destination path in the bucket
 * @param {string} contentType - MIME type of the content
 * @returns {Promise<string>} Public URL of the saved file
 */
export async function saveToCloudStorage(fileName, content, destination, contentType) {
  try {
    const bucketName = config.cloud.bucketName;
    console.log(`Cloud Storage config: Bucket name = ${bucketName}`);
    console.log(`Cloud project: ${config.cloud.projectId}`);
    
    const bucket = storage.bucket(bucketName);
    const destinationPath = destination ? `${destination}/${fileName}` : fileName;
    const file = bucket.file(destinationPath);
    
    console.log(`Saving ${fileName} to gs://${bucketName}/${destinationPath}`);
    
    // Upload the content without predefinedAcl since we're using uniform bucket-level access
    await file.save(content, {
      contentType: contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
      }
      // No predefinedAcl - rely on bucket-level permissions instead
    });
    
    // Get the public URL without trying to make the file public individually
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
    console.log(`File saved to: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Error saving to Cloud Storage:', error);
    
    // If we get uniform access error, provide a clearer message
    if (error.message && error.message.includes('uniform bucket-level access')) {
      console.log('Your bucket has uniform access control enabled. Individual object ACLs are not supported.');
      console.log('The file was saved but makePublic() failed. If your bucket has public access, the file should still be accessible.');
      
      // Return the URL anyway since the file was uploaded
      const publicUrl = `https://storage.googleapis.com/${config.cloud.bucketName}/${destination ? `${destination}/` : ''}${fileName}`;
      return publicUrl;
    }
    
    throw error;
  }
}

/**
 * Loads a JSON file from Google Cloud Storage
 * @param {string} filePath - Path to the file in the bucket
 * @param {any} defaultValue - Default value if file doesn't exist
 * @returns {Promise<any>} The parsed JSON data
 */
export async function loadFromCloudStorage(filePath, defaultValue = {}) {
  try {
    const bucketName = config.cloud.bucketName;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`File ${filePath} doesn't exist in cloud storage, using default value`);
      return defaultValue;
    }
    
    const [content] = await file.download();
    return JSON.parse(content.toString());
  } catch (error) {
    console.error(`Error loading from Cloud Storage (${filePath}):`, error);
    return defaultValue;
  }
}

/**
 * Deletes a file from Google Cloud Storage
 * @param {string} fileName - Name of the file to delete
 * @param {string} destination - Optional destination path in the bucket
 * @returns {Promise<boolean>} True if deletion was successful
 */
export async function deleteFromCloudStorage(fileName, destination) {
  try {
    const bucketName = config.cloud.bucketName;
    const bucket = storage.bucket(bucketName);
    const destinationPath = destination ? `${destination}/${fileName}` : fileName;
    const file = bucket.file(destinationPath);
    
    console.log(`Deleting file gs://${bucketName}/${destinationPath}`);
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`File ${destinationPath} doesn't exist in cloud storage`);
      return false;
    }
    
    // Delete the file
    await file.delete();
    console.log(`Successfully deleted gs://${bucketName}/${destinationPath}`);
    return true;
  } catch (error) {
    console.error(`Error deleting from Cloud Storage (${fileName}):`, error);
    return false;
  }
}
