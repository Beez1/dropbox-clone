// Global variables
let currentPath = '/';
let isInSharedDirectory = false;
let isOnline = navigator.onLine;

// DOM element references
const fileList = document.getElementById('file-list');
const directoryList = document.getElementById('directory-list');
const currentPathDisplay = document.getElementById('current-path');
const fileUploadForm = document.getElementById('file-upload-form');
const createDirForm = document.getElementById('create-directory-form');
const shareFileForm = document.getElementById('share-file-form');
const confirmationModal = document.getElementById('confirmation-modal');
const duplicatesContainer = document.getElementById('duplicates-container');
const allDuplicatesContainer = document.getElementById('all-duplicates-container');
const sharedFilesContainer = document.getElementById('shared-files-container');

// Detect network status changes
window.addEventListener('online', handleNetworkChange);
window.addEventListener('offline', handleNetworkChange);

function handleNetworkChange() {
  isOnline = navigator.onLine;
  if (isOnline) {
    showNotification('You are back online', 'success');
    // Reload current view to refresh data
    if (currentUser) {
      loadCurrentDirectory(currentPath);
    }
  } else {
    showNotification('You are offline. Some features may not work.', 'warning');
  }
}

// Check network before making requests
function checkNetworkBeforeRequest() {
  if (!isOnline) {
    showNotification('Cannot perform this action while offline', 'error');
    return false;
  }
  return true;
}

// Load contents of the current directory
function loadCurrentDirectory(path) {
  // Check network status
  if (!checkNetworkBeforeRequest()) {
    return;
  }
  
  // If entering or leaving shared directory, set flag
  isInSharedDirectory = (path === '/shared');
  
  currentPath = path;
  currentPathDisplay.textContent = currentPath;
  
  // If we're in the shared directory, load shared files
  if (isInSharedDirectory) {
    loadSharedFiles();
    return;
  }
  
  // Load directories
  loadDirectories();
  
  // Load files
  loadFiles();
  
  // Update breadcrumb navigation
  updateBreadcrumbs();
}

// Load directories in the current path
function loadDirectories() {
  if (!currentUser) return;
  
  fetch('/get-directories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      path: currentPath
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      renderDirectories(data.directories);
    } else {
      console.error('Error loading directories:', data.message);
    }
  })
  .catch(error => {
    console.error('Error loading directories:', error);
  });
}

// Load files in the current path
function loadFiles() {
  if (!currentUser) return;
  
  fetch('/get-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      path: currentPath
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      renderFiles(data.files);
    } else {
      console.error('Error loading files:', data.message);
    }
  })
  .catch(error => {
    console.error('Error loading files:', error);
  });
}

// Initialize user in backend
function initializeUser(user) {
  fetch('/init-user', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: user.uid,
      email: user.email
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('User initialized:', data.message);
    } else {
      console.error('Error initializing user:', data.message);
    }
  })
  .catch(error => {
    console.error('Error initializing user:', error);
  });
}

// Show notification message
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  
  let icon = '';
  if (type === 'success') {
    icon = '<i class="fas fa-check-circle"></i> ';
  } else if (type === 'error') {
    icon = '<i class="fas fa-exclamation-circle"></i> ';
  } else if (type === 'warning') {
    icon = '<i class="fas fa-exclamation-triangle"></i> ';
  } else if (type === 'info') {
    icon = '<i class="fas fa-info-circle"></i> ';
  }
  
  notification.innerHTML = icon + message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  if (notification.timeoutId) {
    clearTimeout(notification.timeoutId);
  }
  
  notification.timeoutId = setTimeout(() => {
    notification.style.display = 'none';
  }, 4000);
}