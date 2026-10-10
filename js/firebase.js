// FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDsdKhThJEiZpeYTwbtAQbF3RWA24t5fao",
  authDomain: "spec-advisor.firebaseapp.com",
  projectId: "spec-advisor",
  storageBucket: "spec-advisor.firebasestorage.app",
  messagingSenderId: "534579060742",
  appId: "1:534579060742:web:b58bb52a83ed6c6b59a387"
};

// INITIALIZE
const app = initializeApp(firebaseConfig);

// EXPORT
export const auth = getAuth(app);
export const db = getFirestore(app);