from firebase_admin import firestore
import firebase_admin

db = firestore.client()

def create_directory(uid, name, parent_path="/"):
    db = firestore.client()
    path = parent_path.rstrip("/") + "/" + name
    db.collection("Directories").add({
        "name": name,
        "path": path,
        "parent_path": parent_path,
        "user_id": uid
    })
