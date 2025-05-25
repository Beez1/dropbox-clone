// Firebase configuration - will be loaded from backend
let firebaseConfig = null;

// Initialize Firebase after loading config
async function initializeFirebase() {
  try {
    const response = await fetch('/firebase-config');
    firebaseConfig = await response.json();
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error loading Firebase config:', error);
    // Fallback to hardcoded config for development
    firebaseConfig = {
      apiKey: "AIzaSyBw1D-XDdzRZGWAcaG4WflUVtPv9NSp7CI",
      authDomain: "dropboxclone-26e34.firebaseapp.com",
      projectId: "dropboxclone-26e34",
      storageBucket: "dropboxclone-26e34.appspot.com",
      messagingSenderId: "572745732961",
      appId: "1:572745732961:web:114482b979929412266b20",
      measurementId: "G-6T869877L3"
    };
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized with fallback config');
  }
}

// Initialize Firebase when the page loads
initializeFirebase();

// Authentication state observer
let currentUser = null;

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    // User is signed in
    currentUser = user;
    console.log("User signed in:", user.uid);
    
    // Hide login form and show app container
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    // Initialize user in the backend
    initializeUser(user);
    
    // Update UI with user info
    document.getElementById('user-email').textContent = user.email;
    
    // Load initial content
    loadCurrentDirectory('/');
  } else {
    // User is signed out
    currentUser = null;
    console.log("User signed out");
    
    // Show login form and hide app container
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
  }
});

// Display error message with visual feedback
function displayLoginError(message) {
  const errorElement = document.getElementById('login-error');
  
  // Safety check for raw JSON appearing in UI
  if (typeof message === 'string' && (
      message.includes('{"error":') || 
      message.includes('INVALID_LOGIN_CREDENTIALS') ||
      message.startsWith('{') || 
      message.startsWith('['))) {
    // Override with a generic user-friendly message
    message = 'Invalid email or password. Please try again.';
  }
  
  // Enforce a reasonable character limit for display
  if (typeof message === 'string' && message.length > 200) {
    message = message.substring(0, 200) + '...';
  }
  
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
  // Add shake animation to error message
  errorElement.classList.add('shake');
  
  // Remove the animation class after it completes
  setTimeout(() => {
    errorElement.classList.remove('shake');
  }, 600);
  
  // Highlight the relevant input field if the error is related to it
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  
  // Reset any previous error states
  emailInput.classList.remove('error');
  passwordInput.classList.remove('error');
  
  // Determine which field to highlight based on message content
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('email')) {
    emailInput.classList.add('error');
    emailInput.focus();
  } else if (lowerMessage.includes('password')) {
    passwordInput.classList.add('error');
    passwordInput.focus();
  } else if (lowerMessage.includes('invalid') || lowerMessage.includes('credentials')) {
    // For general authentication errors, highlight both fields
    emailInput.classList.add('error');
    passwordInput.classList.add('error');
    emailInput.focus();
  }
}

// Sign in with email and password
function signIn(email, password) {
  // Clear any previous error messages
  const errorElement = document.getElementById('login-error');
  errorElement.textContent = '';
  errorElement.style.display = 'none';
  
  // Show loading state on the button
  const submitButton = document.getElementById('login-submit');
  const originalValue = submitButton.value;
  submitButton.value = 'Signing in...';
  submitButton.disabled = true;
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      // Show success notification via app.js showNotification function
      if (typeof showNotification === 'function') {
        showNotification('Login successful!', 'success');
      }
      // Reset button
      submitButton.value = originalValue;
      submitButton.disabled = false;
    })
    .catch(function(error) {
      // Reset button
      submitButton.value = originalValue;
      submitButton.disabled = false;
      
      console.error("Login error:", error);
      
      // Special handling for the common INVALID_LOGIN_CREDENTIALS error
      if (error && error.message && 
          (error.message.includes('INVALID_LOGIN_CREDENTIALS') || 
           error.message.includes('{"error":'))) {
        displayLoginError('Invalid email or password. Please try again.');
        return;
      }
      
      // Format friendly error message for other cases
      let errorMessage = formatAuthError(error);
      
      // Display the error with visual feedback
      displayLoginError(errorMessage);
    });
}

// Sign up with email and password
function signUp(email, password) {
  // Clear any previous error messages
  const errorElement = document.getElementById('login-error');
  errorElement.textContent = '';
  errorElement.style.display = 'none';
  
  // Show loading state on the button
  const submitButton = document.getElementById('login-submit');
  const originalValue = submitButton.value;
  submitButton.value = 'Creating account...';
  submitButton.disabled = true;
  
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      // Show success notification via app.js showNotification function
      if (typeof showNotification === 'function') {
        showNotification('Account created successfully!', 'success');
      }
      // Reset button
      submitButton.value = originalValue;
      submitButton.disabled = false;
    })
    .catch(function(error) {
      // Reset button
      submitButton.value = originalValue;
      submitButton.disabled = false;
      
      console.error("Sign up error:", error);
      
      // Special handling for errors with raw JSON format
      if (error && error.message && 
          (error.message.includes('{"error":') || error.message.startsWith('{'))) {
        
        // Generic handling for email already in use (common signup error)
        if (error.message.toLowerCase().includes('email') && 
            error.message.toLowerCase().includes('use')) {
          displayLoginError('This email is already registered. Please sign in instead.');
          return;
        }
        
        // Handle other JSON format errors
        displayLoginError('Error creating account. Please try again.');
        return;
      }
      
      // Format friendly error message for other cases
      let errorMessage = formatAuthError(error);
      
      // Display the error with visual feedback
      displayLoginError(errorMessage);
    });
}

// Format Firebase authentication errors to be more user-friendly
function formatAuthError(error) {
  // First check if error is a string that might contain JSON
  if (typeof error === 'string' && (error.includes('INVALID_LOGIN_CREDENTIALS') || error.includes('"error":'))) {
    return 'Invalid email or password. Please try again.';
  }
  
  let errorCode = '';
  let errorMessage = '';
  
  // Handle different error formats
  if (error && typeof error === 'object') {
    // Standard Firebase error format
    errorCode = error.code || '';
    errorMessage = error.message || '';
    
    // Check for nested error object format 
    if (errorMessage.includes('{"error":')) {
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.error && parsedError.error.message) {
          errorMessage = parsedError.error.message;
        }
      } catch (e) {
        // If parsing fails, keep original message
      }
    }
  } else {
    // If error is not an object, use it directly
    errorMessage = String(error);
  }
  
  // Special case for the INVALID_LOGIN_CREDENTIALS error
  if (errorMessage.includes('INVALID_LOGIN_CREDENTIALS')) {
    return 'Invalid email or password. Please try again.';
  }
  
  // Map common Firebase error codes to more user-friendly messages
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password. Please check your credentials and try again.';
    default:
      // For other errors, extract the message from Firebase error
      // Format: "Firebase: Error message (auth/error-code)."
      if (errorMessage.includes('Firebase: ')) {
        try {
          return errorMessage.split('Firebase: ')[1].split(' (')[0];
        } catch (e) {
          // If parsing fails, return original message
          return errorMessage;
        }
      }
  }
  
  // If no specific handling, return the error message or a generic one
  return errorMessage || 'Authentication error. Please try again.';
}

// Sign out
function signOut() {
  firebase.auth().signOut()
    .then(function() {
      // Sign-out successful
      console.log("Sign-out successful");
    })
    .catch(function(error) {
      // An error happened
      console.error("Sign-out error:", error);
    });
}

// Initialize user in the backend
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
    console.log('User initialized:', data);
  })
  .catch(error => {
    console.error('Error initializing user:', error);
  });
}

// Event listeners for login/signup form
document.addEventListener('DOMContentLoaded', function() {
  // Login form submit
  document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    // Reset error styles on inputs
    document.getElementById('email').classList.remove('error');
    document.getElementById('password').classList.remove('error');
    
    // Validate inputs before submission
    if (!email && !password) {
      displayLoginError('Please enter your email and password');
      document.getElementById('email').classList.add('error');
      document.getElementById('password').classList.add('error');
      return;
    } else if (!email) {
      displayLoginError('Please enter your email address');
      document.getElementById('email').classList.add('error');
      return;
    } else if (!password) {
      displayLoginError('Please enter your password');
      document.getElementById('password').classList.add('error');
      return;
    }
    
    if (document.getElementById('login-mode').checked) {
      signIn(email, password);
    } else {
      signUp(email, password);
    }
  });
  
  // Mode switcher
  document.getElementById('login-mode').addEventListener('change', function() {
    const submitButton = document.getElementById('login-submit');
    const loginLabel = document.querySelector('.toggle-label:first-of-type');
    const signupLabel = document.querySelector('.toggle-label:last-of-type');
    const formTitle = document.querySelector('.login-header h2');
    const formSubtitle = document.querySelector('.login-header p');
    
    // Clear any previous error messages
    const errorElement = document.getElementById('login-error');
    errorElement.textContent = '';
    errorElement.style.display = 'none';
    
    // Reset error styles on inputs
    document.getElementById('email').classList.remove('error');
    document.getElementById('password').classList.remove('error');
    
    if (this.checked) {
      submitButton.value = 'Sign In';
      loginLabel.style.fontWeight = 'bold';
      signupLabel.style.fontWeight = 'normal';
      formSubtitle.textContent = 'Sign in to access your files';
      formTitle.textContent = 'DropBox Clone';
    } else {
      submitButton.value = 'Sign Up';
      loginLabel.style.fontWeight = 'normal';
      signupLabel.style.fontWeight = 'bold';
      formSubtitle.textContent = 'Create an account to get started';
      formTitle.textContent = 'Create Account';
    }
  });
  
  // Initialize the toggle state to match the default checked state
  const loginToggle = document.getElementById('login-mode');
  if (loginToggle) {
    // Trigger the change event to set initial state
    const event = new Event('change');
    loginToggle.dispatchEvent(event);
  }
  
  // Clear error states when typing in inputs
  document.getElementById('email').addEventListener('input', function() {
    this.classList.remove('error');
    // If password is not in error state, also hide the error message
    if (!document.getElementById('password').classList.contains('error')) {
      document.getElementById('login-error').style.display = 'none';
    }
  });
  
  document.getElementById('password').addEventListener('input', function() {
    this.classList.remove('error');
    // If email is not in error state, also hide the error message
    if (!document.getElementById('email').classList.contains('error')) {
      document.getElementById('login-error').style.display = 'none';
    }
  });
  
  // Sign out button
  document.getElementById('sign-out').addEventListener('click', function() {
    signOut();
  });
});
