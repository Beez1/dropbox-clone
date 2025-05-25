#!/usr/bin/env python3
"""
Local development server for Dropbox Clone
"""
import os
import sys
from app import app

def main():
    """Run the Flask development server"""
    # Set development environment
    os.environ.setdefault('FLASK_ENV', 'development')
    os.environ.setdefault('FLASK_DEBUG', '1')
    
    # Check if local_constants.py exists
    if not os.path.exists('local_constants.py'):
        print("❌ Error: local_constants.py not found!")
        print("📝 Please create local_constants.py with your Firebase credentials.")
        print("📖 See DEPLOYMENT.md for configuration details.")
        sys.exit(1)
    
    print("🚀 Starting Dropbox Clone development server...")
    print("📱 Access the app at: http://localhost:8080")
    print("🔧 Debug mode: ON")
    print("⏹️  Press Ctrl+C to stop")
    
    try:
        app.run(
            host='0.0.0.0',
            port=8080,
            debug=True,
            use_reloader=True
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main() 