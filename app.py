import os
import json
import hashlib
from flask import Flask, render_template, request, jsonify, redirect, url_for
import firebase_admin
from firebase_admin import credentials, firestore, storage
import local_constants as local_constants
import datetime
import re

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
    
    # Check if user already exists
    user_ref = db.collection('users').document(uid)
    user = user_ref.get()
    
    if not user.exists:
        # Create user document
        user_ref.set({
            'email': email,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        # Create root directory
        db.collection('directories').document().set({
            'user_id': uid,
            'name': '/',
            'path': '/',
            'parent_path': None,
            'created_at': firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({'success': True, 'message': 'User initialized with root directory'})
    
    return jsonify({'success': True, 'message': 'User already exists'})

@app.route('/get-directories', methods=['POST'])
def get_directories():
    """Get all directories within the current path"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('path', '/')
    
    # Query directories in the current path
    directories = db.collection('directories').where('user_id', '==', uid).where('parent_path', '==', current_path).stream()
    
    result = []
    for directory in directories:
        dir_data = directory.to_dict()
        dir_data['id'] = directory.id
        result.append(dir_data)
    
    # Add special entry for parent directory if not in root
    if current_path != '/':
        result.append({
            'id': 'parent',
            'name': '..',
            'path': '../',
            'parent_path': current_path,
            'is_special': True
        })
    
    return jsonify({'success': True, 'directories': result})

@app.route('/get-files', methods=['POST'])
def get_files():
    """Get all files within the current directory"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('path', '/')
    
    # Query files in the current path
    files = db.collection('files').where('user_id', '==', uid).where('path', '==', current_path).stream()
    
    result = []
    for file in files:
        file_data = file.to_dict()
        file_data['id'] = file.id
        result.append(file_data)
    
    return jsonify({'success': True, 'files': result})

@app.route('/create-directory', methods=['POST'])
def create_directory():
    """Create a new directory"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('current_path', '/')
    dir_name = data.get('directory_name')
    
    # Make sure directory name is valid
    if not dir_name or '/' in dir_name or dir_name == '..':
        return jsonify({'success': False, 'message': 'Invalid directory name'})
    
    # Check for duplicate directories
    new_path = current_path + ('' if current_path.endswith('/') else '/') + dir_name
    existing_dirs = db.collection('directories').where('user_id', '==', uid).where('path', '==', new_path).get()
    
    if len(existing_dirs) > 0:
        return jsonify({'success': False, 'message': 'Directory already exists'})
    
    # Create the directory
    db.collection('directories').document().set({
        'user_id': uid,
        'name': dir_name,
        'path': new_path,
        'parent_path': current_path,
        'created_at': firestore.SERVER_TIMESTAMP
    })
    
    return jsonify({'success': True, 'message': 'Directory created successfully'})

@app.route('/delete-directory', methods=['POST'])
def delete_directory():
    """Delete a directory if it's empty"""
    data = request.json
    uid = data.get('uid')
    directory_id = data.get('directory_id')
    
    # Get directory
    dir_ref = db.collection('directories').document(directory_id)
    directory = dir_ref.get()
    
    if not directory.exists:
        return jsonify({'success': False, 'message': 'Directory not found'})
    
    dir_data = directory.to_dict()
    
    # Check for files in directory
    files = db.collection('files').where('user_id', '==', uid).where('path', '==', dir_data['path']).get()
    if len(files) > 0:
        return jsonify({'success': False, 'message': 'Cannot delete directory with files'})
    
    # Check for subdirectories
    subdirs = db.collection('directories').where('user_id', '==', uid).where('parent_path', '==', dir_data['path']).get()
    if len(subdirs) > 0:
        return jsonify({'success': False, 'message': 'Cannot delete directory with subdirectories'})
    
    # Delete the directory
    dir_ref.delete()
    
    return jsonify({'success': True, 'message': 'Directory deleted successfully'})

@app.route('/navigate-directory', methods=['POST'])
def navigate_directory():
    """Get the path for navigating to a specific directory"""
    data = request.json
    uid = data.get('uid')
    directory_id = data.get('directory_id')
    current_path = data.get('current_path', '/')
    
    # Handle special parent directory case
    if directory_id == 'parent':
        # Extract parent path
        path_parts = current_path.split('/')
        # Remove the last component
        if len(path_parts) > 1:
            path_parts.pop()
            new_path = '/'.join(path_parts)
            if not new_path:
                new_path = '/'
        else:
            new_path = '/'
        
        return jsonify({'success': True, 'path': new_path})
    
    # For regular directory navigation
    dir_ref = db.collection('directories').document(directory_id)
    directory = dir_ref.get()
    
    if not directory.exists:
        return jsonify({'success': False, 'message': 'Directory not found'})
    
    return jsonify({'success': True, 'path': directory.to_dict()['path']})

@app.route('/upload-file', methods=['POST'])
def upload_file():
    """Handle file uploads"""
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file provided'})
    
    file = request.files['file']
    uid = request.form.get('uid')
    current_path = request.form.get('path', '/')
    overwrite = request.form.get('overwrite', 'false') == 'true'
    
    if not file.filename:
        return jsonify({'success': False, 'message': 'No file selected'})
    
    # Check if file already exists
    existing_files = db.collection('files').where('user_id', '==', uid).where('path', '==', current_path).where('name', '==', file.filename).get()
    
    if len(existing_files) > 0 and not overwrite:
        return jsonify({'success': False, 'message': 'File already exists', 'needs_confirmation': True})
    
    # If overwriting, delete the old file
    if len(existing_files) > 0 and overwrite:
        for existing_file in existing_files:
            file_data = existing_file.to_dict()
            # Delete from storage
            old_blob = bucket.blob(f"{uid}/{file_data['storage_path']}")
            old_blob.delete()
            # Delete from firestore
            db.collection('files').document(existing_file.id).delete()
    
    # Calculate file hash
    file_content = file.read()
    file_hash = hashlib.md5(file_content).hexdigest()
    
    # Reset file pointer to beginning
    file.seek(0)
    
    # Upload to Firebase Storage
    storage_path = f"{current_path}/{file.filename}".replace('//', '/')
    blob = bucket.blob(f"{uid}/{storage_path}")
    blob.upload_from_file(file)
    
    # Add to Firestore
    db.collection('files').document().set({
        'user_id': uid,
        'name': file.filename,
        'path': current_path,
        'storage_path': storage_path,
        'size': len(file_content),
        'content_type': file.content_type,
        'hash': file_hash,
        'created_at': firestore.SERVER_TIMESTAMP
    })
    
    return jsonify({'success': True, 'message': 'File uploaded successfully'})

@app.route('/delete-file', methods=['POST'])
def delete_file():
    """Delete a file"""
    data = request.json
    uid = data.get('uid')
    file_id = data.get('file_id')
    
    # Get file
    file_ref = db.collection('files').document(file_id)
    file = file_ref.get()
    
    if not file.exists:
        return jsonify({'success': False, 'message': 'File not found'})
    
    file_data = file.to_dict()
    
    # Delete from storage
    blob = bucket.blob(f"{uid}/{file_data['storage_path']}")
    blob.delete()
    
    # Delete from firestore
    file_ref.delete()
    
    return jsonify({'success': True, 'message': 'File deleted successfully'})

@app.route('/get-download-url', methods=['POST'])
def get_download_url():
    """Get a temporary download URL for a file"""
    data = request.json
    uid = data.get('uid')
    file_id = data.get('file_id')
    
    # Get file
    file_ref = db.collection('files').document(file_id)
    file = file_ref.get()
    
    if not file.exists:
        return jsonify({'success': False, 'message': 'File not found'})
    
    file_data = file.to_dict()
    
    # Generate download URL
    blob = bucket.blob(f"{uid}/{file_data['storage_path']}")
    download_url = blob.generate_signed_url(
        version="v4",
        expiration=300,  # 5 minutes
        method="GET"
    )
    
    return jsonify({
        'success': True, 
        'url': download_url, 
        'filename': file_data['name']
    })

@app.route('/find-duplicates', methods=['POST'])
def find_duplicates():
    """Find duplicate files in the current directory"""
    data = request.json
    uid = data.get('uid')
    current_path = data.get('path', '/')
    
    # Get all files in the current directory
    files = db.collection('files').where('user_id', '==', uid).where('path', '==', current_path).stream()
    
    # Map of hashes to files
    hash_map = {}
    duplicates = []
    
    for file in files:
        file_data = file.to_dict()
        file_hash = file_data['hash']
        file_data['id'] = file.id
        
        if file_hash in hash_map:
            # This is a duplicate
            if len(hash_map[file_hash]) == 1:
                # First duplicate found, add the original to the duplicates list
                duplicates.append(hash_map[file_hash][0])
            duplicates.append(file_data)
            hash_map[file_hash].append(file_data)
        else:
            hash_map[file_hash] = [file_data]
    
    return jsonify({'success': True, 'duplicates': duplicates})

@app.route('/find-all-duplicates', methods=['POST'])
def find_all_duplicates():
    """Find all duplicate files in user's dropbox"""
    data = request.json
    uid = data.get('uid')
    
    # Get all files for this user
    files = db.collection('files').where('user_id', '==', uid).stream()
    
    # Map of hashes to files
    hash_map = {}
    
    for file in files:
        file_data = file.to_dict()
        file_hash = file_data['hash']
        file_data['id'] = file.id
        
        if file_hash in hash_map:
            hash_map[file_hash].append(file_data)
        else:
            hash_map[file_hash] = [file_data]
    
    # Extract duplicate groups (2 or more files with same hash)
    duplicate_groups = []
    for file_hash, files in hash_map.items():
        if len(files) > 1:
            duplicate_groups.append(files)
    
    return jsonify({'success': True, 'duplicate_groups': duplicate_groups})

@app.route('/share-file', methods=['POST'])
def share_file():
    """Share a file with another user"""
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'})
        
    uid = data.get('uid')
    file_id = data.get('file_id')
    share_email = data.get('share_email')
    
    # Validate required fields
    if not uid or not file_id or not share_email:
        return jsonify({'success': False, 'message': 'Missing required fields'})
    
    # Validate email format
    if not re.match(r"[^@]+@[^@]+\.[^@]+", share_email):
        return jsonify({'success': False, 'message': 'Invalid email format'})
    
    # Default expiration is 30 days from now
    expiration_seconds = data.get('expiration_days', 30) * 24 * 60 * 60
    expiration_date = datetime.datetime.now() + datetime.timedelta(seconds=expiration_seconds)
    
    # Find user to share with
    users = db.collection('users').where('email', '==', share_email).get()
    
    if len(users) == 0:
        return jsonify({'success': False, 'message': 'User not found. Make sure the email is registered in the system.'})
    
    share_uid = users[0].id
    
    # Prevent sharing with yourself
    if share_uid == uid:
        return jsonify({'success': False, 'message': 'Cannot share with yourself'})
    
    try:
        # Check if already shared
        existing_shares = db.collection('shared_files').where('file_id', '==', file_id).where('shared_with', '==', share_uid).get()
        if len(existing_shares) > 0:
            return jsonify({'success': False, 'message': 'File already shared with this user'})
        
        # Get file info
        file_ref = db.collection('files').document(file_id)
        file = file_ref.get()
        
        if not file.exists:
            return jsonify({'success': False, 'message': 'File not found'})
        
        file_data = file.to_dict()
        
        # Verify the file belongs to the current user
        if file_data['user_id'] != uid:
            return jsonify({'success': False, 'message': 'You cannot share a file you do not own'})
        
        # Verify file exists in storage
        blob = bucket.blob(f"{uid}/{file_data['storage_path']}")
        if not blob.exists():
            return jsonify({'success': False, 'message': 'File not found in storage'})
        
        # Get owner's email
        owner = db.collection('users').document(uid).get()
        owner_email = owner.to_dict().get('email', 'Unknown User')
        
        # Create share record
        share_ref = db.collection('shared_files').document()
        share_ref.set({
            'file_id': file_id,
            'owner_id': uid,
            'owner_email': owner_email,
            'shared_with': share_uid,
            'file_name': file_data['name'],
            'file_path': file_data['storage_path'],
            'created_at': firestore.SERVER_TIMESTAMP,
            'expires_at': expiration_date
        })
        
        return jsonify({
            'success': True, 
            'message': f'File shared successfully with {share_email}', 
            'expires_at': expiration_date.isoformat(),
            'share_id': share_ref.id
        })
    except Exception as e:
        print(f"Error sharing file: {str(e)}")
        return jsonify({'success': False, 'message': f'Error sharing file: {str(e)}'})

@app.route('/get-shared-files', methods=['POST'])
def get_shared_files():
    """Get files shared with the current user"""
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'})
    
    uid = data.get('uid')
    if not uid:
        return jsonify({'success': False, 'message': 'User ID is required'})
    
    print(f"Fetching shared files for user: {uid}")
    
    try:
        # Get current time for expiration check
        current_time = datetime.datetime.now()
        
        # Get shared files
        shared_files = db.collection('shared_files').where('shared_with', '==', uid).stream()
        
        result = []
        expired_shares = []
        
        for shared in shared_files:
            share_data = shared.to_dict()
            share_data['id'] = shared.id
            
            print(f"Found shared file: {share_data.get('file_name', 'Unknown')} (ID: {shared.id})")
            
            # Check if share has expired
            if 'expires_at' in share_data:
                try:
                    # Convert to datetime if it's a timestamp
                    if isinstance(share_data['expires_at'], firestore.SERVER_TIMESTAMP.__class__):
                        expiration = datetime.datetime.fromtimestamp(share_data['expires_at'].seconds)
                    else:
                        # Already a datetime
                        expiration = share_data['expires_at']
                        
                    # If expired, mark for deletion
                    if expiration < current_time:
                        print(f"Share expired: {shared.id}")
                        expired_shares.append(shared.id)
                        continue
                except Exception as e:
                    print(f"Error checking expiration: {str(e)}")
                    # Don't skip the file if there's an error with expiration
            
            # Add remaining time info for UI
            if 'expires_at' in share_data:
                try:
                    # Try to convert the expiration date to a string
                    if isinstance(share_data['expires_at'], datetime.datetime):
                        share_data['expires_at_string'] = share_data['expires_at'].strftime("%Y-%m-%d")
                    elif hasattr(share_data['expires_at'], 'seconds'):
                        share_data['expires_at_string'] = datetime.datetime.fromtimestamp(
                            share_data['expires_at'].seconds
                        ).strftime("%Y-%m-%d")
                except Exception as e:
                    print(f"Error formatting expiration date: {str(e)}")
                    # If conversion fails, provide a default
                    share_data['expires_at_string'] = "Unknown"
            
            # Verify file still exists in storage before adding to results
            try:
                if 'owner_id' in share_data and 'file_path' in share_data:
                    blob = bucket.blob(f"{share_data['owner_id']}/{share_data['file_path']}")
                    if not blob.exists():
                        print(f"Storage file doesn't exist for share: {shared.id}")
                        # Add a flag to indicate the file is missing, but still show it
                        share_data['file_missing'] = True
            except Exception as e:
                print(f"Error checking file existence: {str(e)}")
                # Still include the file with a flag
                share_data['file_missing'] = True
            
            result.append(share_data)
        
        # Delete expired shares
        for share_id in expired_shares:
            db.collection('shared_files').document(share_id).delete()
        
        print(f"Returning {len(result)} shared files to user {uid}")
        return jsonify({'success': True, 'shared_files': result})
    except Exception as e:
        print(f"Error getting shared files: {str(e)}")
        return jsonify({'success': False, 'message': f'Error loading shared files: {str(e)}'})

@app.route('/get-shared-file-url', methods=['POST'])
def get_shared_file_url():
    """Get a download URL for a shared file"""
    data = request.json
    if not data:
        return jsonify({'success': False, 'message': 'No data provided'})
        
    uid = data.get('uid')
    share_id = data.get('share_id')
    
    # Validate required fields
    if not uid or not share_id:
        return jsonify({'success': False, 'message': 'Missing required fields'})
    
    try:
        # Get share record
        share_ref = db.collection('shared_files').document(share_id)
        share = share_ref.get()
        
        if not share.exists:
            return jsonify({'success': False, 'message': 'Shared file not found'})
        
        share_data = share.to_dict()
        
        # Verify this is shared with the current user
        if share_data['shared_with'] != uid:
            return jsonify({'success': False, 'message': 'Access denied'})
        
        # Check for expiration date
        if 'expires_at' in share_data:
            try:
                # Convert to datetime if it's a timestamp
                if isinstance(share_data['expires_at'], firestore.SERVER_TIMESTAMP.__class__):
                    expiration = datetime.datetime.fromtimestamp(share_data['expires_at'].seconds)
                else:
                    # Already a datetime
                    expiration = share_data['expires_at']
                    
                # If expired, don't allow download
                if expiration < datetime.datetime.now():
                    # Remove the share since it's expired
                    share_ref.delete()
                    return jsonify({'success': False, 'message': 'This shared file has expired and is no longer available'})
            except Exception as e:
                print(f"Error checking expiration: {str(e)}")
                # Continue anyway if we can't check expiration
        
        # Check if the original file still exists
        file_ref = db.collection('files').document(share_data.get('file_id', ''))
        file = file_ref.get()
        
        if not file.exists:
            return jsonify({'success': False, 'message': 'The original file has been deleted by the owner'})
            
        # Check if the file still exists in storage
        blob = bucket.blob(f"{share_data['owner_id']}/{share_data['file_path']}")
        
        # Verify the file exists
        if not blob.exists():
            return jsonify({'success': False, 'message': 'This file is no longer available. The owner may have deleted it.'})
        
        # Generate download URL
        download_url = blob.generate_signed_url(
            version="v4",
            expiration=300,  # 5 minutes
            method="GET"
        )
        
        return jsonify({
            'success': True, 
            'url': download_url, 
            'filename': share_data['file_name']
        })
    except Exception as e:
        print(f"Error getting shared file URL: {str(e)}")
        return jsonify({'success': False, 'message': f'Error downloading file: {str(e)}'})

@app.route('/remove-shared-file', methods=['POST'])
def remove_shared_file():
    """Remove a file from the user's shared files"""
    data = request.json
    uid = data.get('uid')
    share_id = data.get('share_id')
    
    # Get share record
    share_ref = db.collection('shared_files').document(share_id)
    share = share_ref.get()
    
    if not share.exists:
        return jsonify({'success': False, 'message': 'Shared file not found'})
    
    share_data = share.to_dict()
    
    # Verify this is shared with the current user
    if share_data['shared_with'] != uid:
        return jsonify({'success': False, 'message': 'Access denied'})
    
    # Delete the share record
    share_ref.delete()
    
    return jsonify({'success': True, 'message': 'File removed from shared files'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)
