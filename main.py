import os
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
from services.auth_service import create_user_if_not_exists  

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

@app.route("/directory", methods=["POST"])
def create_directory():
    data = request.get_json()
    uid = data.get("uid")
    name = data.get("name")
    parent_path = data.get("parent_path", "/")

    from services.directory_service import create_directory
    create_directory(uid, name, parent_path)

    return jsonify({"message": "Directory created."})

@app.route("/directory", methods=["DELETE"])
def delete_directory():
    data = request.get_json()
    uid = data.get("uid")
    path = data.get("path")

    db.collection("Directories") \
      .where("user_id", "==", uid) \
      .where("path", "==", path) \
      .get()[0].reference.delete()

    return jsonify({"message": "Directory deleted."})

@app.route("/firebase-config")
def firebase_config():
    return jsonify({
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
    })

if __name__ == "__main__":
    app.run(debug=True)