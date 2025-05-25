# Dropbox Clone

A full-featured cloud storage application built with Flask and Firebase, featuring file upload/download, directory management, file sharing, and duplicate detection.

## 🚀 Quick Start

### Local Development

1. **Clone this repository**
   ```bash
   git clone <your-repo-url>
   cd dropbox-clone
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Firebase**
   - Create `local_constants.py` with your Firebase credentials
   - See `DEPLOYMENT.md` for detailed configuration

4. **Run the application**
   ```bash
   python3 run.py
   # or
   python3 app.py
   ```

5. **Access the app**
   - Open http://localhost:8080 in your browser

### Production Deployment

For deploying to Render or other platforms, see the comprehensive guide in `DEPLOYMENT.md`.

## 📁 Features

- 🔐 User authentication (Firebase Auth)
- 📂 Directory creation and navigation
- 📄 File upload/download with drag & drop
- 🔗 File sharing between users
- 🔍 Duplicate file detection
- 📱 Responsive mobile-friendly UI
- ☁️ Cloud storage (Firebase Storage)
- 🗄️ Metadata storage (Firestore)

## 🛠️ Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Database**: Firebase Firestore
- **Storage**: Firebase Cloud Storage
- **Authentication**: Firebase Auth
- **Deployment**: Render (via render.yaml)

## 📖 Documentation

- `DEPLOYMENT.md` - Complete deployment guide for Render
- `docs/` - Project documentation and requirements
