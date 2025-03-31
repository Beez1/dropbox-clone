import os
import requests
import hashlib
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
from services.auth_service import create_user_if_not_exists  
from werkzeug.utils import secure_filename

# Load environment variables
load_dotenv()

# Initialize Firebase Admin
try:
    # First try to use the .env variables with the Google_ prefix
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.getenv("GOOGLE_PROJECT_ID"),
        "private_key_id": os.getenv("GOOGLE_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GOOGLE_PRIVATE_KEY"),
        "client_email": os.getenv("GOOGLE_CLIENT_EMAIL"),
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": os.getenv("GOOGLE_CLIENT_X509_CERT_URL")
    })
except Exception as e:
    print(f"Failed to initialize Firebase with first method: {e}")
    # Fallback to JSON file if available
    try:
        cred = credentials.Certificate("Dropboxclone Firebase Admin SDK.json")
    except Exception as e:
        print(f"Failed to initialize Firebase with JSON file: {e}")
        raise

# Initialize Firebase app
firebase_admin.initialize_app(cred, {
    'storageBucket': os.getenv("FIREBASE_STORAGE_BUCKET")
})

# Setup Flask and Firebase clients
app = Flask(__name__)
db = firestore.client()
bucket = storage.bucket()
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY")

# ----- ROUTES -----

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/firebase-config")
def firebase_config():
    """Return Firebase configuration to the client"""
    return jsonify({
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    })

@app.route("/signup", methods=["POST"])
def signup():
    email = request.form.get("email")
    password = request.form.get("password")
    
    try:
        user = auth.create_user(email=email, password=password)
        print("✅ User created:", user.uid)
        create_user_if_not_exists(user.uid, email)
        return "Signup successful. You can now log in."
    except Exception as e:
        return f"Signup failed: {e}", 400

@app.route("/login", methods=["POST"])
def login():
    # Handle regular form submission
    if request.content_type and "form" in request.content_type:
        email = request.form.get("email")
        password = request.form.get("password")
        
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }
        
        try:
            res = requests.post(
                f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}",
                json=payload
            )
            
            data = res.json()
            if "error" in data:
                raise Exception(data["error"]["message"])
            
            id_token = data["idToken"]
            decoded = auth.verify_id_token(id_token)
            uid = decoded["uid"]
            create_user_if_not_exists(uid, email)
            
            return jsonify({
                "message": f"✅ Login successful for {email}",
                "uid": uid
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 401
    
    # Handle ID token from Firebase client SDK
    data = request.get_json()
    if data and "idToken" in data:
        try:
            id_token = data["idToken"]
            decoded = auth.verify_id_token(id_token)
            uid = decoded["uid"]
            email = decoded.get("email", "")
            create_user_if_not_exists(uid, email)
            
            return jsonify({
                "message": f"✅ Login successful",
                "uid": uid
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 401
    
    return jsonify({"error": "Invalid request format"}), 400

@app.route("/delete-file", methods=["POST"])
def delete_file():
    data = request.get_json()
    uid = data.get("uid")
    path = data.get("path")
    name = data.get("name")
    
    from services.file_service import delete_file
    success = delete_file(uid, path, name)
    
    if success:
        return jsonify({"message": f"File '{name}' deleted successfully"})
    else:
        return jsonify({"error": "File not found"}), 404

@app.route("/list-files")
def list_files():
    uid = request.args.get("uid")
    path = request.args.get("path")
    
    from services.file_service import get_files
    files_list = get_files(uid, path)
    
    return jsonify(files_list)

@app.route("/duplicate-files-global")
def duplicate_files_global():
    uid = request.args.get("uid")
    
    from services.file_service import find_global_duplicates
    duplicates = find_global_duplicates(uid)
    
    return jsonify(duplicates)

@app.route("/check-file")
def check_file():
    uid = request.args.get("uid")
    path = request.args.get("path")
    name = request.args.get("name")
    
    # Check if file exists
    files = db.collection("Files") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .where("name", "==", name) \
        .limit(1) \
        .get()
    
    exists = len(files) > 0
    
    return jsonify({"exists": exists})

def create_directory(uid, name, parent_path="/"):
    db = firestore.client()
    name = name.strip()
    if not name:
        raise ValueError("Directory name cannot be empty")
    
    if not parent_path.endswith("/"):
        parent_path += "/"
    
    path = parent_path.rstrip("/") + "/" + name
    
    db.collection("Directories").add({
        "name": name,
        "path": path,
        "parent_path": parent_path,
        "user_id": uid
    })

@app.route("/list-directories")
def list_directories():
    uid = request.args.get("uid")
    parent_path = request.args.get("parent_path", "/")
    
    from services.directory_service import get_directories
    directories = get_directories(uid, parent_path)
    
    return jsonify(directories)

@app.route("/directory", methods=["POST"])
def create_directory_route():
    try:
        data = request.get_json()
        uid = data.get("uid")
        name = data.get("name")
        parent_path = data.get("parent_path", "/")
        
        from services.directory_service import create_directory
        create_directory(uid, name, parent_path)
        
        return jsonify({"message": f"Directory '{name}' created in '{parent_path}'"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to create directory: {str(e)}"}), 500

@app.route("/directory", methods=["DELETE"])
def delete_directory():
    try:
        data = request.get_json()
        uid = data.get("uid")
        path = data.get("path")
        
        from services.directory_service import delete_directory
        success = delete_directory(uid, path)
        
        if success:
            return jsonify({"message": f"Directory '{path}' deleted successfully"})
        else:
            return jsonify({"error": "Directory not found"}), 404
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to delete directory: {str(e)}"}), 500

@app.route("/upload", methods=["POST"])
def upload_file():
    try:
        file = request.files.get("file")
        uid = request.form.get("uid")
        path = request.form.get("path")
        overwrite = request.form.get("overwrite", "false").lower() == "true"
        
        if not file or not uid or not path:
            return jsonify({"error": "Missing required parameters"}), 400
        
        from services.file_service import upload_file
        upload_file(uid, file, path, overwrite=overwrite)
        
        return jsonify({
            "message": f"File '{file.filename}' uploaded successfully to '{path}'"
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Failed to upload file: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)