# Sustainability TSS Podcast: Summary of Work & Architecture

## Overview
The **Sustainability TSS Podcast** project is a serverless application that converts web articles into high-quality audio podcasts using Google Cloud Text-to-Speech (Chirp models). It automatically generates an RSS feed and a landing page, hosting everything on Google Cloud Storage.

## Recent Updates (February 2026)

### 1. Cloud Infrastructure Cleanup & Consolidation
*   **Action**: Audited Google Cloud resources and identified split deployments between `europe-west1` and `europe-west2`.
*   **Result**: Removed all legacy artifacts (Functions, Storage Buckets, Artifact Registry repos) from `europe-west1`.
*   **Current State**: The entire stack is now strictly consolidated in **`europe-west2` (London)**.

### 2. Carbon Impact & Usage Tracking
*   **Feature**: Enhanced the usage tracking system to persist lifetime statistics across function executions.
*   **Metrics Added**:
    *   **Hours Processed**: Calculated based on character count (~48k chars/hour).
    *   **Article Count**: Total number of unique articles processed over time.
    *   **Energy & CO2**: Real-time estimation based on AI inference energy models and regional grid intensity.
    *   **Phone Charges**: A relatable equivalent metric for energy usage.
*   **UI Update**: Redesigned the "Carbon Impact" section on the landing page to a responsive 3-column grid layout for better readability.

### 3. Deployment Automation
*   **Feature**: Created a trigger mechanism to regenerate the static site (Landing Page + RSS) without requiring a new article input.
*   **Integration**: Updated `package.json` scripts.
    *   `npm run refresh`: Triggers the remote function to rebuild the site.
    *   `npm run deploy`: Now automatically runs a refresh immediately after deployment to ensure the live site reflects the latest code/template changes.

---

## Current Features

*   **Article Parsing**: Extracts clean text from URLs using `@mozilla/readability`.
*   **AI Text-to-Speech**: Utilizes Google's **Chirp 3: HD** (Neural) models for natural-sounding audio.
*   **Podcast Feed**: Generates a valid XML RSS feed compatible with Apple Podcasts, Overcast, etc.
*   **Static Hosting**: Serves the RSS feed, audio files, and a dynamic Landing Page directly from Google Cloud Storage (Serverless & Low Cost).
*   **Cost & Limits**: Tracks monthly character usage against the Free Tier (1M chars/month) and estimates costs.

---

## Architectural Decision Records (ADR)

### ADR-001: Region Consolidation to `europe-west2`
*   **Context**: The project had resources in both `europe-west1` and `europe-west2`.
*   **Decision**: Consolidate everything to **`europe-west2` (London)**.
*   **Reasoning**:
    *   **Data Sovereignty/Latency**: Keeps data and processing in the UK/Europe region.
    *   **Simplicity**: Prevents confusion from having multiple active function endpoints.
    *   **Carbon Intensity**: `europe-west2` generally has a cleaner grid (lower carbon intensity) than some other regions.

### ADR-002: JSON-based Persistence (vs. Database)
*   **Context**: We need to track usage stats (characters, articles) and processed cache.
*   **Decision**: Use JSON files (`usage-stats.json`, `processed-articles.json`) stored in Google Cloud Storage.
*   **Reasoning**:
    *   **Scale**: The current volume (dozens/hundreds of articles) does not justify the cost or complexity of a dedicated database like Firestore or Cloud SQL.
    *   **Cost**: Storage operations are negligible in cost compared to managed database instances.
    *   **Portability**: Easy to back up or migrate by simply downloading the JSON files.

### ADR-003: Post-Deployment Trigger
*   **Context**: Changing the HTML template (`landing-page.hbs`) or logic (`landing-page.js`) didn't update the live site until the *next* article was processed.
*   **Decision**: Implement a `trigger-update.js` script and chain it to the deploy command.
*   **Reasoning**:
    *   **Immediate Feedback**: Ensures that code deployments immediately reflect on the public-facing site.
    *   **Decoupling**: Separates "Site Generation" from "Content Ingestion", allowing us to fix typos or CSS without incurring TTS costs.

### ADR-004: Carbon Metrics Methodology
*   **Context**: We want to display the environmental impact of using AI TTS.
*   **Decision**: Use a localized estimation model.
    *   *Grid Intensity*: Fixed to ~200g CO₂e/kWh (approximate London average).
    *   *AI Energy*: Estimated at ~10kWh per 1 Million characters processed (inference cost).
*   **Reasoning**: While exact numbers vary by hardware load, providing a transparent *estimate* helps users understand the "hidden" cost of AI processing. We include "Phone Charges" as a metric to make the abstract CO2 numbers relatable to non-technical users.
