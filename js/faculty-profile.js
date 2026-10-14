import { auth, db } from "./firebase-config.js";

import {
  signOut,
  updateEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert, appConfirm } from "./ui-dialog.js";

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentUser = null;

let originalProfile = {
  fullname: "",
  email: "",
  academicYear: "",
  role: "Faculty",
  specialization: "",
};

let profileLoading = false;
let profileSaving = false;
let logoutInProgress = false;

// ============================================================
// HELPERS
// ============================================================

function getElement(id) {
  return document.getElementById(id);
}

function normalizeRole(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function setBodyScroll(locked) {
  document.body.style.overflow = locked ? "hidden" : "";
}

function setProfileMessage(message = "", type = "") {
  const element = getElement("profile-message");

  if (!element) return;

  element.textContent = message;
  element.className = "profile-message";

  if (type) {
    element.classList.add(type);
  }
}

function setButtonLoading(buttonId, loading, loadingText = "Saving...") {
  const button = getElement(buttonId);

  if (!button) return;

  if (loading) {
    if (button.dataset.originalText === undefined) {
      button.dataset.originalText = button.textContent;
    }

    button.textContent = loadingText;
    button.disabled = true;
  } else {
    if (button.dataset.originalText !== undefined) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }

    button.disabled = false;
  }
}

function updateProfileAvatar(fullname) {
  const avatar = getElement("profile-avatar");

  if (!avatar) return;

  const trimmedName = String(fullname ?? "").trim();

  avatar.textContent = trimmedName ? trimmedName.charAt(0).toUpperCase() : "F";
}

function closeProfileMenu() {
  getElement("profile-menu")?.classList.remove("active");
}

// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(auth, (user) => {
  currentUser = user || null;

  if (!user) {
    // Do not use a browser alert here.
    // The protected page can handle redirecting to login.

    return;
  }

  console.log("Faculty Profile Authenticated:", user.email || user.uid);
});

// ============================================================
// PROFILE MENU
// ============================================================

function toggleProfileMenu() {
  const menu = getElement("profile-menu");

  if (!menu) return;

  menu.classList.toggle("active");
}

document.addEventListener("click", (event) => {
  const wrapper = document.querySelector(".profile-wrapper");
  const menu = getElement("profile-menu");

  if (!wrapper || !menu) return;

  if (!wrapper.contains(event.target)) {
    menu.classList.remove("active");
  }
});

// ============================================================
// OPEN PROFILE MODAL
// ============================================================

async function openProfile() {
  if (profileLoading) return;

  const user = currentUser || auth.currentUser;

  if (!user) {
    await appAlert(
      "Your faculty session could not be found. Please log in again.",
      {
        type: "error",
        title: "Session Expired",
      },
    );

    return;
  }

  const overlay = getElement("profile-overlay");

  if (!overlay) {
    console.error("profile-overlay was not found on this page.");

    await appAlert(
      "The profile window could not be opened because its HTML element is missing.",
      {
        type: "error",
        title: "Profile Unavailable",
      },
    );

    return;
  }

  profileLoading = true;
  closeProfileMenu();

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await appAlert(
        "Your faculty profile could not be found in the database.",
        {
          type: "error",
          title: "Profile Not Found",
        },
      );

      return;
    }

    const data = userSnap.data();

    const fullname = String(data.fullname || data.name || "Faculty").trim();

    const email = String(data.email || user.email || "").trim();

    const academicYear = String(
      data.activeAcademicYear || data.academicYear || "",
    ).trim();

    const role = String(data.role || "Faculty").trim();

    const specialization = String(data.specialization || "").trim();

    originalProfile = {
      fullname,
      email,
      academicYear,
      role,
      specialization,
    };

    const fullnameInput = getElement("profile-fullname");
    const emailInput = getElement("profile-email");
    const academicYearInput = getElement("profile-academic-year");
    const roleInput = getElement("profile-role");

    if (fullnameInput) fullnameInput.value = fullname;
    if (emailInput) emailInput.value = email;
    if (academicYearInput) academicYearInput.value = academicYear;
    if (roleInput) roleInput.value = role;

    updateProfileAvatar(fullname);
    resetProfileEdit();
    setProfileMessage();

    overlay.classList.add("active");
    overlay.style.display = "flex";
    setBodyScroll(true);
  } catch (error) {
    console.error("Open faculty profile error:", error);

    await appAlert(
      "Unable to load your profile. Please check your connection and try again.",
      {
        type: "error",
        title: "Profile Loading Failed",
      },
    );
  } finally {
    profileLoading = false;
  }
}

// ============================================================
// ENABLE PROFILE EDIT
// ============================================================

function enableProfileEdit() {
  const fullnameInput = getElement("profile-fullname");
  const emailInput = getElement("profile-email");

  if (fullnameInput) {
    fullnameInput.disabled = false;
  }

  if (emailInput) {
    emailInput.disabled = false;
  }

  if (fullnameInput) {
    fullnameInput.focus();
  }

  const editBtn = getElement("edit-profile-btn");
  const cancelBtn = getElement("cancel-profile-btn");
  const saveBtn = getElement("save-profile-btn");

  if (editBtn) editBtn.style.display = "none";
  if (cancelBtn) cancelBtn.style.display = "inline-block";
  if (saveBtn) saveBtn.style.display = "inline-block";

  setProfileMessage();
}

// ============================================================
// CANCEL PROFILE EDIT
// ============================================================

function cancelProfileEdit() {
  const fullnameInput = getElement("profile-fullname");
  const emailInput = getElement("profile-email");

  if (fullnameInput) {
    fullnameInput.value = originalProfile.fullname;
  }

  if (emailInput) {
    emailInput.value = originalProfile.email;
  }

  resetProfileEdit();
  setProfileMessage();
}

// ============================================================
// RESET PROFILE EDIT
// ============================================================

function resetProfileEdit() {
  const fullnameInput = getElement("profile-fullname");
  const emailInput = getElement("profile-email");
  const academicYearInput = getElement("profile-academic-year");
  const roleInput = getElement("profile-role");

  if (fullnameInput) fullnameInput.disabled = true;
  if (emailInput) emailInput.disabled = true;
  if (academicYearInput) academicYearInput.disabled = true;
  if (roleInput) roleInput.disabled = true;

  const editBtn = getElement("edit-profile-btn");
  const cancelBtn = getElement("cancel-profile-btn");
  const saveBtn = getElement("save-profile-btn");

  if (editBtn) editBtn.style.display = "inline-block";
  if (cancelBtn) cancelBtn.style.display = "none";
  if (saveBtn) saveBtn.style.display = "none";
}

// ============================================================
// SAVE PROFILE
// ============================================================

async function saveProfile() {
  if (profileSaving) return;

  const user = currentUser || auth.currentUser;

  if (!user) {
    await appAlert("Your session has expired. Please log in again.", {
      type: "error",
      title: "Session Expired",
    });

    return;
  }

  const fullname = getElement("profile-fullname")?.value.trim() || "";
  const email = getElement("profile-email")?.value.trim() || "";

  if (!fullname) {
    setProfileMessage("Full name cannot be empty.", "error");
    return;
  }

  if (!email) {
    setProfileMessage("Email cannot be empty.", "error");
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    setProfileMessage("Please enter a valid email address.", "error");
    return;
  }

  const emailChanged = email !== (user.email || "");

  const confirmed = await appConfirm(
    emailChanged
      ? "Your email address will also be changed in Firebase Authentication. Continue?"
      : "Save your updated profile name?",
    {
      title: "Save Profile Changes",
      confirmText: "Save Changes",
      cancelText: "Cancel",
      type: "question",
    },
  );

  if (!confirmed) return;

  profileSaving = true;
  setButtonLoading("save-profile-btn", true, "Saving...");

  try {
    // Updating a Firebase Auth email can require recent authentication.
    // If Firebase rejects it, the Firestore profile will not be updated.
    if (emailChanged) {
      await updateEmail(user, email);
    }

    await updateDoc(doc(db, "users", user.uid), {
      fullname,
      email,
      role: originalProfile.role,
    });

    originalProfile = {
      ...originalProfile,
      fullname,
      email,
    };

    updateProfileAvatar(fullname);
    resetProfileEdit();
    setProfileMessage("Profile updated successfully.", "success");

    await appAlert("Your profile has been updated successfully.", {
      type: "success",
      title: "Profile Saved",
    });
  } catch (error) {
    console.error("Save profile error:", error);

    let message = "Your profile could not be updated. Please try again.";

    if (error.code === "auth/requires-recent-login") {
      message =
        "For security, Firebase requires you to log in again before changing your email address.";
    } else if (error.code === "auth/email-already-in-use") {
      message = "That email address is already being used by another account.";
    } else if (error.code === "auth/invalid-email") {
      message = "Please enter a valid email address.";
    } else if (error.code === "auth/operation-not-allowed") {
      message = "Email updates are not enabled for this Firebase project.";
    } else if (error.code === "permission-denied") {
      message = "You do not have permission to update this profile.";
    }

    setProfileMessage(message, "error");

    await appAlert(message, {
      type: "error",
      title: "Profile Update Failed",
    });
  } finally {
    profileSaving = false;
    setButtonLoading("save-profile-btn", false);
  }
}

// ============================================================
// CLOSE PROFILE MODAL
// ============================================================

function closeProfile() {
  const overlay = getElement("profile-overlay");

  if (!overlay) return;

  overlay.classList.remove("active");
  overlay.style.display = "none";

  setBodyScroll(false);
}

function closeProfileOutside(event) {
  if (event?.target?.id === "profile-overlay") {
    closeProfile();
  }
}

/*LOGOUT */
function logout() {
  const modal = document.getElementById("logout-overlay");

  if (!modal) {
    console.error("Cannot find #logout-overlay.");
    return;
  }

  modal.classList.add("active");
}

function closeLogoutModal() {
  const modal = document.getElementById("logout-overlay");

  if (modal) {
    modal.classList.remove("active");
  }
}

function closeLogoutOutside(event) {
  if (event.target.id === "logout-overlay") {
    closeLogoutModal();
  }
}

async function performLogout() {
  if (logoutInProgress) return;

  logoutInProgress = true;

  try {
    await signOut(auth);
    window.location.href = "../Login.html";
  } catch (error) {
    logoutInProgress = false;

    console.error("Logout failed:", error);

    await appAlert("Unable to log out. Please try again.", {
      title: "Logout Failed",
      type: "error",
    });
  }
}

// ============================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK
// ============================================================

window.toggleProfileMenu = toggleProfileMenu;
window.openProfile = openProfile;
window.enableProfileEdit = enableProfileEdit;
window.cancelProfileEdit = cancelProfileEdit;
window.saveProfile = saveProfile;
window.closeProfile = closeProfile;
window.closeProfileOutside = closeProfileOutside;

window.logout = logout;
window.closeLogoutModal = closeLogoutModal;
window.closeLogoutOutside = closeLogoutOutside;
window.performLogout = performLogout;
