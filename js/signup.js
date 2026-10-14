import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let isSigningUp = false;

// =========================
// PROCESSING POPUP
// =========================

function showLoading() {
  const overlay = document.getElementById("auth-processing-overlay");

  const box = overlay?.querySelector(".auth-processing-box");

  const button = document.getElementById("signupBtn");

  if (box) {
    box.innerHTML = `

            <div class="auth-spinner"></div>

            <h3>
                Creating Account...
            </h3>

            <p>
                Your account is being processed.
                Please wait...
            </p>

        `;
  }

  if (overlay) {
    overlay.classList.add("active");

    overlay.classList.remove("hidden");
  }

  if (button) {
    button.disabled = true;

    button.innerText = "Creating Account...";
  }
}

function hideLoading() {
  const overlay = document.getElementById("auth-processing-overlay");

  const button = document.getElementById("signupBtn");

  if (overlay) {
    overlay.classList.remove("active");

    overlay.classList.add("hidden");
  }

  if (button) {
    button.disabled = false;

    button.innerText = "Create Account";
  }
}

// =========================
// VERIFICATION POPUP
// =========================

function showVerificationMessage() {
  const overlay = document.getElementById("auth-processing-overlay");

  const box = overlay?.querySelector(".auth-processing-box");

  if (!overlay || !box) {
    alert("Account created. Please check your email for verification.");

    return;
  }

  const message = `
        Your Faculty account has been created successfully.
        A verification link has been sent to your email.
        Please verify your email, then wait for an administrator
        to approve your account before logging in.
    `;

  box.innerHTML = `

        <div
            style="
                width:55px;
                height:55px;
                margin:0 auto 15px;
                border-radius:50%;
                background:#f39ac2;
                color:white;
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:28px;
                font-weight:bold;
            "
        >
            ✓
        </div>

        <h3>
            Check Your Email
        </h3>

        <p>
            ${message}
        </p>

        <button
            type="button"
            id="verificationOkBtn"
            style="
                width:100%;
                max-width:250px;
                margin-top:20px;
                background:#ff4fa3;
                color:white;
                border:none;
                border-radius:8px;
                padding:12px 20px;
                font-size:15px;
                font-weight:bold;
                cursor:pointer;
            "
        >
            OK
        </button>

    `;

  overlay.classList.add("active");

  overlay.classList.remove("hidden");

  const okButton = document.getElementById("verificationOkBtn");

  if (okButton) {
    okButton.onclick = () => {
      overlay.classList.remove("active");

      overlay.classList.add("hidden");

      window.location.replace("./faculty/faculty-login.html");
    };
  }
}

// =========================
// PASSWORD VALIDATION
// =========================

function validatePassword(password) {
  if (password.length < 8) {
    alert("Password must be at least 8 characters long.");

    return false;
  }

  return true;
}

// =========================
// PASSWORD EYE
// =========================

function togglePassword(inputId, iconSpan) {
  const input = document.getElementById(inputId);

  const openEye = iconSpan.querySelector(".eye-open");

  const closedEye = iconSpan.querySelector(".eye-closed");

  if (input.type === "password") {
    input.type = "text";

    openEye.classList.add("hidden");

    closedEye.classList.remove("hidden");
  } else {
    input.type = "password";

    openEye.classList.remove("hidden");

    closedEye.classList.add("hidden");
  }
}

// =========================
// GET ACTIVE ACADEMIC YEAR
// =========================

async function getActiveAcademicYear() {
  const snapshot = await getDocs(collection(db, "academicYears"));

  let year = "";

  snapshot.forEach((docData) => {
    const data = docData.data();

    if (data.active) {
      year = data.year;
    }
  });

  return year;
}

// =========================
// SIGN UP (FACULTY ONLY)
// =========================

async function signup() {
  if (isSigningUp) {
    return false;
  }

  isSigningUp = true;

  showLoading();

  try {
    const fullname = document.getElementById("facultyFullname").value.trim();

    const email = document.getElementById("facultyEmail").value.trim();

    const password = document.getElementById("facultyPassword").value.trim();

    if (fullname === "" || email === "" || password === "") {
      alert("Please fill all fields.");

      hideLoading();

      isSigningUp = false;

      return false;
    }

    if (!validatePassword(password)) {
      hideLoading();

      isSigningUp = false;

      return false;
    }

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = userCredential.user;

    await sendEmailVerification(user);

    const activeYear = await getActiveAcademicYear();

    await setDoc(doc(db, "users", user.uid), {
      fullname: fullname,

      email: email,

      role: "Faculty",

      active: false, // Needs Admin approval

      activeAcademicYear: activeYear,

      emailVerified: false,
    });

    // SIGN OUT AFTER SIGNUP
    await signOut(auth);

    isSigningUp = false;

    showVerificationMessage();

    return true;
  } catch (error) {
    console.error(error);

    hideLoading();

    isSigningUp = false;

    if (error.code === "auth/email-already-in-use") {
      alert("This email is already registered.");
    } else if (error.code === "auth/invalid-email") {
      alert("Please enter a valid email address.");
    } else if (error.code === "auth/weak-password") {
      alert("Password must be at least 8 characters long.");
    } else {
      alert(error.message);
    }

    return false;
  }
}

// =========================
// EXPORT & GLOBAL BINDINGS
// =========================

window.signup = signup;
window.togglePassword = togglePassword;

// =========================
// EVENT LISTENERS
// =========================

document.addEventListener("DOMContentLoaded", () => {
  const signupBtn = document.getElementById("signupBtn");

<<<<<<< HEAD
        const signupBtn =
            document.getElementById(
                "signupBtn"
            );


        if(signupBtn){

            signupBtn.addEventListener(
                "click",
                async () => {

                    await signup();

                }
            );

        }

    }
);
=======
  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      await signup();
    });
  }
});
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
