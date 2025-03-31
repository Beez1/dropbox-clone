from firebase_admin import firestore, storage
import hashlib
import io

db = firestore.client()
bucket = storage.bucket()

def upload_file(user_id, file, path, filename=None, overwrite=False):
    """
    Upload a file to the user's storage and save metadata in Firestore.
    
    Args:
        user_id: User ID
        file: File object to upload
        path: Directory path where the file should be stored
        filename: Custom filename (optional, default is file's original name)
        overwrite: Whether to overwrite if file already exists
    
    Returns:
        File document reference
    
    Raises:
        ValueError: If file already exists and overwrite is False
    """
    # Ensure path ends with /
    if not path.endswith('/'):
        path += '/'
    
    # Use the provided filename or the original name
    name = filename or file.filename
    
    # Check if file already exists
    if not overwrite:
        existing_files = db.collection("Files") \
            .where("user_id", "==", user_id) \
            .where("path", "==", path) \
            .where("name", "==", name) \
            .get()
        
        if len(existing_files) > 0:
            raise ValueError(f"File '{name}' already exists in '{path}'")
    else:
        # Delete existing file if overwriting
        existing_files = db.collection("Files") \
            .where("user_id", "==", user_id) \
            .where("path", "==", path) \
            .where("name", "==", name) \
            .get()
        
        for doc in existing_files:
            doc.reference.delete()
        
        # Also delete the blob
        blob_path = f"{user_id}{path}{name}"
        blob = bucket.blob(blob_path)
        if blob.exists():
            blob.delete()
    
    # Read file content for hashing
    file_content = file.read()
    
    # Create a hash of the file content
    hash_value = hashlib.sha256(file_content).hexdigest()
    
    # Reset file cursor
    file.seek(0)
    
    # Upload to storage
    blob_path = f"{user_id}{path}{name}"
    blob = bucket.blob(blob_path)
    blob.upload_from_file(file)
    
    # Make the blob publicly accessible
    blob.make_public()
    
    # Save metadata to Firestore
    file_ref = db.collection("Files").add({
        "name": name,
        "path": path,
        "user_id": user_id,
        "download_url": blob.public_url,
        "hash_value": hash_value,
        "size": len(file_content),
        "created_at": firestore.SERVER_TIMESTAMP
    })
    
    return file_ref

def get_files(user_id, path):
    """
    Get all files in a specific directory for a user.
    
    Args:
        user_id: User ID
        path: Directory path
    
    Returns:
        List of file documents
    """
    # Ensure path ends with /
    if not path.endswith('/'):
        path += '/'
    
    files = db.collection("Files") \
        .where("user_id", "==", user_id) \
        .where("path", "==", path) \
        .get()
    
    files_list = [doc.to_dict() for doc in files]
    
    # Mark duplicates based on hash_value
    hash_count = {}
    for file in files_list:
        hash_val = file.get("hash_value")
        hash_count[hash_val] = hash_count.get(hash_val, 0) + 1
    
    for file in files_list:
        file["is_duplicate"] = hash_count.get(file["hash_value"], 0) > 1
    
    return files_list

def delete_file(user_id, path, name):
    """
    Delete a file from both storage and Firestore.
    
    Args:
        user_id: User ID
        path: Directory path
        name: File name
    
    Returns:
        True if the file was deleted, False if not found
    """
    # Ensure path ends with /
    if not path.endswith('/'):
        path += '/'
    
    # Delete from Firestore
    files = db.collection("Files") \
        .where("user_id", "==", user_id) \
        .where("path", "==", path) \
        .where("name", "==", name) \
        .get()
    
    if not files:
        return False
    
    for doc in files:
        doc.reference.delete()
    
    # Delete from storage
    blob_path = f"{user_id}{path}{name}"
    blob = bucket.blob(blob_path)
    if blob.exists():
        blob.delete()
    
    return True

def find_global_duplicates(user_id):
    """
    Find all duplicate files across the user's entire storage based on hash values.
    
    Args:
        user_id: User ID
    
    Returns:
        Dictionary of hash values mapped to lists of file documents
    """
    files = db.collection("Files") \
        .where("user_id", "==", user_id) \
        .get()
    
    hash_map = {}
    
    for doc in files:
        file_data = doc.to_dict()
        hash_val = file_data.get("hash_value")
        
        if hash_val:
            if hash_val not in hash_map:
                hash_map[hash_val] = []
            
            hash_map[hash_val].append({
                "name": file_data["name"],
                "path": file_data["path"],
                "download_url": file_data["download_url"],
                "size": file_data.get("size", 0)
            })
    
    # Filter out non-duplicates
    return {h: files for h, files in hash_map.items() if len(files) > 1}