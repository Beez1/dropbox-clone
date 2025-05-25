import os
import local_constants

# Firebase configuration for production deployment
# Use environment variables if available, otherwise fall back to local constants

# Google service account credentials
GOOGLE_PROJECT_ID = os.environ.get('GOOGLE_PROJECT_ID', local_constants.GOOGLE_PROJECT_ID)
GOOGLE_PRIVATE_KEY_ID = os.environ.get('GOOGLE_PRIVATE_KEY_ID', local_constants.GOOGLE_PRIVATE_KEY_ID)
GOOGLE_PRIVATE_KEY = os.environ.get('GOOGLE_PRIVATE_KEY', local_constants.GOOGLE_PRIVATE_KEY)
GOOGLE_CLIENT_EMAIL = os.environ.get('GOOGLE_CLIENT_EMAIL', local_constants.GOOGLE_CLIENT_EMAIL)
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', local_constants.GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_X509_CERT_URL = os.environ.get('GOOGLE_CLIENT_X509_CERT_URL', local_constants.GOOGLE_CLIENT_X509_CERT_URL)

# Firebase web configuration
FIREBASE_STORAGE_BUCKET = os.environ.get('FIREBASE_STORAGE_BUCKET', local_constants.FIREBASE_STORAGE_BUCKET)
FIREBASE_API_KEY = os.environ.get('FIREBASE_API_KEY', local_constants.FIREBASE_API_KEY)
FIREBASE_AUTH_DOMAIN = os.environ.get('FIREBASE_AUTH_DOMAIN', local_constants.FIREBASE_AUTH_DOMAIN)
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', local_constants.FIREBASE_PROJECT_ID)
FIREBASE_MESSAGING_SENDER_ID = os.environ.get('FIREBASE_MESSAGING_SENDER_ID', local_constants.FIREBASE_MESSAGING_SENDER_ID)
FIREBASE_APP_ID = os.environ.get('FIREBASE_APP_ID', local_constants.FIREBASE_APP_ID)
FIREBASE_MEASUREMENT_ID = os.environ.get('FIREBASE_MEASUREMENT_ID', local_constants.FIREBASE_MEASUREMENT_ID) 