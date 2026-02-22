# Google Cloud Permissions for RSS TTS Podcast

This document outlines all the Google Cloud permissions required for the RSS TTS Podcast project. These permissions are essential for the Cloud Function to operate correctly and securely.

## Service Account Permissions

The service account used for the Cloud Function requires the following IAM roles:

| Role | Permission ID | Description | Purpose in Project |
|------|--------------|-------------|-------------------|
| Cloud Functions Admin | `roles/cloudfunctions.admin` | Provides full control of Cloud Functions resources | Required to deploy and manage the Cloud Function |
| Cloud Run Admin | `roles/run.admin` | Provides full control of Cloud Run resources | Required for Cloud Functions Gen2 which run on Cloud Run |
| Service Account User | `roles/iam.serviceAccountUser` | Run operations as the service account | Allows the function to use service account credentials |
| Storage Object Admin | `roles/storage.objectAdmin` | Full control of GCS objects | Required to read/write audio files and podcast feed to Cloud Storage |
| Text-to-Speech Admin | `roles/texttospeech.admin` | Full access to Text-to-Speech API | Required to convert article text to speech |

## Command-line Instructions

### Assign Roles to Your Service Account

Replace `YOUR_PROJECT_ID` and `YOUR_SERVICE_ACCOUNT_EMAIL` with your actual project ID and service account email.

```bash
# Cloud Functions Admin
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudfunctions.admin"

# Cloud Run Admin
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"

# Service Account User
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser"

# Storage Object Admin
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.objectAdmin"

# Text-to-Speech Admin
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/texttospeech.admin"
```

### Setting up the Storage Bucket

```bash
# Create a new bucket with uniform bucket-level access (recommended)
gsutil mb -b -l REGION gs://YOUR_BUCKET_NAME

# Make the bucket publicly readable for podcast feed access
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME

# Grant the service account permissions to write to the bucket
gsutil iam ch serviceAccount:YOUR_SERVICE_ACCOUNT_EMAIL:roles/storage.objectAdmin gs://YOUR_BUCKET_NAME
```

With uniform bucket-level access enabled, you cannot set ACLs on individual objects. Instead, all permissions are managed at the bucket level, which is more secure and simpler to manage.

## Google Cloud APIs to Enable

The following APIs must be enabled in your Google Cloud project:

| API | Service Name | Purpose |
|-----|-------------|---------|
| Cloud Functions API | `cloudfunctions.googleapis.com` | Required to deploy Cloud Functions |
| Cloud Run API | `run.googleapis.com` | Required for Cloud Functions Gen2 |
| Cloud Build API | `cloudbuild.googleapis.com` | Required for deployment |
| Cloud Storage API | `storage.googleapis.com` | Required for storing audio files and podcast feed |
| Text-to-Speech API | `texttospeech.googleapis.com` | Required for converting text to audio |
| Artifact Registry API | `artifactregistry.googleapis.com` | Required for container storage |
| Cloud Logging API | `logging.googleapis.com` | Required for function logs |

### Command to Enable APIs

```bash
gcloud services enable cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  storage.googleapis.com \
  texttospeech.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com
```

## Deployment Service Account (for GitHub Actions)

The service account used for deployment via GitHub Actions needs:

| Role | Permission ID | Description |
|------|--------------|-------------|
| Cloud Functions Admin | `roles/cloudfunctions.admin` | To deploy Cloud Functions |
| Cloud Run Admin | `roles/run.admin` | For Cloud Functions Gen2 |
| Service Account User | `roles/iam.serviceAccountUser` | To act as service accounts |
| Storage Admin | `roles/storage.admin` | To create and manage buckets |
| IAM Security Admin | `roles/iam.securityAdmin` | To manage IAM policies |

> **Important**: The `roles/iam.serviceAccountUser` role is critical for deployment. The deployment service account must have this permission at the project level **AND** specifically on the service account that will run the Cloud Function.

### Command for Deployment Service Account

```bash
# For the deployment service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudfunctions.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.securityAdmin"

# Also grant specific permission to act as the function's service account
gcloud iam service-accounts add-iam-policy-binding \
  YOUR_FUNCTION_SERVICE_ACCOUNT_EMAIL \
  --member="serviceAccount:YOUR_DEPLOYMENT_SERVICE_ACCOUNT_EMAIL" \
  --role="roles/iam.serviceAccountUser"
```

## Compute Engine Default Service Account Permissions

If your Cloud Function is using the Compute Engine default service account (which is the default when no service account is specified), make sure to grant it the necessary permissions:

```bash
# Get the default compute service account
COMPUTE_SA="$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

# Grant Text-to-Speech Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/texttospeech.admin"

# Grant Storage Object Admin role
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${COMPUTE_SA}" \
  --role="roles/storage.objectAdmin"
```

> **Note:** Using the default Compute Engine service account is the simplest approach for CI/CD pipelines as it avoids IAM permission issues with service account impersonation. However, for production environments, you should consider creating a dedicated service account with minimal permissions following the principle of least privilege.

## Troubleshooting Permissions

If you encounter permission issues, you can verify the current permissions with:

```bash
# List IAM policies for the project
gcloud projects get-iam-policy YOUR_PROJECT_ID

# Check bucket permissions
gsutil iam get gs://YOUR_BUCKET_NAME

# Test service account permissions
gcloud auth activate-service-account YOUR_SERVICE_ACCOUNT_EMAIL --key-file=YOUR_KEY_FILE.json
gcloud auth print-access-token
curl -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  https://texttospeech.googleapis.com/v1/voices
```

### Common Permission Issues and Solutions

If you encounter the error "Caller is missing permission 'iam.serviceaccounts.actAs' on service account", you need to ensure that your deployment service account has permission to act as the function's service account:

```bash
# Grant the deployment service account permission to act as the function service account
gcloud iam service-accounts add-iam-policy-binding [TARGET_SERVICE_ACCOUNT] \
  --member=serviceAccount:[DEPLOYMENT_SERVICE_ACCOUNT] \
  --role=roles/iam.serviceAccountUser
```

Replace `[TARGET_SERVICE_ACCOUNT]` with your function's service account email (e.g., `admin01@your-project.iam.gserviceaccount.com`) and `[DEPLOYMENT_SERVICE_ACCOUNT]` with your deployment service account email (e.g., `1234567890@cloudbuild.gserviceaccount.com`).

This is especially important for GitHub Actions or other CI/CD pipelines where the deployment service account needs to deploy a function that runs as a different service account.
