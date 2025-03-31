// Firebase Auth initialization
// Fetch firebase config from backend
fetch("/firebase-config")
  .then(res => res.json())
  .then(config => {
    // Initialize Firebase with config from server
    firebase.initializeApp(config);

    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const loginBtn = document.getElementById("login-form").querySelector("button");
    const signupBtn = document.querySelector("form[action='/signup'] button");
    const logoutBtn = document.getElementById("logout-btn");
    const userEmailDisplay = document.getElementById("user-status");

    // Login with existing form
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = emailInput.value;
      const password = passwordInput.value;

      try {
        const result = await firebase.auth().signInWithEmailAndPassword(email, password);
        console.log("Signed in:", result.user.email);
      } catch (err) {
        alert("Login failed: " + err.message);
      }
    });

    // Signup with existing form
    document.querySelector("form[action='/signup']").addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = e.target.querySelector("input[name='email']").value;
      const password = e.target.querySelector("input[name='password']").value;

      try {
        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
        console.log("Signed up:", result.user.email);
        
        // Register with backend
        await fetch("/signup", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        });
        
        alert("Signup successful! You can now log in.");
      } catch (err) {
        alert("Signup failed: " + err.message);
      }
    });

    // Handle logout
    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut();
    });

    // Auth state observer
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();

        try {
          // Send to backend to register/login
          const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken: token }),
          });
          
          const result = await response.json();
          
          if (result.uid) {
            document.getElementById("user-id").value = result.uid;
            userEmailDisplay.textContent = `Logged in as ${user.email}`;
            logoutBtn.style.display = "inline-block";
            
            // Disable login form after success
            emailInput.disabled = true;
            passwordInput.disabled = true;
            loginBtn.disabled = true;
            
            // Load directories and files
            currentPath = "/";
            document.getElementById("current-path").textContent = "/";
            loadDirectories();
            loadFiles();
          }
        } catch (err) {
          console.error("Error during login with backend:", err);
        }
      } else {
        userEmailDisplay.textContent = "Not logged in";
        logoutBtn.style.display = "none";
        
        // Enable login form
        emailInput.disabled = false;
        passwordInput.disabled = false;
        loginBtn.disabled = false;
        
        // Clear user ID field
        document.getElementById("user-id").value = "";
      }
    });
  })
  .catch(error => {
    console.error("Failed to load Firebase config:", error);
    alert("Failed to initialize the application. Please check the console for details.");
  });
