import { auth, db } from "./firebase-config.js";

import {
  signOut,
  updateEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let currentUser = null;

let originalProfile = {
  fullname: "ADMIN",
  email: "",
  role: "ADMIN"
};


/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, (user) => {

  if (!user) {
    currentUser = null;
    return;
  }

  currentUser = user;

  console.log(
    "Admin Profile Auth:",
    user.email
  );

});


/* =========================
   PROFILE MENU
========================= */

function toggleProfileMenu() {

  const menu =
    document.getElementById("profile-menu");

  if (!menu) return;

  menu.classList.toggle("active");

}


/* =========================
   CLOSE PROFILE MENU
   WHEN CLICKING OUTSIDE
========================= */

document.addEventListener("click", (event) => {

  const wrapper =
    document.querySelector(".profile-wrapper");

  const menu =
    document.getElementById("profile-menu");

  if (!wrapper || !menu) return;

  if (!wrapper.contains(event.target)) {

    menu.classList.remove("active");

  }

});


/* =========================
   OPEN PROFILE
========================= */

async function openProfile() {

  const user =
    currentUser || auth.currentUser;

  if (!user) {

    console.error(
      "No authenticated admin user."
    );

    return;

  }


  const overlay =
    document.getElementById("profile-overlay");

  const fullnameInput =
    document.getElementById("profile-fullname");

  const emailInput =
    document.getElementById("profile-email");

  const roleInput =
    document.getElementById("profile-role");

  const avatar =
    document.getElementById("profile-avatar");

  const message =
    document.getElementById("profile-message");


  if (!overlay) {

    console.error(
      "profile-overlay was not found."
    );

    return;

  }


  try {

    const userRef =
      doc(db, "users", user.uid);

    const userSnap =
      await getDoc(userRef);


    let fullname = "ADMIN";
    let email = user.email || "";
    let role = "ADMIN";


    if (userSnap.exists()) {

      const data =
        userSnap.data();


      fullname =
        data.fullname ||
        data.name ||
        "ADMIN";


      email =
        data.email ||
        user.email ||
        "";


      role =
        data.role ||
        "ADMIN";

    }


    originalProfile = {
      fullname: fullname,
      email: email,
      role: role
    };


    if (fullnameInput) {

      fullnameInput.value =
        fullname;

    }


    if (emailInput) {

      emailInput.value =
        email;

    }


    if (roleInput) {

      roleInput.value =
        role;

    }


    if (avatar) {

      avatar.textContent =
        fullname
          .trim()
          .charAt(0)
          .toUpperCase() || "A";

    }


    resetProfileEdit();


    if (message) {

      message.textContent = "";

      message.className =
        "profile-message";

    }


    const menu =
      document.getElementById("profile-menu");

    if (menu) {

      menu.classList.remove("active");

    }


    overlay.classList.add("active");

    overlay.style.display =
      "flex";

    document.body.style.overflow =
      "hidden";


    console.log(
      "Admin profile opened."
    );

  }
  catch (error) {

    console.error(
      "Admin profile error:",
      error
    );

    showProfileMessage(
      "Unable to load your profile.",
      "error"
    );

  }

}


/* =========================
   ENABLE PROFILE EDIT
========================= */

function enableProfileEdit() {

  const fullnameInput =
    document.getElementById("profile-fullname");

  const emailInput =
    document.getElementById("profile-email");

  const editBtn =
    document.getElementById("edit-profile-btn");

  const cancelBtn =
    document.getElementById("cancel-profile-btn");

  const saveBtn =
    document.getElementById("save-profile-btn");


  if (fullnameInput) {

    fullnameInput.disabled =
      false;

  }


  if (emailInput) {

    emailInput.disabled =
      false;

  }


  if (fullnameInput) {

    fullnameInput.focus();

  }


  if (editBtn) {

    editBtn.style.display =
      "none";

  }


  if (cancelBtn) {

    cancelBtn.style.display =
      "inline-block";

  }


  if (saveBtn) {

    saveBtn.style.display =
      "inline-block";

  }

}


/* =========================
   CANCEL PROFILE EDIT
========================= */

function cancelProfileEdit() {

  const fullnameInput =
    document.getElementById("profile-fullname");

  const emailInput =
    document.getElementById("profile-email");


  if (fullnameInput) {

    fullnameInput.value =
      originalProfile.fullname;

  }


  if (emailInput) {

    emailInput.value =
      originalProfile.email;

  }


  resetProfileEdit();

}


/* =========================
   RESET PROFILE EDIT
========================= */

function resetProfileEdit() {

  const fullnameInput =
    document.getElementById("profile-fullname");

  const emailInput =
    document.getElementById("profile-email");

  const roleInput =
    document.getElementById("profile-role");

  const editBtn =
    document.getElementById("edit-profile-btn");

  const cancelBtn =
    document.getElementById("cancel-profile-btn");

  const saveBtn =
    document.getElementById("save-profile-btn");


  if (fullnameInput) {

    fullnameInput.disabled =
      true;

  }


  if (emailInput) {

    emailInput.disabled =
      true;

  }


  if (roleInput) {

    roleInput.disabled =
      true;

  }


  if (editBtn) {

    editBtn.style.display =
      "inline-block";

  }


  if (cancelBtn) {

    cancelBtn.style.display =
      "none";

  }


  if (saveBtn) {

    saveBtn.style.display =
      "none";

  }

}


/* =========================
   SAVE PROFILE
========================= */

async function saveProfile() {

  const user =
    currentUser || auth.currentUser;

  if (!user) return;


  const fullnameInput =
    document.getElementById("profile-fullname");

  const emailInput =
    document.getElementById("profile-email");


  const fullname =
    fullnameInput
      ? fullnameInput.value.trim()
      : "";


  const email =
    emailInput
      ? emailInput.value.trim()
      : "";


  if (!fullname) {

    showProfileMessage(
      "Name cannot be empty.",
      "error"
    );

    return;

  }


  if (!email) {

    showProfileMessage(
      "Email cannot be empty.",
      "error"
    );

    return;

  }


  try {

    if (email !== user.email) {

      await updateEmail(
        user,
        email
      );

    }


    await updateDoc(
      doc(db, "users", user.uid),
      {
        fullname: fullname,
        email: email,
        role: originalProfile.role
      }
    );


    originalProfile = {

      fullname: fullname,

      email: email,

      role: originalProfile.role

    };


    const avatar =
      document.getElementById(
        "profile-avatar"
      );


    if (avatar) {

      avatar.textContent =
        fullname
          .trim()
          .charAt(0)
          .toUpperCase() || "A";

    }


    resetProfileEdit();


    showProfileMessage(
      "Profile updated successfully.",
      "success"
    );

  }
  catch (error) {

    console.error(
      "Save profile error:",
      error
    );

    showProfileMessage(
      error.message,
      "error"
    );

  }

}


/* =========================
   PROFILE MESSAGE
========================= */

function showProfileMessage(
  message,
  type
) {

  const element =
    document.getElementById(
      "profile-message"
    );

  if (!element) return;


  element.textContent =
    message;

  element.className =
    "profile-message " +
    type;

}


/* =========================
   CLOSE PROFILE
========================= */

function closeProfile() {

  const overlay =
    document.getElementById(
      "profile-overlay"
    );

  if (!overlay) return;


  overlay.classList.remove(
    "active"
  );

  overlay.style.display =
    "none";

  document.body.style.overflow =
    "";

}


/* =========================
   CLOSE PROFILE OUTSIDE
========================= */

function closeProfileOutside(event) {

  if (
    event.target.id ===
    "profile-overlay"
  ) {

    closeProfile();

  }

}

/* =========================
   CENTRAL ADMIN LOGOUT
========================= */

function logout() {

  const overlay =
    document.getElementById(
      "logout-overlay"
    );

  if (!overlay) {

    console.error(
      "logout-overlay was not found on this page."
    );

    return;

  }


  overlay.classList.add(
    "active"
  );

  overlay.style.display =
    "flex";

  document.body.style.overflow =
    "hidden";

}


/* =========================
   CLOSE LOGOUT MODAL
========================= */

function closeLogoutModal() {

  const overlay =
    document.getElementById(
      "logout-overlay"
    );

  if (!overlay) return;


  overlay.classList.remove(
    "active"
  );

  overlay.style.display =
    "none";

  document.body.style.overflow =
    "";

}


/* =========================
   CLOSE LOGOUT OUTSIDE
========================= */

function closeLogoutOutside(event) {

  if (
    event &&
    event.target &&
    event.target.id ===
      "logout-overlay"
  ) {

    closeLogoutModal();

  }

}


/* =========================
   PERFORM LOGOUT
========================= */

async function performLogout() {

  try {

    await signOut(auth);

    localStorage.clear();

    window.location.replace(
      "./admin-login.html"
    );

  }
  catch (error) {

    console.error(
      "Logout error:",
      error
    );

  }

}


/* =========================
   GLOBAL FUNCTIONS
========================= */

window.toggleProfileMenu =
  toggleProfileMenu;

window.openProfile =
  openProfile;

window.enableProfileEdit =
  enableProfileEdit;

window.cancelProfileEdit =
  cancelProfileEdit;

window.saveProfile =
  saveProfile;

window.closeProfile =
  closeProfile;

window.closeProfileOutside =
  closeProfileOutside;


/* =========================
   CENTRAL LOGOUT
========================= */
window.logout =
  logout;

window.openDashboardLogout =
  logout;

window.closeDashboardLogout =
  closeLogoutModal;

window.closeDashboardLogoutOutside =
  closeLogoutOutside;

window.confirmDashboardLogout =
  performLogout;

window.closeLogoutModal =
  closeLogoutModal;

window.closeLogoutOutside =
  closeLogoutOutside;

window.performLogout =
  performLogout;
