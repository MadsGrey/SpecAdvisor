import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================
   PROCESSING OVERLAY
========================= */

function showProcessing(message = "Please wait...") {
  let overlay = document.getElementById("auth-processing-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "auth-processing-overlay";
    overlay.className = "auth-processing-overlay";

    overlay.innerHTML = `
      <div class="auth-processing-box">
        <div class="auth-spinner"></div>
        <h3>Processing...</h3>
        <p id="auth-processing-message"></p>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  const messageElement = document.getElementById("auth-processing-message");

  if (messageElement) {
    messageElement.textContent = message;
  }

  overlay.classList.add("active");
}

function hideProcessing() {
  document
    .getElementById("auth-processing-overlay")
    ?.classList.remove("active");
}

/* =========================
   ACTIVITY LOGGING
========================= */

async function logActivity({
  user,
  role = "Unknown",
  academicYear = "N/A",
  status,
}) {
  try {
    await addDoc(collection(db, "activityLogs"), {
      user: user || "Unknown",
      role,
      academicYear: academicYear || "N/A",
      action: "Login Attempt",
      status,
      time: new Date().toLocaleString(),
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Failed to save activity log:", error);
  }
}

/* =========================
   UPDATE ACADEMIC YEAR
========================= */

async function updateUserAcademicYear(uid) {
  const academicYearQuery = query(
    collection(db, "academicYears"),
    where("active", "==", true),
  );

  const snapshot = await getDocs(academicYearQuery);

  if (snapshot.empty) {
    console.warn("No active academic year found.");
    return "";
  }

  const activeYear = snapshot.docs[0].data().year;

  await updateDoc(doc(db, "users", uid), {
    activeAcademicYear: activeYear,
  });

  return activeYear || "";
}

/* =========================
   SHARED LOGIN ERROR MESSAGE
========================= */

function getLoginErrorMessage(error, role) {
  if (error.message === "USER_DATA_NOT_FOUND") {
    return "User data not found. Please contact the administrator.";
  }

  if (error.message === "ACCOUNT_DEACTIVATED") {
    return "Your account has been deactivated. Please contact the administrator.";
  }

  if (error.message === "STUDENT_ONLY") {
    return "This account is not registered as a Student account. Please use the correct login portal.";
  }

  if (error.message === "NOT_FACULTY") {
    return "This account is not registered as a Faculty account. Please use the correct login portal.";
  }

  if (error.message === "NOT_ADMIN") {
    return "This account is not registered as an Admin account. Please use the correct login portal.";
  }

  if (error.message === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email address before logging in. Check your inbox.";
  }

  if (error.message === "WAITING_FOR_APPROVAL") {
    return "Your Faculty account is waiting for admin approval.";
  }

  if (error.code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (
    [
      "auth/invalid-credential",
      "auth/wrong-password",
      "auth/user-not-found",
    ].includes(error.code)
  ) {
    return `Invalid ${role} Email or Password.`;
  }

  if (error.code === "auth/too-many-requests") {
    return "Too many login attempts. Please try again later.";
  }

  if (error.code === "auth/network-request-failed") {
    return "Network error. Check your internet connection.";
  }

  if (
    error.code === "permission-denied" ||
    error.code === "firestore/permission-denied"
  ) {
    return "Unable to access your account information. Please contact the administrator.";
  }

  return "Login failed. Please try again.";
}

/* =========================
   STUDENT LOGIN
========================= */

let isStudentLoggingIn = false;

async function login() {
  if (isStudentLoggingIn) return;

  const emailInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("loginBtn");
  const messageElement = document.getElementById("studentLoginMessage");

  if (!emailInput || !passwordInput) {
    console.error("Student login fields were not found.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    if (messageElement) {
      messageElement.textContent = "Please enter your email and password.";
    }
    return;
  }

  isStudentLoggingIn = true;

  if (loginButton) loginButton.disabled = true;
  if (messageElement) messageElement.textContent = "";

  showProcessing("Please wait while we sign you in...");

  let authenticatedUser = null;
  let userData = null;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    authenticatedUser = credential.user;

    const userSnapshot = await getDoc(doc(db, "users", authenticatedUser.uid));

    if (!userSnapshot.exists()) {
      throw new Error("USER_DATA_NOT_FOUND");
    }

    userData = userSnapshot.data();

    if (userData.role !== "Student") {
      throw new Error("STUDENT_ONLY");
    }

    if (userData.active === false) {
      throw new Error("ACCOUNT_DEACTIVATED");
    }

    const activeYear = await updateUserAcademicYear(authenticatedUser.uid);

    if (activeYear) {
      userData.activeAcademicYear = activeYear;
    }

    localStorage.setItem("currentUser", authenticatedUser.uid);
    localStorage.setItem(
      "currentStudentName",
      userData.fullname || userData.email || email,
    );
    localStorage.setItem("userRole", userData.role);
    localStorage.setItem("userData", JSON.stringify(userData));

    await logActivity({
      user:
        userData.fullname || userData.email || userData.studentNumber || email,
      role: userData.role,
      academicYear: userData.activeAcademicYear || "N/A",
      status: "Success",
    });

    showProcessing("Login successful. Redirecting to your dashboard...");

    window.location.replace("./student/dashboard.html");
    return;
  } catch (error) {
    console.error("Student Login Error:", error);

    if (authenticatedUser) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Student sign-out failed:", signOutError);
      }
    }

    hideProcessing();

    await logActivity({
      user: email,
      role: userData?.role || "Student",
      academicYear: userData?.activeAcademicYear || "N/A",
      status: "Failed",
    });

    const message = getLoginErrorMessage(error, "Student");

    if (messageElement) {
      messageElement.textContent = message;
    } else {
      alert(message);
    }
  } finally {
    isStudentLoggingIn = false;

    if (loginButton) loginButton.disabled = false;
  }
}

/* =========================
   FACULTY LOGIN
========================= */

let isFacultyLoggingIn = false;

async function facultyLogin() {
  if (isFacultyLoggingIn) return;

  const emailInput = document.getElementById("facultyUsername");
  const passwordInput = document.getElementById("facultyPassword");
  const loginButton = document.getElementById("facultyLoginBtn");
  const messageElement = document.getElementById("facultyLoginMessage");

  if (!emailInput || !passwordInput) {
    console.error("Faculty login fields were not found.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    if (messageElement) {
      messageElement.textContent =
        "Please enter your faculty email and password.";
    }
    return;
  }

  isFacultyLoggingIn = true;

  if (loginButton) loginButton.disabled = true;
  if (messageElement) messageElement.textContent = "";

  showProcessing("Please wait while we sign you in...");

  let authenticatedUser = null;
  let userData = null;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    authenticatedUser = credential.user;

    if (!authenticatedUser.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const userSnapshot = await getDoc(doc(db, "users", authenticatedUser.uid));

    if (!userSnapshot.exists()) {
      throw new Error("USER_DATA_NOT_FOUND");
    }

    userData = userSnapshot.data();

    if (userData.role !== "Faculty") {
      throw new Error("NOT_FACULTY");
    }

    if (userData.active !== true) {
      throw new Error("WAITING_FOR_APPROVAL");
    }

    const activeYear = await updateUserAcademicYear(authenticatedUser.uid);

    if (activeYear) {
      userData.activeAcademicYear = activeYear;
    }

    localStorage.setItem("currentUser", authenticatedUser.uid);
    localStorage.setItem(
      "currentStudentName",
      userData.fullname || userData.email || email,
    );
    localStorage.setItem("userRole", userData.role);
    localStorage.setItem("userData", JSON.stringify(userData));

    await logActivity({
      user: userData.fullname || userData.email || email,
      role: "Faculty",
      academicYear: userData.activeAcademicYear || "N/A",
      status: "Success",
    });

    showProcessing("Login successful. Redirecting to your dashboard...");

    window.location.replace("./faculty/faculty-dashboard.html");
    return;
  } catch (error) {
    console.error("Faculty Login Error:", error);

    if (authenticatedUser) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Faculty sign-out failed:", signOutError);
      }
    }

    hideProcessing();

    await logActivity({
      user: email,
      role: "Faculty",
      academicYear: userData?.activeAcademicYear || "N/A",
      status: "Failed",
    });

    const message = getLoginErrorMessage(error, "Faculty");

    if (messageElement) {
      messageElement.textContent = message;
    } else {
      alert(message);
    }
  } finally {
    isFacultyLoggingIn = false;

    if (loginButton) loginButton.disabled = false;
  }
}

/* =========================
   ADMIN LOGIN
========================= */

let isAdminLoggingIn = false;

async function adminLogin() {
  if (isAdminLoggingIn) return;

  const emailInput = document.getElementById("adminUsername");
  const passwordInput = document.getElementById("adminPassword");
  const loginButton = document.getElementById("adminLoginBtn");
  const messageElement = document.getElementById("adminLoginMessage");

  if (!emailInput || !passwordInput) {
    console.error("Admin login fields were not found.");
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    if (messageElement) {
      messageElement.textContent =
        "Please enter your Admin email and password.";
    }
    return;
  }

  isAdminLoggingIn = true;

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Please wait...";
  }

  if (messageElement) messageElement.textContent = "";

  showProcessing("Please wait while we sign you in...");

  let authenticatedUser = null;
  let userData = null;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    authenticatedUser = credential.user;

    const userSnapshot = await getDoc(doc(db, "users", authenticatedUser.uid));

    if (!userSnapshot.exists()) {
      throw new Error("USER_DATA_NOT_FOUND");
    }

    userData = userSnapshot.data();

    // Keep the role value consistent with your existing Admin system.
    if (userData.role !== "ADMIN") {
      throw new Error("NOT_ADMIN");
    }

    if (userData.active === false) {
      throw new Error("ACCOUNT_DEACTIVATED");
    }

    localStorage.setItem("currentUser", authenticatedUser.uid);
    localStorage.setItem(
      "currentStudentName",
      userData.fullname || userData.email || "ADMIN",
    );
    localStorage.setItem("userRole", userData.role);
    localStorage.setItem("userData", JSON.stringify(userData));

    await logActivity({
      user: userData.fullname || userData.email || email,
      role: "ADMIN",
      academicYear: userData.activeAcademicYear || "N/A",
      status: "Success",
    });

    showProcessing("Login successful. Redirecting to your dashboard...");

    // Assumes admin-dashboard.html is in the same root folder as Login.html.
    window.location.replace("./admin-dashboard.html");
    return;
  } catch (error) {
    console.error("Admin Login Error:", error);

    if (authenticatedUser) {
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.error("Admin sign-out failed:", signOutError);
      }
    }

    hideProcessing();

    await logActivity({
      user: email,
      role: "ADMIN",
      academicYear: userData?.activeAcademicYear || "N/A",
      status: "Failed",
    });

    const message = getLoginErrorMessage(error, "Admin");

    if (messageElement) {
      messageElement.textContent = message;
    } else {
      alert(message);
    }
  } finally {
    isAdminLoggingIn = false;

    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  }
}

/* =========================
   PASSWORD RESET
========================= */

async function resetPasswordForRole({ inputId, messageId, roleName }) {
  const emailInput = document.getElementById(inputId);
  const messageElement = document.getElementById(messageId);
  const email = emailInput?.value.trim();

  if (!email) {
    if (messageElement) {
      messageElement.textContent = `Enter your ${roleName} email address first.`;
    }

    emailInput?.focus();
    return;
  }

  try {
    showProcessing("Sending password reset email...");

    await sendPasswordResetEmail(auth, email);

    hideProcessing();

    if (messageElement) {
      messageElement.textContent =
        "Password reset email sent. Please check your inbox.";
    }
  } catch (error) {
    console.error(`${roleName} password reset error:`, error);

    hideProcessing();

    if (messageElement) {
      messageElement.textContent =
        error.code === "auth/invalid-email"
          ? "Please enter a valid email address."
          : "Unable to send the reset email. Please check the email and try again.";
    }
  }
}

function resetPassword() {
  return resetPasswordForRole({
    inputId: "username",
    messageId: "studentLoginMessage",
    roleName: "Student",
  });
}

function resetFacultyPassword() {
  return resetPasswordForRole({
    inputId: "facultyUsername",
    messageId: "facultyLoginMessage",
    roleName: "Faculty",
  });
}

function resetAdminPassword() {
  return resetPasswordForRole({
    inputId: "adminUsername",
    messageId: "adminLoginMessage",
    roleName: "Admin",
  });
}

window.resetPassword = resetPassword;

/* =========================
   SHOW / HIDE PASSWORDS
========================= */

function initializePasswordToggle() {
  const passwordToggles = [
    {
      inputId: "password",
      buttonId: "togglePasswordBtn",
    },
    {
      inputId: "facultyPassword",
      buttonId: "toggleFacultyPasswordBtn",
    },
    {
      inputId: "adminPassword",
      buttonId: "toggleAdminPasswordBtn",
    },
  ];

  passwordToggles.forEach(({ inputId, buttonId }) => {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = document.getElementById(buttonId);

    if (!passwordInput || !toggleButton) return;
    if (toggleButton.dataset.initialized === "true") return;

    toggleButton.dataset.initialized = "true";

    const openEye = toggleButton.querySelector(".eye-open");
    const closedEye = toggleButton.querySelector(".eye-closed");

    toggleButton.addEventListener("click", () => {
      const shouldShow = passwordInput.type === "password";

      passwordInput.type = shouldShow ? "text" : "password";

      if (openEye) openEye.hidden = shouldShow;
      if (closedEye) closedEye.hidden = !shouldShow;

      toggleButton.setAttribute(
        "aria-label",
        shouldShow ? "Hide password" : "Show password",
      );

      toggleButton.setAttribute("aria-pressed", String(shouldShow));
    });
  });
}

/* =========================
   MODAL NAVIGATION
========================= */

function initializeModalNavigation() {
  const roleModalElement = document.getElementById("loginModal");
  const studentModalElement = document.getElementById("studentLoginModal");
  const facultyModalElement = document.getElementById("facultyLoginModal");
  const adminModalElement = document.getElementById("adminLoginModal");

  if (
    !roleModalElement ||
    !studentModalElement ||
    !facultyModalElement ||
    !adminModalElement ||
    !window.bootstrap?.Modal
  ) {
    console.error(
      "One or more login modals are missing, or Bootstrap JavaScript is not loaded.",
    );
    return;
  }

  const roleModal = bootstrap.Modal.getOrCreateInstance(roleModalElement);
  const studentModal = bootstrap.Modal.getOrCreateInstance(studentModalElement);
  const facultyModal = bootstrap.Modal.getOrCreateInstance(facultyModalElement);
  const adminModal = bootstrap.Modal.getOrCreateInstance(adminModalElement);

  function switchModal(fromElement, fromModal, toModal) {
    fromElement.addEventListener("hidden.bs.modal", () => toModal.show(), {
      once: true,
    });

    fromModal.hide();
  }

  // Open Student login.
  document.getElementById("openStudentLogin")?.addEventListener("click", () => {
    switchModal(roleModalElement, roleModal, studentModal);
  });

  // Back to role selection from Student login.
  document.getElementById("studentBackBtn")?.addEventListener("click", () => {
    switchModal(studentModalElement, studentModal, roleModal);
  });

  // Open Faculty login.
  document.getElementById("openFacultyLogin")?.addEventListener("click", () => {
    switchModal(roleModalElement, roleModal, facultyModal);
  });

  // Back to role selection from Faculty login.
  document.getElementById("facultyBackBtn")?.addEventListener("click", () => {
    switchModal(facultyModalElement, facultyModal, roleModal);
  });

  // Open Admin login in the same page.
  document.getElementById("openAdminLogin")?.addEventListener("click", () => {
    switchModal(roleModalElement, roleModal, adminModal);
  });

  // Back to role selection from Admin login.
  document.getElementById("adminBackBtn")?.addEventListener("click", () => {
    switchModal(adminModalElement, adminModal, roleModal);
  });

  // Password reset links.
  document
    .getElementById("studentForgotPassword")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      resetPassword();
    });

  document
    .getElementById("facultyForgotPassword")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      resetFacultyPassword();
    });

  document
    .getElementById("adminForgotPassword")
    ?.addEventListener("click", (event) => {
      event.preventDefault();
      resetAdminPassword();
    });
}

/* =========================
   CONNECT LOGIN FORMS
========================= */

function initializeLoginForm() {
  const forms = [
    {
      id: "studentLoginForm",
      handler: login,
    },
    {
      id: "facultyLoginForm",
      handler: facultyLogin,
    },
    {
      id: "adminLoginForm",
      handler: adminLogin,
    },
  ];

  forms.forEach(({ id, handler }) => {
    const form = document.getElementById(id);

    if (!form || form.dataset.initialized === "true") return;

    form.dataset.initialized = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handler();
    });
  });
}

/* =========================
   INITIALIZE LOGIN PAGE
========================= */

function initializeLoginPage() {
  initializePasswordToggle();
  initializeModalNavigation();
  initializeLoginForm();
}

/* =========================
   EXPORT FUNCTIONS
========================= */

window.login = login;
window.facultyLogin = facultyLogin;
window.adminLogin = adminLogin;

window.resetPassword = resetPassword;
window.resetFacultyPassword = resetFacultyPassword;
window.resetAdminPassword = resetAdminPassword;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeLoginPage, {
    once: true,
  });
} else {
  initializeLoginPage();
}
