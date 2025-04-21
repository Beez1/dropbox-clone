// Firebase configuration
const firebaseConfig = {
  apiKey: "<YOUR_FIREBASE_API_KEY>",
  authDomain: "<YOUR_FIREBASE_AUTH_DOMAIN>",
  projectId: "<YOUR_FIREBASE_PROJECT_ID>",
  storageBucket: "<YOUR_FIREBASE_STORAGE_BUCKET>",
  messagingSenderId: "<YOUR_FIREBASE_MESSAGING_SENDER_ID>",
  appId: "<YOUR_FIREBASE_APP_ID>",
  measurementId: "<YOUR_FIREBASE_MEASUREMENT_ID>"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Function to show notifications
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  if (!notification) return; // Safety check
  
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
  
  notification.innerHTML = icon + message;
  notification.className = `notification ${type}`;
  
  // Show notification
  notification.style.display = 'block';
  
  // Clear any existing timeout
  if (notification.timeoutId) {
    clearTimeout(notification.timeoutId);
  }
  
  // Hide after 4 seconds
  notification.timeoutId = setTimeout(() => {
    notification.style.display = 'none';
  }, 4000);
}

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

// Sign in with email and password
function signIn(email, password) {
  document.getElementById('login-error').textContent = '';
  
  firebase.auth().signInWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      // Show success notification
      showNotification('Login successful!', 'success');
    })
    .catch(function(error) {
      // Handle sign-in errors
      const errorMessage = error.message;
      document.getElementById('login-error').textContent = errorMessage;
      console.error("Login error:", error);
    });
}

// Sign up with email and password
function signUp(email, password) {
  document.getElementById('login-error').textContent = '';
  
  firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(function(userCredential) {
      // Show success notification
      showNotification('Account created successfully!', 'success');
    })
    .catch(function(error) {
      // Handle sign-up errors
      const errorMessage = error.message;
      document.getElementById('login-error').textContent = errorMessage;
      console.error("Sign up error:", error);
    });
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
    
    if (document.getElementById('login-mode').checked) {
      signIn(email, password);
    } else {
      signUp(email, password);
    }
  });
  
  // Mode switcher
  document.getElementById('login-mode').addEventListener('change', function() {
    const submitButton = document.getElementById('login-submit');
    if (this.checked) {
      submitButton.value = 'Sign In';
    } else {
      submitButton.value = 'Sign Up';
    }
  });
  
  // Sign out button
  document.getElementById('sign-out').addEventListener('click', function() {
    signOut();
  });
});
