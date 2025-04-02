import os
import json
from flask import Flask, render_template, request, jsonify, redirect, url_for
import firebase_admin
from firebase_admin import credentials, firestore, storage
import local_constants as local_constants

# Initialize Flask app
app = Flask(__name__, static_folder='public', static_url_path='')

# Initialize Firebase Admin SDK
cred = credentials.Certificate({
    "type": "service_account",
    "project_id": local_constants.GOOGLE_PROJECT_ID,
    "private_key_id": local_constants.GOOGLE_PRIVATE_KEY_ID,
    "private_key": local_constants.GOOGLE_PRIVATE_KEY,
    "client_email": local_constants.GOOGLE_CLIENT_EMAIL,
    "client_id": local_constants.GOOGLE_CLIENT_ID,
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": local_constants.GOOGLE_CLIENT_X509_CERT_URL
})
firebase_admin.initialize_app(cred, {
    'storageBucket': local_constants.FIREBASE_STORAGE_BUCKET
})

# Initialize Firestore and Storage
db = firestore.client()
bucket = storage.bucket()

@app.route('/')
def index():
    """Serve the main application page"""
    return app.send_static_file('index.html')

@app.route('/init-user', methods=['POST'])
def init_user():
    """Initialize a new user with root directory when they first log in"""
    data = request.json
    uid = data.get('uid')
    email = data.get('email')
    
    user_ref = db.collection('users').document(uid)
    user = user_ref.get()
    
    if not user.exists:
        user_ref.set({
            'email': email,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        db.collection('directories').document().set({
            'user_id': uid,
            'name': '/',
            'path': '/',
            'parent_path': None,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({'success': True, 'message': 'User initialized'})
    
    return jsonify({'success': True, 'message': 'User exists'})

@app.route('/get-directories', methods=['POST'])
def get_directories():
    """Get all directories within the current path"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('path', '/')
    
    directories = db.collection('directories').where('user_id', '==', uid).where('parent_path', '==', current_path).stream()
    
    result = []
    for directory in directories:
        dir_data = directory.to_dict()
        dir_data['id'] = directory.id
        result.append(dir_data)
    
    return jsonify({'success': True, 'directories': result})

@app.route('/get-files', methods=['POST'])
def get_files():
    """Get all files within the current directory"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('path', '/')
    
    files = db.collection('files').where('user_id', '==', uid).where('path', '==', current_path).stream()
    
    result = []
    for file in files:
        file_data = file.to_dict()
        file_data['id'] = file.id
        result.append(file_data)
    
    return jsonify({'success': True, 'files': result})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)