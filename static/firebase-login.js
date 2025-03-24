// Sample Firebase Auth init
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
};firebase.initializeApp(firebaseConfig);
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    console.log("User logged in:", user.email);
  } else {
    console.log("User not signed in.");
  }
});
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    const token = await user.getIdToken();
    await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken: token }),
    });
  }
});// Fetch firebase config from backend
fetch("/firebase-config")
  .then(res => res.json())
  .then(config => {
    firebase.initializeApp(config);

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userEmailDisplay = document.getElementById("user-email");

    document.getElementById("auth-form").addEventListener("submit", async (e) => {
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

    signupBtn.addEventListener("click", async () => {
      const email = emailInput.value;
      const password = passwordInput.value;

      try {
        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
        console.log("Signed up:", result.user.email);
      } catch (err) {
        alert("Signup failed: " + err.message);
      }
    });

    logoutBtn.addEventListener("click", () => {
      firebase.auth().signOut();
    });

    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdToken();

        // Send to backend to register
        await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        });

        userEmailDisplay.textContent = user.email;
        logoutBtn.style.display = "inline-block";
      } else {
        userEmailDisplay.textContent = "Not logged in";
        logoutBtn.style.display = "none";
      }
    });
  });
