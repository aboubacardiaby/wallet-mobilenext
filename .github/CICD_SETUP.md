# CI/CD Setup Guide for Kalipeh Wallet Android

This guide explains how to set up the GitHub Actions CI/CD pipeline for building and deploying the Android app to Google Play.

## Overview

The pipeline consists of two workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `android-release.yml` | Push to `main`, manual | Build AAB and deploy to Google Play |
| `android-pr.yml` | Pull requests | Build debug APK for testing |

## Required GitHub Secrets

Go to **Repository Settings → Secrets and variables → Actions** and add these secrets:

### 1. Signing Secrets

| Secret | Description |
|--------|-------------|
| `KEYSTORE_BASE64` | Base64-encoded release keystore file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Key alias name |
| `KEY_PASSWORD` | Key password |

**To encode your keystore:**
```bash
base64 -i your-release-key.keystore | pbcopy  # macOS
base64 -w 0 your-release-key.keystore         # Linux
```

### 2. Google Play Secrets

| Secret | Description |
|--------|-------------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Full JSON content of service account key |

### 3. App Configuration

| Secret | Description |
|--------|-------------|
| `API_URL` | Production API URL (e.g., `https://kalipeh-wallet-xxx.run.app/api/v1/`) |

### 4. Optional Secrets

| Secret | Description |
|--------|-------------|
| `SLACK_WEBHOOK_URL` | Slack webhook for build notifications |

---

## Google Play Service Account Setup

### Step 1: Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select or create a project linked to your Google Play Console
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **Create Service Account**
5. Name: `github-actions-play-deploy`
6. Click **Create and Continue**
7. Skip role assignment (we'll do this in Play Console)
8. Click **Done**

### Step 2: Create JSON Key

1. Click on the created service account
2. Go to **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON** format
5. Download and save the JSON file securely

### Step 3: Link to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Navigate to **Settings → API access**
3. Link your Google Cloud project if not already linked
4. Find your service account and click **Grant access**
5. Set permissions:
   - **App access**: Select your app (com.kalipeh.mobile)
   - **Account permissions**:
     - View app information and download bulk reports
     - Create, edit, and delete draft apps
     - Release apps to testing tracks
     - Release to production, exclude devices, and use Play App Signing

### Step 4: Add to GitHub Secrets

Copy the entire JSON content and add it as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret.

---

## Workflow Usage

### Automatic Deployment (Push to main)

When you push to `main` branch, the workflow automatically:
1. Runs tests and linting
2. Builds release AAB
3. Deploys to **internal** testing track

### Manual Deployment

1. Go to **Actions** tab
2. Select **Android Build & Deploy to Google Play**
3. Click **Run workflow**
4. Choose deployment track:
   - `internal` - Internal testing (default)
   - `alpha` - Closed testing
   - `beta` - Open testing
   - `production` - Production release

### Fastlane Commands (Local)

```bash
cd android

# Build release AAB
bundle exec fastlane build_release

# Deploy to internal track
bundle exec fastlane deploy track:internal

# Deploy to production
bundle exec fastlane deploy track:production

# Promote internal to beta
bundle exec fastlane promote_to_beta

# Promote beta to production (with 10% rollout)
bundle exec fastlane promote_to_production rollout:0.1

# Increment version code
bundle exec fastlane increment_version

# Set version name
bundle exec fastlane set_version_name version:1.2.0
```

---

## Version Management

Before releasing, update version in `android/app/build.gradle`:

```groovy
defaultConfig {
    versionCode 4        // Increment for each release
    versionName "1.0.2"  // User-visible version
}
```

Or use Fastlane:
```bash
bundle exec fastlane increment_version
bundle exec fastlane set_version_name version:1.0.2
```

---

## Deployment Environments

Configure GitHub Environments for additional protection:

1. Go to **Settings → Environments**
2. Create environments: `internal`, `alpha`, `beta`, `production`
3. For `production`, add:
   - Required reviewers
   - Wait timer (optional)
   - Deployment branch rules

---

## Troubleshooting

### Build Failures

**"Keystore not found"**
- Verify `KEYSTORE_BASE64` is correctly encoded
- Check keystore filename matches `release.keystore`

**"Invalid service account"**
- Verify JSON is complete (not truncated)
- Check service account has Play Console access

### Deployment Failures

**"Package not found"**
- Ensure app is created in Play Console first
- Package name must be `com.kalipeh.mobile`

**"Version code already used"**
- Increment `versionCode` in build.gradle
- Each upload must have a unique version code

**"API access denied"**
- Re-check service account permissions in Play Console
- Ensure API access is enabled

---

## Security Notes

- Never commit keystore files or secrets to the repository
- Use GitHub's secret masking for sensitive outputs
- Rotate service account keys periodically
- Review Actions logs for accidental secret exposure
- The workflow automatically cleans up sensitive files after deployment
