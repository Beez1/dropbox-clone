from firebase_admin import firestore
import firebase_admin

db = firestore.client()

def create_directory(user_id, name, parent_path):
    full_path = parent_path.rstrip('/') + '/' + name
    db.collection('Directories').add({
        'name': name,
        'path': full_path,
        'user_id': user_id
    })

