# Dropbox Clone - Render Deployment Guide

This guide will help you deploy the Dropbox Clone application to Render.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Firebase Project**: Set up Firebase project with Authentication and Storage enabled

## Step 1: Prepare Your Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing one
3. Enable **Authentication** with Email/Password provider
4. Enable **Cloud Storage** 
5. Enable **Firestore Database**
6. Generate a **Service Account Key**:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Download the JSON file

## Step 2: Set Up Environment Variables

In your Render dashboard, you'll need to set these environment variables:

### Firebase Service Account (from the downloaded JSON):
```
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----
GOOGLE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_X509_CERT_URL=https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40your-project.iam.gserviceaccount.com
```

### Firebase Web Config (from Firebase Console → Project Settings → Web App):
```
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## Step 3: Deploy to Render

### Option A: Using render.yaml (Recommended)

1. **Connect Repository**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**:
   - Render will automatically detect the `render.yaml` file
   - Review the configuration and click "Create Web Service"

3. **Set Environment Variables**:
   - Go to your service's Environment tab
   - Add all the Firebase environment variables listed above

### Option B: Manual Configuration

1. **Connect Repository**:
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Build Settings**:
   ```
   Name: dropbox-clone
   Environment: Python 3
   Build Command: pip install -r requirements.txt
   Start Command: gunicorn app:app --host 0.0.0.0 --port $PORT
   ```

3. **Set Environment Variables**:
   - Add all Firebase environment variables
   - Set `PYTHON_VERSION=3.9.16`

## Step 4: Configure Firebase Storage Rules

Update your Firebase Storage rules to allow authenticated users:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Step 5: Configure Firestore Rules

Update your Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Directories - users can only access their own
    match /directories/{document} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
    }
    
    // Files - users can only access their own
    match /files/{document} {
      allow read, write: if request.auth != null && resource.data.user_id == request.auth.uid;
    }
    
    // Shared files - users can access files shared with them
    match /shared_files/{document} {
      allow read, write: if request.auth != null && 
        (resource.data.owner_id == request.auth.uid || 
         resource.data.shared_with == request.auth.uid);
    }
  }
}
```

## Step 6: Test Your Deployment

1. **Access Your App**: Visit the URL provided by Render
2. **Test Authentication**: Try signing up and logging in
3. **Test File Operations**: Upload, download, and share files
4. **Check Logs**: Monitor Render logs for any errors

## Troubleshooting

### Common Issues:

1. **Firebase Connection Errors**:
   - Verify all environment variables are set correctly
   - Check that private key includes proper line breaks (`\n`)

2. **Storage Permission Errors**:
   - Ensure Firebase Storage rules allow authenticated access
   - Verify storage bucket name is correct

3. **Build Failures**:
   - Check that `requirements.txt` includes all dependencies
   - Verify Python version compatibility

4. **CORS Issues**:
   - Add your Render domain to Firebase authorized domains
   - Go to Firebase Console → Authentication → Settings → Authorized domains

### Environment Variable Tips:

- **Private Key**: Ensure the `GOOGLE_PRIVATE_KEY` includes `\n` for line breaks
- **URLs**: Don't include trailing slashes in domain URLs
- **Case Sensitivity**: Environment variable names are case-sensitive

## Security Notes

- Never commit `local_constants.py` to version control
- Use environment variables for all sensitive data
- Regularly rotate Firebase service account keys
- Monitor Firebase usage and set up billing alerts

## Support

If you encounter issues:
1. Check Render logs for error messages
2. Verify Firebase console for authentication/storage errors
3. Test locally with the same environment variables
4. Check Firebase quotas and billing status

## File Structure After Deployment

```
dropbox-clone/
├── app.py                 # Main Flask application
├── config.py              # Environment-based configuration
├── requirements.txt       # Python dependencies
├── render.yaml           # Render deployment configuration
├── DEPLOYMENT.md         # This deployment guide
├── public/               # Frontend files
│   ├── index.html
│   ├── js/
│   └── css/
└── docs/                 # Documentation
```

Your application should now be successfully deployed and accessible via the Render-provided URL! 