import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCb7N09Iv84aU3QTiES4-ArXAMMxlpkWQM",
  authDomain: "auth-console-7f69e.firebaseapp.com",
  projectId: "auth-console-7f69e",
  storageBucket: "auth-console-7f69e.firebasestorage.app",
  messagingSenderId: "774763794660",
  appId: "1:774763794660:web:1f39e54c05ef6faae79cf1",
  measurementId: "G-VX2LBL2V7G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export { app, auth, googleProvider, analytics };
