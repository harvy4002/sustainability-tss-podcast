### **Project Summary**
The user returned to their RSS-to-Podcast project with several feature requests focused on improving content quality, controlling costs, and adding a user interface. All requested features were implemented, and a critical cost issue was diagnosed and resolved.

### **Completed Features & Fixes**

1.  **Content Parsing & Cleaning:**
    *   **Upgraded Parser:** Replaced the basic `html-to-text` library with Mozilla's `@mozilla/readability` and `jsdom`. This provides a much higher-quality, Firefox-like reader view extraction, removing ads, navbars, and other clutter from the source articles.
    *   **Handled Separators:** Added logic to find and replace long sequences of dashes (`----`) with a single space to prevent the TTS engine from reading them aloud.

2.  **Cost Control & Billing:**
    *   **Diagnosed High Bill (£78.88):** Investigated the user's high billing. Discovered that the `processed-articles.json` cache was not being used correctly, causing the system to **re-process every article in the feed on every run**. This, combined with the use of the expensive "Studio" voice, was the root cause of the high cost.
    *   **Fixed Caching:** Corrected the application logic to ensure that once an article is processed, it is skipped on all subsequent runs. This was the most critical fix to stop unnecessary spending.
    *   **Implemented Character Limit:** A hard limit of 50,000 characters per article was added to prevent accidentally processing extremely long documents and incurring unexpected TTS charges.
    *   **Implemented Dynamic Voice Switching (Cost/Quality Strategy):**
        *   The system now prioritizes using the high-quality **`en-US-Studio-O`** voice.
        *   It tracks the total characters processed with this voice in a `usage-stats.json` file.
        *   Once usage approaches the 1 million character monthly free limit for Studio voices, the system **automatically switches to the more economical `en-US-Journey-F` voice** for the remainder of the month.

3.  **Web Player UI & Dashboard:**
    *   **Created Player Page:** Built a new `index.html` landing page that is generated and uploaded to the Google Cloud Storage bucket on every run.
    *   **Episode List:** This page now displays a list of all processed episodes with playable `<audio>` controls, the article title, publication date, and a link to the original source.
    *   **Cost Tracking Dashboard:**
        *   The page includes a "Monthly Usage Limits" dashboard.
        *   It displays **two separate progress bars** showing the consumption of the **1 million free characters for Studio voices** and the **1 million free characters for Journey/Neural2 voices**.
        *   It also shows an estimated total cost for the month if the free tiers are exceeded.
    *   **Manual Sync:** Manually updated the `usage-stats.json` file to reflect that the Studio voice free tier for the current month was already consumed, making the new dashboard accurate immediately.

4.  **Chirp 3: HD Voice Model Integration:**
    *   **Upgraded Model:** Switched the primary TTS model to **Chirp 3: HD**, the latest high-fidelity model from Google Cloud.
    *   **Randomized Female Voices:** Implemented logic to pick a random female voice from the Chirp 3: HD library (e.g., Achernar, Aoede, Leda, Zephyr) for each article, providing a varied listening experience.
    *   **Updated Cost Tracking:** Refactored the `usage-tracker.js` and landing page dashboard to focus on Chirp 3: HD credits and usage, with pricing set at $30 per 1 million characters.
    *   **Configuration Update:** Set the default voice to `en-US-Chirp3-HD-Achernar`.

5.  **Poison Pill Billing Fix (Jan 29th Investigation):**
    *   **Diagnosed £3.40 Bill:** Investigated a billing spike and identified a "fail-retry" loop caused by a specific long article ("Vodafone Germany..."). 
    *   **Root Cause:** The article contained sentences that were too long for the Google TTS API. The script would successfully process (and pay for) initial chunks, fail on the long sentence, crash before saving to cache, and then retry the same paid chunks on the next run.
    *   **Improved Chunking Logic:** Updated `splitTextIntoChunks` in `text-to-speech.js` to enforce a **hard character limit split**. If natural boundaries (periods, commas) aren't found, the system now forcefully slices long segments into safe-sized chunks. This allows problematic articles to complete successfully and prevents infinite billing loops.

### **Current Status**
The application is fully deployed and functional using the latest **Chirp 3: HD** models with randomized female voices. Critical billing leaks from both caching issues and long-sentence processing errors have been resolved, and the user can now monitor credits via the web landing page.