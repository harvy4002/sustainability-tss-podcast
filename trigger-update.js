import axios from 'axios';
import { config } from './config.js';

async function triggerUpdate() {
  console.log('Triggering podcast feed and landing page regeneration...');
  const targetUrl = config.api.functionUrl;
  console.log(`Target: ${targetUrl}`);

  try {
    const response = await axios({
      method: 'post',
      url: targetUrl,
      responseType: 'stream'
    });

    response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const event = JSON.parse(line);
                if (event.type === 'progress') {
                   // Clean output for progress
                   process.stdout.write(`\rProgress: ${event.percent}% - ${event.message}`);
                } else if (event.type === 'status') {
                    console.log(`\n[STATUS] ${event.message}`);
                } else if (event.type === 'complete') {
                    console.log(`\n[COMPLETE] ${event.message}`);
                    if (event.landingPage) console.log(`Landing Page: ${event.landingPage}`);
                    if (event.feedUrl) console.log(`Feed URL: ${event.feedUrl}`);
                } else if (event.type === 'error') {
                    console.error(`\n[ERROR] ${event.message}`);
                }
            } catch (e) {
                // If not JSON, just print it
                console.log(line);
            }
        }
    });

    response.data.on('end', () => {
      console.log('\nUpdate sequence finished.');
    });

  } catch (error) {
    console.error('\nFailed to trigger update:', error.message);
    if (error.response) {
        console.error('Status:', error.response.status);
    }
    process.exit(1);
  }
}

triggerUpdate();
