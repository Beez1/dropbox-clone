class File:
    def __init__(self, name, path, user_id, download_url, hash_value):
        self.name = name
        self.path = path
        self.user_id = user_id
        self.download_url = download_url
        self.hash_value = hash_value