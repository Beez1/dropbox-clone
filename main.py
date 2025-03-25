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
cred = credentials.Certificate({
    "type": os.getenv("FIREBASE_TYPE"),
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
})

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
    
@app.route("/delete-file", methods=["POST"])
def delete_file():
    data = request.get_json()
    uid = data.get("uid")
    path = data.get("path")
    name = data.get("name")

    # Delete file from storage
    blob_path = f"{uid}{path}{name}"
    blob = bucket.blob(blob_path)
    if blob.exists():
        blob.delete()

    # Delete file metadata from Firestore
    files = db.collection("Files") \
              .where("user_id", "==", uid) \
              .where("path", "==", path) \
              .where("name", "==", name) \
              .stream()

    for f in files:
        f.reference.delete()

    return jsonify({"message": f"🗑️ File '{name}' deleted."})

    
@app.route("/list-files")
def list_files():
    uid = request.args.get("uid")
    path = request.args.get("path")

    # Fetch all files in this directory
    files = db.collection("Files") \
              .where("user_id", "==", uid) \
              .where("path", "==", path) \
              .stream()

    files_list = []
    hash_count = {}

    # First pass: build hash counts
    for f in files:
        data = f.to_dict()
        hash_val = data.get("hash_value")
        hash_count[hash_val] = hash_count.get(hash_val, 0) + 1
        files_list.append(data)

    # Second pass: mark duplicates
    for f in files_list:
        f["is_duplicate"] = hash_count.get(f["hash_value"], 0) > 1

    return jsonify(files_list)

@app.route("/duplicate-files-global")
def duplicate_files_global():
    uid = request.args.get("uid")
    
    files = db.collection("Files") \
              .where("user_id", "==", uid) \
              .stream()
    
    hash_map = {}
    for f in files:
        data = f.to_dict()
        h = data.get("hash_value")
        if h:
            if h not in hash_map:
                hash_map[h] = []
            hash_map[h].append({
                "name": data["name"],
                "path": data["path"],
                "download_url": data["download_url"]
            })
    
    # Keep only duplicates
    duplicates = {h: v for h, v in hash_map.items() if len(v) > 1}
    
    return jsonify(duplicates)


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

@app.route("/check-file")
def check_file():
    uid = request.args.get("uid")
    path = request.args.get("path")
    name = request.args.get("name")

    files = db.collection("Files") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .where("name", "==", name) \
        .stream()

    exists = any(True for _ in files)

    return jsonify({"exists": exists})


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
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/directory", methods=["DELETE"])
def delete_directory():
    data = request.get_json()
    uid = data.get("uid")
    path = data.get("path")

    # Check for subdirectories
    subdirs = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("path", ">=", path + "/") \
        .where("path", "<", path + "0") \
        .limit(1) \
        .stream()

    if any(subdirs):
        return jsonify({"message": "❌ Directory contains subdirectories."}), 400

    # Check for files
    files = db.collection("Files") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .limit(1) \
        .stream()

    if any(files):
        return jsonify({"message": "❌ Directory contains files."}), 400

    # Delete the directory
    db.collection("Directories") \
       .where("user_id", "==", uid) \
       .where("path", "==", path) \
       .get()[0].reference.delete()

    return jsonify({"message": "✅ Directory deleted."})

@app.route("/list-directories")
def list_directories():
    uid = request.args.get("uid")
    path = request.args.get("path", "/")
    
    query = db.collection("Directories") \
        .where("user_id", "==", uid) \
        .where("parent_path", "==", path)
    
    directories = [doc.to_dict() for doc in query.stream()]
    return jsonify(directories)

@app.route("/upload", methods=["POST"])
def upload_file():
    file = request.files.get("file")
    uid = request.form.get("uid")
    path = request.form.get("path", "/")
    
    if not file:
        return jsonify({"message": "No file uploaded."}), 400
    
    filename = secure_filename(file.filename)
    blob_path = f"{uid}{path}{filename}"
    
    # 🔍 Delete existing Firestore metadata if exists
    existing = db.collection("Files") \
        .where("user_id", "==", uid) \
        .where("path", "==", path) \
        .where("name", "==", filename) \
        .stream()
    
    for f in existing:
        f.reference.delete()
    
    # 🔥 Delete old file in Firebase Storage (optional safety)
    old_blob = bucket.blob(blob_path)
    if old_blob.exists():
        old_blob.delete()
    
    # 🆕 Upload file
    blob = bucket.blob(blob_path)
    blob.upload_from_file(file)
    # ✅ Make file public
    blob.make_public()
    
    # 🧠 Hash file for duplication tracking
    file.seek(0)
    file_bytes = file.read()
    hash_val = hashlib.md5(file_bytes).hexdigest()
    
    # 🔐 Store metadata
    db.collection("Files").add({
        "name": filename,
        "path": path,
        "user_id": uid,
        "download_url": blob.public_url,
        "hash_value": hash_val
    })
    
    return jsonify({"message": f"✅ File '{filename}' uploaded to {path}."})

@app.route("/firebase-config")
def firebase_config():
    return jsonify({
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
    })

if __name__ == "__main__":
    app.run(debug=True)