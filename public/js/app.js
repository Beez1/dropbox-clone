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
const shareFileFormContainer = document.getElementById('share-file-form');
const shareFileForm = document.getElementById('share-file-form-element');
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
  
  // Remove shared-files-layout class when not in shared directory
  fileList.classList.remove('shared-files-layout');
  
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

// Render directories in the UI
function renderDirectories(directories) {
  directoryList.innerHTML = '';
  
  directories.forEach(dir => {
    const dirElement = document.createElement('div');
    dirElement.className = 'directory-item';
    
    // Special parent directory entry styling
    if (dir.is_special) {
      dirElement.classList.add('special-directory');
    }
    
    dirElement.innerHTML = `
      <div class="directory-icon">
        <i class="fas fa-folder"></i>
      </div>
      <div class="directory-name">${dir.name}</div>
      ${!dir.is_special ? `
        <div class="directory-actions">
          <button class="btn-delete" data-id="${dir.id}" title="Delete directory">
            <i class="fas fa-trash"></i>
          </button>
        </div>` : ''}
    `;
    
    // Add click event to navigate into directory
    dirElement.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-delete') || e.target.closest('.btn-delete')) {
        e.stopPropagation();
        deleteDirectory(dir.id);
        return;
      }
      
      navigateToDirectory(dir.id);
    });
    
    directoryList.appendChild(dirElement);
  });
}

// Navigate to a directory
function navigateToDirectory(directoryId) {
  fetch('/navigate-directory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      directory_id: directoryId,
      current_path: currentPath
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      loadCurrentDirectory(data.path);
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error navigating to directory:', error);
  });
}

// Delete a directory
function deleteDirectory(directoryId) {
  if (confirm('Are you sure you want to delete this directory?')) {
    fetch('/delete-directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        directory_id: directoryId
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('Directory deleted');
        loadDirectories();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error deleting directory:', error);
      showNotification('Error deleting directory', 'error');
    });
  }
}

// Create a new directory
function createDirectory(directoryName) {
  // Validate directory name (alphanumeric, spaces, underscores, and hyphens only)
  const validNamePattern = /^[a-zA-Z0-9_\-\s]+$/;
  if (!validNamePattern.test(directoryName)) {
    showNotification('Directory name can only contain letters, numbers, spaces, hyphens, and underscores', 'error');
    return;
  }
  
  if (directoryName === '.' || directoryName === '..') {
    showNotification('Directory name cannot be "." or ".."', 'error');
    return;
  }
  
  fetch('/create-directory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      current_path: currentPath,
      directory_name: directoryName
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Directory created');
      createDirForm.reset();
      loadDirectories();
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error creating directory:', error);
    showNotification('Error creating directory', 'error');
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
      checkForDuplicates();
    } else {
      console.error('Error loading files:', data.message);
    }
  })
  .catch(error => {
    console.error('Error loading files:', error);
  });
}

// Render files in the UI
function renderFiles(files) {
  fileList.innerHTML = '';
  
  if (files.length === 0) {
    fileList.innerHTML = '<div class="empty-message">No files in this directory</div>';
    return;
  }
  
  files.forEach(file => {
    const fileElement = document.createElement('div');
    fileElement.className = 'file-item';
    fileElement.dataset.id = file.id;
    fileElement.dataset.hash = file.hash;
    
    const fileIcon = getFileIcon(file.name);
    const fileSize = formatFileSize(file.size);
    
    fileElement.innerHTML = `
      <div class="file-icon">
        <i class="${fileIcon}"></i>
      </div>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-details">${fileSize}</div>
      </div>
      <div class="file-actions">
        <button class="btn-download" data-id="${file.id}" title="Download file">
          <i class="fas fa-download"></i>
        </button>
        <button class="btn-share" data-id="${file.id}" title="Share file">
          <i class="fas fa-share-alt"></i>
        </button>
        <button class="btn-delete" data-id="${file.id}" title="Delete file">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    // Add event listeners
    const downloadBtn = fileElement.querySelector('.btn-download');
    downloadBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      downloadFile(file.id);
    });
    
    const shareBtn = fileElement.querySelector('.btn-share');
    shareBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      showShareForm(file.id, file.name);
    });
    
    const deleteBtn = fileElement.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteFile(file.id);
    });
    
    fileList.appendChild(fileElement);
  });
}

// Get appropriate icon for file type
function getFileIcon(fileName) {
  const extension = fileName.split('.').pop().toLowerCase();
  
  const iconMap = {
    'pdf': 'fas fa-file-pdf',
    'doc': 'fas fa-file-word',
    'docx': 'fas fa-file-word',
    'xls': 'fas fa-file-excel',
    'xlsx': 'fas fa-file-excel',
    'ppt': 'fas fa-file-powerpoint',
    'pptx': 'fas fa-file-powerpoint',
    'jpg': 'fas fa-file-image',
    'jpeg': 'fas fa-file-image',
    'png': 'fas fa-file-image',
    'gif': 'fas fa-file-image',
    'mp3': 'fas fa-file-audio',
    'wav': 'fas fa-file-audio',
    'mp4': 'fas fa-file-video',
    'mov': 'fas fa-file-video',
    'zip': 'fas fa-file-archive',
    'rar': 'fas fa-file-archive',
    'txt': 'fas fa-file-alt',
    'html': 'fas fa-file-code',
    'css': 'fas fa-file-code',
    'js': 'fas fa-file-code'
  };
  
  return iconMap[extension] || 'fas fa-file';
}

// Format file size to readable format
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload a file
function uploadFile(file, overwrite = false) {
  // Check file size (limit to 50MB)
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    showNotification(`File size exceeds the 50MB limit. Your file is ${formatFileSize(file.size)}.`, 'error');
    fileUploadForm.reset();
    return;
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('uid', currentUser.uid);
  formData.append('path', currentPath);
  formData.append('overwrite', overwrite);
  
  // Show upload progress indicator
  const uploadButton = fileUploadForm.querySelector('button[type="submit"]');
  const originalText = uploadButton.textContent;
  uploadButton.textContent = 'Uploading...';
  uploadButton.disabled = true;
  
  fetch('/upload-file', {
    method: 'POST',
    body: formData,
  })
  .then(response => response.json())
  .then(data => {
    // Reset button state
    uploadButton.textContent = originalText;
    uploadButton.disabled = false;
    
    if (data.success) {
      showNotification('File uploaded successfully');
      fileUploadForm.reset();
      loadFiles();
    } else if (data.needs_confirmation) {
      showConfirmationDialog(
        `File "${file.name}" already exists. Do you want to overwrite it?`,
        () => uploadFile(file, true)
      );
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    // Reset button state on error
    uploadButton.textContent = originalText;
    uploadButton.disabled = false;
    
    console.error('Error uploading file:', error);
    showNotification('Error uploading file', 'error');
  });
}

// Download a file
function downloadFile(fileId) {
  fetch('/get-download-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      file_id: fileId
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error downloading file:', error);
    showNotification('Error downloading file', 'error');
  });
}

// Delete a file
function deleteFile(fileId) {
  if (confirm('Are you sure you want to delete this file?')) {
    fetch('/delete-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        file_id: fileId
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showNotification('File deleted');
        loadFiles();
      } else {
        showNotification(data.message, 'error');
      }
    })
    .catch(error => {
      console.error('Error deleting file:', error);
      showNotification('Error deleting file', 'error');
    });
  }
}

// Show confirmation dialog
function showConfirmationDialog(message, onConfirm) {
  const modalContent = confirmationModal.querySelector('.modal-content');
  const modalMessage = confirmationModal.querySelector('.modal-message');
  const confirmBtn = confirmationModal.querySelector('.confirm-btn');
  const cancelBtn = confirmationModal.querySelector('.cancel-btn');
  
  modalMessage.textContent = message;
  
  confirmationModal.style.display = 'flex';
  
  // Set up confirm button
  const confirmHandler = function() {
    confirmationModal.style.display = 'none';
    confirmBtn.removeEventListener('click', confirmHandler);
    cancelBtn.removeEventListener('click', cancelHandler);
    onConfirm();
  };
  
  // Set up cancel button
  const cancelHandler = function() {
    confirmationModal.style.display = 'none';
    confirmBtn.removeEventListener('click', confirmHandler);
    cancelBtn.removeEventListener('click', cancelHandler);
  };
  
  confirmBtn.addEventListener('click', confirmHandler);
  cancelBtn.addEventListener('click', cancelHandler);
}

// Check for duplicate files in current directory
function checkForDuplicates() {
  fetch('/find-duplicates', {
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
      const duplicates = data.duplicates;
      
      // Clear previous duplicates
      duplicatesContainer.innerHTML = '';
      
      if (duplicates.length > 0) {
        duplicatesContainer.style.display = 'block';
        
        // Add a close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', function() {
          duplicatesContainer.style.display = 'none';
        });
        duplicatesContainer.appendChild(closeBtn);
        
        // Add a title
        const title = document.createElement('h4');
        title.textContent = 'Duplicate Files in Current Directory';
        duplicatesContainer.appendChild(title);
        
        // Group duplicates by hash
        const duplicateGroups = {};
        duplicates.forEach(file => {
          if (!duplicateGroups[file.hash]) {
            duplicateGroups[file.hash] = [];
          }
          duplicateGroups[file.hash].push(file);
        });
        
        // Show notification about duplicate files
        const totalGroups = Object.keys(duplicateGroups).length;
        const totalDuplicates = duplicates.length;
        const message = `Found ${totalDuplicates} duplicate files in ${totalGroups} group${totalGroups > 1 ? 's' : ''} in the current directory.`;
        showNotification(message, 'warning');
        
        // Create UI for each duplicate group
        Object.values(duplicateGroups).forEach(group => {
          if (group.length > 1) {
            const groupEl = document.createElement('div');
            groupEl.className = 'duplicate-group';
            
            const groupHeader = document.createElement('h5');
            groupHeader.innerHTML = `${group.length} Duplicate Files <span class="duplicate-size">(${formatFileSize(group[0].size)})</span>:`;
            groupEl.appendChild(groupHeader);
            
            const filesList = document.createElement('ul');
            group.forEach(file => {
              const fileEl = document.createElement('li');
              
              // Create a linked filename that scrolls to the file
              const fileLink = document.createElement('a');
              fileLink.href = '#';
              fileLink.textContent = file.name;
              fileLink.addEventListener('click', function(e) {
                e.preventDefault();
                const fileItem = document.querySelector(`.file-item[data-id="${file.id}"]`);
                if (fileItem) {
                  fileItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Flash effect to highlight the file
                  fileItem.classList.add('flash-highlight');
                  setTimeout(() => {
                    fileItem.classList.remove('flash-highlight');
                  }, 2000);
                }
              });
              
              fileEl.appendChild(fileLink);
              filesList.appendChild(fileEl);
              
              // Highlight the duplicate files in the main list
              const fileItem = document.querySelector(`.file-item[data-id="${file.id}"]`);
              if (fileItem) {
                fileItem.classList.add('duplicate-file');
              }
            });
            
            groupEl.appendChild(filesList);
            duplicatesContainer.appendChild(groupEl);
          }
        });
      } else {
        duplicatesContainer.style.display = 'none';
      }
    }
  })
  .catch(error => {
    console.error('Error checking for duplicates:', error);
  });
}

// Find all duplicate files
function findAllDuplicates() {
  // Show a loading notification
  showNotification('Scanning for duplicate files...', 'info');
  
  fetch('/find-all-duplicates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      const allDuplicatesContainer = document.getElementById('all-duplicates-container');
      allDuplicatesContainer.innerHTML = '';
      
      // Add close button
      const closeBtn = document.createElement('button');
      closeBtn.id = 'close-all-duplicates';
      closeBtn.className = 'close-btn';
      closeBtn.innerHTML = '×';
      closeBtn.addEventListener('click', function() {
        allDuplicatesContainer.style.display = 'none';
      });
      allDuplicatesContainer.appendChild(closeBtn);
      
      // Add title
      const title = document.createElement('h3');
      title.textContent = 'All Duplicate Files';
      allDuplicatesContainer.appendChild(title);
      
      const duplicateGroups = data.duplicate_groups;
      
      if (duplicateGroups.length === 0) {
        const message = document.createElement('p');
        message.textContent = 'No duplicate files found.';
        allDuplicatesContainer.appendChild(message);
        showNotification('No duplicate files found in your DropBox', 'info');
      } else {
        // Calculate total number of duplicate files
        let totalFiles = 0;
        duplicateGroups.forEach(group => {
          totalFiles += group.length;
        });
        
        // Show notification about duplicate files 
        const totalGroups = duplicateGroups.length;
        const message = `Found ${totalFiles} duplicate files in ${totalGroups} group${totalGroups > 1 ? 's' : ''} across all directories.`;
        showNotification(message, 'warning');
        
        // Add summary info
        const summary = document.createElement('p');
        summary.className = 'duplicate-summary';
        summary.innerHTML = `<strong>${message}</strong> <span class="duplicate-hint">Click on any file path to navigate to its location.</span>`;
        allDuplicatesContainer.appendChild(summary);
        
        duplicateGroups.forEach((group, index) => {
          const duplicateGroup = document.createElement('div');
          duplicateGroup.className = 'duplicate-group';
          
          const groupHeader = document.createElement('h4');
          // Get the first file's size for the group (they're duplicates, so size is the same)
          const fileSize = group[0].size || 0;
          groupHeader.innerHTML = `Duplicate Group #${index + 1} <span class="duplicate-size">(${formatFileSize(fileSize)})</span>`;
          duplicateGroup.appendChild(groupHeader);
          
          const fileList = document.createElement('ul');
          
          group.forEach(file => {
            const fileItem = document.createElement('li');
            
            // Create file name element
            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = file.name;
            
            // Create file path element with click handler
            const filePath = document.createElement('span');
            filePath.className = 'file-path clickable';
            filePath.textContent = `(${file.path})`;
            filePath.title = 'Click to navigate to this location';
            filePath.addEventListener('click', function() {
              loadCurrentDirectory(file.path);
              allDuplicatesContainer.style.display = 'none';
            });
            
            fileItem.appendChild(fileName);
            fileItem.appendChild(document.createTextNode(' '));
            fileItem.appendChild(filePath);
            
            fileList.appendChild(fileItem);
          });
          
          duplicateGroup.appendChild(fileList);
          allDuplicatesContainer.appendChild(duplicateGroup);
        });
      }
      
      allDuplicatesContainer.style.display = 'block';
    } else {
      showNotification(data.message, 'error');
    }
  })
  .catch(error => {
    console.error('Error finding all duplicates:', error);
    showNotification('Error finding duplicate files', 'error');
  });
}

// Share a file with another user
function shareFile(fileId, email) {
  // Show loading state
  const submitButton = document.querySelector('#share-file-form-element button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.textContent = 'Sharing...';
  submitButton.disabled = true;
  
  // Store the filename for notification
  const fileName = document.getElementById('share-file-name').textContent;
  
  fetch('/share-file', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      file_id: fileId,
      share_email: email
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    if (data.success) {
      // Show a clear success message with green color
      showNotification(`File "${fileName}" shared successfully with ${email}`, 'success');
      hideShareForm();
    } else {
      showNotification(data.message || 'Error sharing file', 'error');
      // Reset form but don't hide, so user can try again
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  })
  .catch(error => {
    console.error('Error sharing file:', error);
    showNotification('Error sharing file. Please try again.', 'error');
    // Reset button state
    submitButton.textContent = originalText;
    submitButton.disabled = false;
  });
}

// Show file sharing form
function showShareForm(fileId, fileName) {
  const fileIdInput = document.getElementById('share-file-id');
  const fileNameDisplay = document.getElementById('share-file-name');
  
  fileIdInput.value = fileId;
  fileNameDisplay.textContent = fileName;
  
  shareFileFormContainer.style.display = 'block';
  
  // Add close button if not already added
  if (!shareFileFormContainer.querySelector('.close-share-form')) {
    const closeButton = document.createElement('button');
    closeButton.className = 'close-btn close-share-form';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';
    closeButton.addEventListener('click', hideShareForm);
    
    // Insert at the beginning of the form header
    const shareHeader = shareFileFormContainer.querySelector('.share-header');
    shareHeader.insertBefore(closeButton, shareHeader.firstChild);
  }
}

// Hide file sharing form
function hideShareForm() {
  shareFileFormContainer.style.display = 'none';
  
  // Reset the form fields manually
  const emailInput = document.getElementById('share-email');
  if (emailInput) {
    emailInput.value = '';
  }
  
  const fileIdInput = document.getElementById('share-file-id');
  if (fileIdInput) {
    fileIdInput.value = '';
  }
}

// Load shared files
function loadSharedFiles() {
  // Check network status first
  if (!checkNetworkBeforeRequest()) {
    return;
  }

  console.log("Loading shared files...");

  // Clear existing displays
  directoryList.innerHTML = '';
  fileList.innerHTML = '';
  
  // Add loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading shared files...';
  fileList.appendChild(loadingIndicator);
  
  // Add "back" directory
  const backDir = document.createElement('div');
  backDir.className = 'directory-item special-directory';
  backDir.innerHTML = `
    <div class="directory-icon">
      <i class="fas fa-arrow-left"></i>
    </div>
    <div class="directory-name">Back to Home</div>
  `;
  backDir.addEventListener('click', function() {
    loadCurrentDirectory('/');
  });
  directoryList.appendChild(backDir);
  
  // Update breadcrumbs for shared directory
  updateBreadcrumbs();
  
  // Load shared files from server
  fetch('/get-shared-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("Shared files response:", data);
    
    // Remove loading indicator
    const loadingIndicator = fileList.querySelector('.loading-indicator');
    if (loadingIndicator) {
      fileList.removeChild(loadingIndicator);
    }
    
    if (data.success) {
      // Add the shared-files-layout class to the file list
      fileList.classList.add('shared-files-layout');
      
      // Add a title to the shared files section
      const sharedTitle = document.createElement('div');
      sharedTitle.className = 'shared-files-title';
      sharedTitle.innerHTML = `
        <h3>Files Shared With You</h3>
        <p>This directory shows files that other users have shared with you</p>
      `;
      fileList.appendChild(sharedTitle);
      
      // Display shared files count
      console.log(`Found ${data.shared_files ? data.shared_files.length : 0} shared files`);
      
      renderSharedFilesInExplorer(data.shared_files || []);
    } else {
      showNotification(data.message || 'Error loading shared files', 'error');
      // Show empty state with error
      const errorMessage = document.createElement('div');
      errorMessage.className = 'empty-message error-message';
      errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Could not load shared files. Please try again.';
      fileList.appendChild(errorMessage);
    }
  })
  .catch(error => {
    console.error('Error loading shared files:', error);
    
    // Remove loading indicator
    const loadingIndicator = fileList.querySelector('.loading-indicator');
    if (loadingIndicator) {
      fileList.removeChild(loadingIndicator);
    }
    
    showNotification('Error loading shared files: ' + error.message, 'error');
    
    // Show empty state with error
    const errorMessage = document.createElement('div');
    errorMessage.className = 'empty-message error-message';
    errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Could not load shared files. Please try again.';
    fileList.appendChild(errorMessage);
  });
}

// Render shared files in the file explorer
function renderSharedFilesInExplorer(sharedFiles) {
  // Safety check - ensure sharedFiles is an array
  if (!Array.isArray(sharedFiles)) {
    console.error('Shared files data is not an array:', sharedFiles);
    showNotification('Invalid shared files data received', 'error');
    
    const errorMessage = document.createElement('div');
    errorMessage.className = 'empty-message error-message';
    errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid shared files data. Please refresh the page.';
    fileList.appendChild(errorMessage);
    return;
  }
  
  // We'll show a fresh title and container each time
  // First check if we have existing ones and remove them
  const existingTitle = fileList.querySelector('.shared-files-title');
  if (existingTitle) {
    fileList.removeChild(existingTitle);
  }
  
  const existingContainer = fileList.querySelector('.shared-files-container');
  if (existingContainer) {
    fileList.removeChild(existingContainer);
  }
  
  if (sharedFiles.length === 0) {
    // Create empty message
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.innerHTML = '<i class="fas fa-info-circle"></i> No files have been shared with you yet.';
    
    // Add the title
    const sharedTitle = document.createElement('div');
    sharedTitle.className = 'shared-files-title';
    sharedTitle.innerHTML = `
      <h3>Files Shared With You</h3>
      <p>This directory shows files that other users have shared with you</p>
    `;
    
    fileList.appendChild(sharedTitle);
    fileList.appendChild(emptyMessage);
    return;
  }
  
  // Add the title for shared files
  const sharedTitle = document.createElement('div');
  sharedTitle.className = 'shared-files-title';
  sharedTitle.innerHTML = `
    <h3>Files Shared With You</h3>
    <p>This directory shows files that other users have shared with you. Total: ${sharedFiles.length} file${sharedFiles.length !== 1 ? 's' : ''}</p>
  `;
  fileList.appendChild(sharedTitle);
  
  // Create a container for shared files
  const sharedFilesContainer = document.createElement('div');
  sharedFilesContainer.className = 'shared-files-container';
  fileList.appendChild(sharedFilesContainer);
  
  sharedFiles.forEach(sharedFile => {
    // Validate required fields
    if (!sharedFile || !sharedFile.id) {
      console.warn('Invalid shared file data:', sharedFile);
      return; // Skip this file
    }
    
    // Default file name if missing
    const fileName = sharedFile.file_name || 'Unnamed file';
    
    const fileElement = document.createElement('div');
    fileElement.className = 'file-item shared-file';
    fileElement.dataset.id = sharedFile.id;
    
    // Add missing flag if file is missing
    if (sharedFile.file_missing) {
      fileElement.classList.add('file-missing');
    }
    
    const fileIcon = getFileIcon(fileName);
    
    // Use owner_email if available, otherwise fall back to owner_id
    const ownerDisplay = sharedFile.owner_email || sharedFile.owner_id || 'Unknown User';
    
    // Format creation date if available
    let sharedDate = '';
    if (sharedFile.created_at) {
      try {
        const date = new Date(
          typeof sharedFile.created_at === 'object' && sharedFile.created_at._seconds 
            ? sharedFile.created_at._seconds * 1000 
            : sharedFile.created_at
        );
        if (!isNaN(date.getTime())) {
          sharedDate = `Shared on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
        }
      } catch (e) {
        console.warn('Error formatting shared date:', e);
        sharedDate = 'Shared recently';
      }
    }
    
    // Format expiration date if available
    let expirationInfo = '';
    if (sharedFile.expires_at_string) {
      expirationInfo = ` · Expires on ${sharedFile.expires_at_string}`;
    }
    
    fileElement.innerHTML = `
      <div class="file-icon">
        <i class="${fileIcon}"></i>
        ${sharedFile.file_missing ? '<span class="file-missing-badge"><i class="fas fa-exclamation-triangle"></i></span>' : ''}
      </div>
      <div class="file-info">
        <div class="file-name">${fileName}</div>
        <div class="file-details" title="${sharedDate}${expirationInfo}">
          Shared by: <span class="shared-by-email">${ownerDisplay}</span>${expirationInfo}
          ${sharedFile.file_missing ? '<div class="file-missing-text">File unavailable - may have been deleted</div>' : ''}
        </div>
      </div>
      <div class="file-actions">
        ${!sharedFile.file_missing ? `
          <button class="btn-download" data-id="${sharedFile.id}" title="Download shared file">
            <i class="fas fa-download"></i>
          </button>
        ` : ''}
        <button class="btn-delete" data-id="${sharedFile.id}" title="Remove from shared">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
    
    // Add event listener for download (only if file is not missing)
    if (!sharedFile.file_missing) {
      const downloadBtn = fileElement.querySelector('.btn-download');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          downloadSharedFile(sharedFile.id, fileName);
        });
      }
    }
    
    // Add event listener for removing from shared
    const deleteBtn = fileElement.querySelector('.btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        removeSharedFile(sharedFile.id, fileName);
      });
    }
    
    // Append to the shared files container instead of fileList
    sharedFilesContainer.appendChild(fileElement);
  });
}

// Download a shared file
function downloadSharedFile(shareId, fileName = 'shared file') {
  if (!checkNetworkBeforeRequest()) {
    return;
  }
  
  // Show loading state
  showNotification(`Preparing ${fileName} for download...`, 'info');
  
  // Find the download button and show loading state
  const downloadBtn = document.querySelector(`.btn-download[data-id="${shareId}"]`);
  if (downloadBtn) {
    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    downloadBtn.disabled = true;
  }
  
  fetch('/get-shared-file-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid,
      share_id: shareId
    }),
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    // Reset download button state
    if (downloadBtn) {
      downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
      downloadBtn.disabled = false;
    }
    
    if (data.success) {
      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = data.url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showNotification(`Downloading ${data.filename}`, 'success');
    } else {
      showNotification(data.message || 'Error downloading file', 'error');
    }
  })
  .catch(error => {
    console.error('Error downloading shared file:', error);
    showNotification(`Error downloading file: ${error.message}`, 'error');
    
    // Reset download button state
    if (downloadBtn) {
      downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
      downloadBtn.disabled = false;
    }
  });
}

// Remove a file from shared files
function removeSharedFile(shareId, fileName = 'shared file') {
  showConfirmationDialog(`Are you sure you want to remove "${fileName}" from your shared files?`, function() {
    if (!checkNetworkBeforeRequest()) {
      return;
    }
    
    // Show loading state on the button
    const deleteBtn = document.querySelector(`.btn-delete[data-id="${shareId}"]`);
    if (deleteBtn) {
      const originalHTML = deleteBtn.innerHTML;
      deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      deleteBtn.disabled = true;
    }
    
    fetch('/remove-shared-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        share_id: shareId
      }),
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        showNotification(`"${fileName}" removed from shared files`, 'success');
        loadSharedFiles(); // Reload to update the view
      } else {
        showNotification(data.message || 'Error removing file', 'error');
        
        // Reset button state
        if (deleteBtn) {
          deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
          deleteBtn.disabled = false;
        }
      }
    })
    .catch(error => {
      console.error('Error removing shared file:', error);
      showNotification(`Error removing file: ${error.message}`, 'error');
      
      // Reset button state
      if (deleteBtn) {
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.disabled = false;
      }
    });
  });
}

// Update breadcrumb navigation
function updateBreadcrumbs() {
  const breadcrumbs = document.getElementById('breadcrumbs');
  breadcrumbs.innerHTML = '';
  
  // Add root
  const rootItem = document.createElement('span');
  rootItem.textContent = 'Root';
  rootItem.className = 'breadcrumb-item';
  rootItem.addEventListener('click', function() {
    loadCurrentDirectory('/');
  });
  breadcrumbs.appendChild(rootItem);
  
  // If we're in the shared directory, add it to breadcrumbs
  if (isInSharedDirectory) {
    const separator = document.createElement('span');
    separator.textContent = '>';
    separator.className = 'breadcrumb-separator';
    breadcrumbs.appendChild(separator);
    
    const sharedItem = document.createElement('span');
    sharedItem.textContent = 'Shared Files';
    sharedItem.className = 'breadcrumb-item current';
    breadcrumbs.appendChild(sharedItem);
    return;
  }
  
  // Normal path breadcrumbs for user directories
  // Split the path
  const pathParts = currentPath.split('/').filter(Boolean);
  
  // Build up the path and add each part
  let currentBuildPath = '';
  pathParts.forEach((part, index) => {
    // Add separator
    const separator = document.createElement('span');
    separator.textContent = '>';
    separator.className = 'breadcrumb-separator';
    breadcrumbs.appendChild(separator);
    
    // Update the path
    currentBuildPath += '/' + part;
    
    // Add the breadcrumb item
    const item = document.createElement('span');
    item.textContent = part;
    item.className = 'breadcrumb-item';
    
    // Last item is the current directory
    if (index === pathParts.length - 1) {
      item.classList.add('current');
    } else {
      // Add click handler to navigate
      const path = currentBuildPath; // Create a closure to capture the current value
      item.addEventListener('click', function() {
        loadCurrentDirectory(path);
      });
    }
    
    breadcrumbs.appendChild(item);
  });
}

// Show a notification message
function showNotification(message, type = 'success') {
  // Get or create notification element
  let notification = document.getElementById('notification');
  
  // If notification element doesn't exist, create one
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    document.body.appendChild(notification);
  }
  
  // Add icon based on notification type
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
  
  // Set notification content and class
  notification.innerHTML = icon + message;
  notification.className = `notification ${type}`;
  
  // Add close button
  const closeButton = document.createElement('span');
  closeButton.className = 'notification-close';
  closeButton.innerHTML = '&times;';
  closeButton.style.marginLeft = '10px';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '18px';
  closeButton.style.opacity = '0.7';
  closeButton.addEventListener('click', () => {
    notification.style.display = 'none';
  });
  notification.appendChild(closeButton);
  
  // Show notification with animation
  notification.style.display = 'flex';
  notification.style.opacity = '0';
  notification.style.transform = 'translateY(20px)';
  
  // Apply animation
  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);
  
  // Clear any existing timeout
  if (notification.timeoutId) {
    clearTimeout(notification.timeoutId);
  }
  
  // Hide after 5 seconds for success, 8 seconds for warnings/errors
  const displayTime = type === 'success' ? 5000 : 8000;
  notification.timeoutId = setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(20px)';
    
    // Remove element after fade out
    setTimeout(() => {
      notification.style.display = 'none';
    }, 300);
  }, displayTime);
  
  // Make notification accessible
  notification.setAttribute('role', 'alert');
  notification.setAttribute('aria-live', 'assertive');
  
  // Return a function to manually close the notification
  return function closeNotification() {
    if (notification.timeoutId) {
      clearTimeout(notification.timeoutId);
    }
    notification.style.display = 'none';
  };
}

// Add session timeout handling
function setupSessionTimeout() {
  let inactivityTime = 0;
  const SESSION_TIMEOUT = 30 * 60; // 30 minutes in seconds
  const WARNING_TIME = 5 * 60; // 5 minutes before timeout
  let timeoutWarningShown = false;
  let checkInterval;
  
  // Reset timer on user activity
  function resetTimer() {
    inactivityTime = 0;
    if (timeoutWarningShown) {
      timeoutWarningShown = false;
      // Hide warning if shown
      const warningElement = document.getElementById('session-timeout-warning');
      if (warningElement) {
        document.body.removeChild(warningElement);
      }
    }
  }
  
  // Start monitoring user activity
  function startActivityMonitoring() {
    // Reset on user interaction
    ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, resetTimer);
    });
    
    // Check every minute
    checkInterval = setInterval(() => {
      inactivityTime += 60;
      
      // Show warning 5 minutes before timeout
      if (inactivityTime >= SESSION_TIMEOUT - WARNING_TIME && !timeoutWarningShown) {
        showTimeoutWarning();
        timeoutWarningShown = true;
      }
      
      // Log out after 30 minutes of inactivity
      if (inactivityTime >= SESSION_TIMEOUT) {
        clearInterval(checkInterval);
        // Sign out user
        firebase.auth().signOut();
        showNotification('You have been logged out due to inactivity', 'warning');
      }
    }, 60000); // Check every minute
  }
  
  // Create and show timeout warning
  function showTimeoutWarning() {
    const warningElement = document.createElement('div');
    warningElement.id = 'session-timeout-warning';
    warningElement.className = 'session-timeout-warning';
    warningElement.innerHTML = `
      <div class="warning-content">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Your session will expire in 5 minutes due to inactivity.</p>
        <button id="keep-session-active" class="btn-primary">Keep Session Active</button>
      </div>
    `;
    
    document.body.appendChild(warningElement);
    
    // Add event listener to the button
    document.getElementById('keep-session-active').addEventListener('click', function() {
      resetTimer();
      document.body.removeChild(warningElement);
    });
  }
  
  // Start monitoring when user is logged in
  startActivityMonitoring();
}

// Firebase Authentication State Observer
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('user-email').textContent = user.email;
    
    // Store current user
    currentUser = user;
    
    // Initialize user in backend
    initializeUser(user);
    
    // Load the root directory
    loadCurrentDirectory('/');
    
    // Add event listener for sign out
    document.getElementById('sign-out').addEventListener('click', signOut);
    
    // Setup session timeout
    setupSessionTimeout();
    
    // Check for shared files immediately and then every 60 seconds
    checkForSharedFiles();
    setInterval(checkForSharedFiles, 60000);
  } else {
    // User is signed out
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
    
    // Reset current user
    currentUser = null;
  }
});

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
  // File upload
  fileUploadForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const fileInput = this.querySelector('input[type="file"]');
    if (fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });
  
  // Create directory
  createDirForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const dirNameInput = this.querySelector('input[type="text"]');
    if (dirNameInput.value.trim()) {
      createDirectory(dirNameInput.value.trim());
    }
  });
  
  // Share file
  document.getElementById('share-file-form-element').addEventListener('submit', function(e) {
    e.preventDefault();
    const fileId = document.getElementById('share-file-id').value;
    const email = document.getElementById('share-email').value;
    
    if (fileId && email) {
      shareFile(fileId, email);
    }
  });
  
  // Cancel share
  document.getElementById('share-file-form-element').querySelector('.cancel-btn').addEventListener('click', function() {
    hideShareForm();
  });
  
  // Find all duplicates button
  document.getElementById('find-all-duplicates-btn').addEventListener('click', function() {
    findAllDuplicates();
  });
  
  // Load shared files button
  document.getElementById('shared-files-btn').addEventListener('click', function() {
    loadCurrentDirectory('/shared');
  });
  
  // Close all duplicates
  document.getElementById('close-all-duplicates').addEventListener('click', function() {
    document.getElementById('all-duplicates-container').style.display = 'none';
  });
  
  // Make sure the UI is ready for use
  currentPathDisplay.textContent = currentPath;

  // Feature detection at initialization
  const missingFeatures = [];
  
  // Check File API support
  if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
    missingFeatures.push('File API');
  }
  
  // Check Fetch API support
  if (!window.fetch) {
    missingFeatures.push('Fetch API');
  }
  
  // Check localStorage support
  let localStorageAvailable = false;
  try {
    localStorageAvailable = !!window.localStorage;
  } catch (e) {
    missingFeatures.push('Local Storage');
  }
  
  // Alert if missing required features
  if (missingFeatures.length > 0) {
    alert(`Warning: Your browser is missing the following features required for this application to work properly: ${missingFeatures.join(', ')}. Please use a modern browser like Chrome, Firefox, Edge, or Safari.`);
  }
});

// Update shared files button with notification count
function updateSharedFilesButton(count) {
  const sharedFilesBtn = document.getElementById('shared-files-btn');
  if (!sharedFilesBtn) return;
  
  // Create or update notification badge
  let badge = sharedFilesBtn.querySelector('.shared-files-badge');
  
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'shared-files-badge';
      sharedFilesBtn.appendChild(badge);
    }
    badge.textContent = count;
    badge.style.display = 'flex';
    
    // Also update button text
    sharedFilesBtn.innerHTML = `View Shared Files <span class="shared-files-badge">${count}</span>`;
  } else {
    // No shared files
    sharedFilesBtn.innerHTML = 'View Shared Files';
  }
}

// Check for shared files periodically to update button
function checkForSharedFiles() {
  if (!currentUser) return;
  
  // Don't check while offline
  if (!isOnline) return;
  
  fetch('/get-shared-files', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      uid: currentUser.uid
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success && data.shared_files) {
      updateSharedFilesButton(data.shared_files.length);
      
      // If this is the first time we find shared files, show a notification
      const lastCount = parseInt(localStorage.getItem('lastSharedFilesCount') || '0');
      const currentCount = data.shared_files.length;
      
      if (currentCount > lastCount) {
        showNotification(`You have ${currentCount} file${currentCount !== 1 ? 's' : ''} shared with you`, 'info');
      }
      
      // Store current count for future comparisons
      localStorage.setItem('lastSharedFilesCount', currentCount.toString());
    }
  })
  .catch(error => {
    console.error('Error checking for shared files:', error);
  });
}
