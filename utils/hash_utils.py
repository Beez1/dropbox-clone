import hashlib

def generate_hash(file_bytes):
    return hashlib.md5(file_bytes).hexdigest()