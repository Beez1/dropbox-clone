from firebase_admin import firestore, storage
from utils import hash_utils

db = firestore.client()
bucket = storage.bucket()

def upload_file(user_id, file, path):
    blob = bucket.blob(f"{user_id}/{path}/{file.filename}")
    blob.upload_from_file(file)
    hash_val = hash_utils.generate_hash(file.read())
    db.collection('Files').add({
        'name': file.filename,
        'path': path,
        'user_id': user_id,
        'download_url': blob.public_url,
        'hash_value': hash_val
    })