# Google Text-to-Speech Available Voices

Google Cloud Text-to-Speech offers a wide variety of voices across different languages. Here's a comprehensive list of English voices that you can use in your RSS-to-Podcast application.

## English (US) Voices

### WaveNet Voices (High Quality)
These provide more natural-sounding speech than the standard voices.

| Voice Name | Gender | Description |
|------------|--------|-------------|
| `en-US-Wavenet-A` | MALE | WaveNet male voice |
| `en-US-Wavenet-B` | MALE | WaveNet male voice, deeper tone |
| `en-US-Wavenet-C` | FEMALE | WaveNet female voice |
| `en-US-Wavenet-D` | MALE | WaveNet male voice, different style |
| `en-US-Wavenet-E` | FEMALE | WaveNet female voice, different style |
| `en-US-Wavenet-F` | FEMALE | WaveNet female voice, softer tone |
| `en-US-Wavenet-G` | FEMALE | WaveNet female voice, different accent |
| `en-US-Wavenet-H` | FEMALE | WaveNet female voice, different style |
| `en-US-Wavenet-I` | MALE | WaveNet male voice, different accent |
| `en-US-Wavenet-J` | MALE | WaveNet male voice, different style |

### Neural2 Voices (Newest and Highest Quality)
These are the newest generation of voices and offer the most natural-sounding speech.

| Voice Name | Gender | Description |
|------------|--------|-------------|
| `en-US-Neural2-A` | MALE | Neural2 male voice |
| `en-US-Neural2-C` | FEMALE | Neural2 female voice |
| `en-US-Neural2-D` | MALE | Neural2 male voice, different style |
| `en-US-Neural2-E` | FEMALE | Neural2 female voice, different style |
| `en-US-Neural2-F` | FEMALE | Neural2 female voice, currently used in your app |
| `en-US-Neural2-G` | FEMALE | Neural2 female voice, different accent |
| `en-US-Neural2-H` | FEMALE | Neural2 female voice, different style |
| `en-US-Neural2-I` | MALE | Neural2 male voice, different accent |
| `en-US-Neural2-J` | MALE | Neural2 male voice, different style |

### Studio Voices (Professional Recording Quality)
These are recorded by professional voice actors in a studio for the highest quality.

| Voice Name | Gender | Description |
|------------|--------|-------------|
| `en-US-Studio-O` | FEMALE | Studio female voice, professional tone |
| `en-US-Studio-Q` | MALE | Studio male voice, professional tone |

## English (UK) Voices

| Voice Name | Gender | Description |
|------------|--------|-------------|
| `en-GB-Neural2-A` | FEMALE | Neural2 UK female voice |
| `en-GB-Neural2-B` | MALE | Neural2 UK male voice |
| `en-GB-Neural2-C` | FEMALE | Neural2 UK female voice, different style |
| `en-GB-Neural2-D` | MALE | Neural2 UK male voice, different style |
| `en-GB-Wavenet-A` | FEMALE | WaveNet UK female voice |
| `en-GB-Wavenet-B` | MALE | WaveNet UK male voice |
| `en-GB-Wavenet-C` | FEMALE | WaveNet UK female voice, different style |
| `en-GB-Wavenet-D` | MALE | WaveNet UK male voice, different style |

## English (Australia) Voices

| Voice Name | Gender | Description |
|------------|--------|-------------|
| `en-AU-Neural2-A` | FEMALE | Neural2 Australian female voice |
| `en-AU-Neural2-B` | MALE | Neural2 Australian male voice |
| `en-AU-Neural2-C` | FEMALE | Neural2 Australian female voice, different style |
| `en-AU-Neural2-D` | MALE | Neural2 Australian male voice, different style |
| `en-AU-Wavenet-A` | FEMALE | WaveNet Australian female voice |
| `en-AU-Wavenet-B` | MALE | WaveNet Australian male voice |
| `en-AU-Wavenet-C` | FEMALE | WaveNet Australian female voice, different style |
| `en-AU-Wavenet-D` | MALE | WaveNet Australian male voice, different style |

## How to Change the Voice in Your App

To change the voice used in your application, update the `config.js` file:

```javascript
// Google Cloud Text-to-Speech configuration
tts: {
  voice: {
    languageCode: 'en-US', // Change this for different English variants (en-GB, en-AU, etc.)
    name: 'en-US-Neural2-F', // Change this to your preferred voice
    ssmlGender: 'FEMALE' // Update this to match the gender of the voice (MALE/FEMALE)
  },
  audioConfig: {
    audioEncoding: 'MP3',
    speakingRate: 1.0, // Adjust this to change the speaking speed (0.25 to 4.0)
    pitch: 0.0, // Adjust this to change the pitch (-20.0 to 20.0)
    volumeGainDb: 0.0, // Adjust this to change the volume (-96.0 to 16.0)
    effectsProfileId: ['headphone-class-device']
  }
}
```

For example, to use a male UK voice with a slightly faster speaking rate:

```javascript
tts: {
  voice: {
    languageCode: 'en-GB',
    name: 'en-GB-Neural2-B',
    ssmlGender: 'MALE'
  },
  audioConfig: {
    audioEncoding: 'MP3',
    speakingRate: 1.1, // Slightly faster
    pitch: 0.0,
    volumeGainDb: 0.0,
    effectsProfileId: ['headphone-class-device']
  }
}
```

After changing the configuration, redeploy your application with:

```
gcloud functions deploy rss-tts-podcast --gen2 --runtime nodejs20 --trigger-http --allow-unauthenticated --memory 1024MB --timeout 540s --source=. --entry-point=generatePodcast --region=us-central1 --set-env-vars="GCS_BUCKET_NAME=instapaper-podcasts,GOOGLE_CLOUD_PROJECT=rss-tss-podcast,USE_CLOUD_STORAGE=true"
```

Then trigger the function to reprocess articles with the new voice.
