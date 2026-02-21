import { generatePodcast } from './function.js';
import { config } from './config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create mock request and response objects
const mockRequest = {
  query: {
    rssUrl: process.env.RSS_FEED_URL
  }
};

const mockResponse = {
  status: (code) => {
    console.log(`Response status: ${code}`);
    return mockResponse;
  },
  send: (data) => {
    console.log('Response data:', data);
    return mockResponse;
  }
};

console.log('Starting local test with RSS feed:', mockRequest.query.rssUrl);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Using cloud storage:', config.cloud.useCloudStorage);

// Run the function
(async () => {
  try {
    await generatePodcast(mockRequest, mockResponse);
    console.log('Test completed');
  } catch (error) {
    console.error('Test failed:', error);
  }
})();
