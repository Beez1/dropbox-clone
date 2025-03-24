from firebase_admin import firestore

def create_user_if_not_exists(uid, email):
    db = firestore.client()  # ✅ move this INSIDE the function!
    user_ref = db.collection('Users').document(uid)
    if not user_ref.get().exists:
        user_ref.set({
            'email': email,
            'root_path': '/',
        })
        db.collection('Directories').add({
            'name': '/',
            'path': '/',
            'user_id': uid
        })
