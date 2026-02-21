# Sustainability TSS Podcast

This Node.js application converts web articles into a podcast feed using Google Cloud Text-to-Speech. It provides a simple landing page to submit article URLs, which are then processed into audio episodes.

## Access the Podcast

### 🔗 Submit Articles & View Episodes
**[Open Landing Page](https://storage.googleapis.com/sustainability-podcast-data/index.html)**
Use this page to add new articles to your podcast and listen to episodes.

### 🎙️ Podcast Feed URL
**[RSS Feed](https://storage.googleapis.com/sustainability-podcast-data/feed.xml)**
Add this URL to your podcast app (Apple Podcasts, Pocket Casts, etc.) to subscribe.

---

## Deployment Information

The application is deployed to Google Cloud Functions in the `europe-west2` (London) region on the `hippo-ideas` project.

- **Project:** `hippo-ideas`
- **Region:** `europe-west2`
- **Function Name:** `sustainability-tss-podcast`
- **Bucket:** `sustainability-podcast-data`
- **Service Account:** `971698071276-compute@developer.gserviceaccount.com` (Default Compute Engine)

## Features

- Fetches articles from any web URL
- Extracts and cleans article text using Mozilla Readability
- Converts text to speech using Google Cloud TTS Neural2 voice (Chirp 3 HD)
- Saves audio files locally or to Google Cloud Storage
- Generates a podcast RSS feed compatible with podcast apps
- Tracks monthly TTS usage and costs
- Deployed as a Google Cloud Function for cost efficiency

## Prerequisites (for development)

- Node.js (v18 or later)
- A Google Cloud account with Text-to-Speech API enabled
- Google Cloud credentials (service account key)

## Local Usage

Run the application locally to process a single URL:

```bash
node index.js https://example.com/article-url
```

## Deployment

To deploy updates:

```bash
npm run deploy
```

This updates the Cloud Function with your local changes.

### Customization

To change the voice or other settings, update `config.js` and redeploy.

```javascript
tts: {
  voice: {
    languageCode: 'en-US',
    name: 'en-US-Chirp3-HD-Achernar', // Change to your preferred voice
    ssmlGender: 'FEMALE'
  }
}
```

## License

MIT