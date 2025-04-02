// Firebase configuration
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-auth-domain",
    projectId: "your-project-id",
    storageBucket: "your-storage-bucket",
    messagingSenderId: "your-messaging-sender-id",
    appId: "your-app-id",
    measurementId: "your-measurement-id"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  
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