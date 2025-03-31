from firebase_admin import firestore
import firebase_admin

db = firestore.client()

def create_directory(uid, name, parent_path="/"):
    """
    Creates a new directory for a user.
    
    Args:
        uid: User ID
        name: Directory name
        parent_path: Parent directory path, defaults to root
    
    Returns:
        The newly created directory document
    
    Raises:
        ValueError: If directory name is empty or if directory already exists
    """
    db = firestore.client()
    name = name.strip()
    if not name:
        raise ValueError("Directory name cannot be empty")
    
    # Make sure parent_path ends with /
    if not parent_path.endswith("/"):
        parent_path += "/"
    
    # Calculate the full path
    path = parent_path + name
    
    # Check if directory already exists
    existing_dirs = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .limit(1) \
        .get()
    
    if len(existing_dirs) > 0:
        raise ValueError(f"Directory '{name}' already exists in '{parent_path}'")
    
    # Create the directory
    dir_ref = db.collection("Directories").add({
        "name": name,
        "path": path,
        "parent_path": parent_path,
        "user_id": uid
    })
    
    return dir_ref

def get_directories(uid, parent_path="/"):
    """
    Gets all directories under a parent path for a user.
    
    Args:
        uid: User ID
        parent_path: Parent directory path
    
    Returns:
        List of directories
    """
    db = firestore.client()
    
    # Make sure parent_path ends with /
    if not parent_path.endswith("/"):
        parent_path += "/"
    
    directories = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("parent_path", "==", parent_path) \
        .get()
    
    return [doc.to_dict() for doc in directories]

def delete_directory(uid, path):
    """
    Deletes a directory if it's empty (no files or subdirectories).
    
    Args:
        uid: User ID
        path: Directory path to delete
    
    Returns:
        True if deleted, False if not found
    
    Raises:
        ValueError: If directory contains files or subdirectories
    """
    db = firestore.client()
    
    # Check for subdirectories
    subdirs = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("parent_path", "==", path + "/") \
        .limit(1) \
        .get()
    
    if len(subdirs) > 0:
        raise ValueError("Directory contains subdirectories and cannot be deleted")
    
    # Check for files
    files = db.collection("Files") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .limit(1) \
        .get()
    
    if len(files) > 0:
        raise ValueError("Directory contains files and cannot be deleted")
    
    # Find and delete the directory
    dirs = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .get()
    
    if not dirs:
        return False
    
    dirs[0].reference.delete()
    return True
