import { auth, db } from "./firebase-config.js";

import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert, appConfirm } from "./ui-dialog.js";

/* AUTH PROTECTION */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../Login.html");
  }
});

/* PREVENT BACK BUTTON CACHE */

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

/* GLOBAL DATA */

let currentFilter = "all";

let allUsers = [];

let usersLoaded = false;

let sections = [];

let specializations = [];

/* SIDEBAR */

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

/* NAVIGATION */

function goPage(url) {
  window.location.href = url;
}

/* LOGOUT */

function logout() {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.add("show");
  }
}

function closeLogoutConfirmation() {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.remove("show");
  }
}

async function confirmLogout() {
  try {
    await signOut(auth);

    localStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);
  }
}

/* HELPERS */

function isTerminatedForCheating(user) {
  return user.active !== true && !!user.deactivatedReason;
}

function getStatusText(user) {
  const isInactive = user.active !== true;

  if (isTerminatedForCheating(user)) {
    return "Terminated (Cheating)";
  }

  if (user.role === "Faculty" && isInactive) {
    return "Pending Approval";
  }

  if (isInactive) {
    return "Not Active";
  }

  return "Active";
}

/* LOAD SECTIONS AND SPECIALIZATIONS */

async function loadAcademicData() {
  try {
    const [sectionsSnapshot, specializationsSnapshot] = await Promise.all([
      getDocs(collection(db, "sections")),

      getDocs(collection(db, "specializations")),
    ]);

    /* SECTIONS */

    sections = [];

    sectionsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const sectionName = data.section || data.name || data.title || docSnap.id;

      if (sectionName) {
        sections.push(sectionName);
      }
    });

    /* SPECIALIZATIONS */

    specializations = [];

    specializationsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const specializationName =
        data.specialization || data.name || data.title || docSnap.id;

      if (specializationName) {
        specializations.push(specializationName);
      }
    });

    /* REMOVE DUPLICATES */

    sections = [...new Set(sections)].sort();

    specializations = [...new Set(specializations)].sort();
  } catch (error) {
    console.error("Error loading academic data:", error);
  }
}

/* LOAD USERS */

async function loadUsers() {
  if (usersLoaded) {
    renderTable();

    return;
  }

  try {
    await loadAcademicData();

    const querySnapshot = await getDocs(collection(db, "users"));

    allUsers = [];

    querySnapshot.forEach((docSnap) => {
      allUsers.push({
        id: docSnap.id,

        ...docSnap.data(),
      });
    });

    usersLoaded = true;

    renderTable();
  } catch (error) {
    console.error("Error loading users:", error);

    const table = document.getElementById("userTable");

    if (table) {
      table.innerHTML = `

                <tr class="no-data">

                    <td colspan="6">
                        Unable to load users
                    </td>

                </tr>

            `;
    }
  }
}

/* FILTER BY ROLE */

function filterByRole(role) {
  currentFilter = role;

  renderTable();
}

window.filterByRole = filterByRole;

/* CREATE SECTION DROPDOWN */

function createSectionSelect(user) {
  const select = document.createElement("select");

  select.className = "assignment-select";

  const notAssigned = document.createElement("option");

  notAssigned.value = "";

  notAssigned.textContent = "Not Assigned";

  select.appendChild(notAssigned);

  sections.forEach((section) => {
    const option = document.createElement("option");

    option.value = section;

    option.textContent = section;

    select.appendChild(option);
  });

  select.value = user.section || "";

  select.addEventListener("change", async () => {
    select.disabled = true;

    await updateAssignment(user.id, "section", select.value);

    select.disabled = false;
  });

  return select;
}

/* CREATE SPECIALIZATION DROPDOWN */

function createSpecializationSelect(user) {
  const select = document.createElement("select");

  select.className = "assignment-select";

  const notAssigned = document.createElement("option");

  notAssigned.value = "";

  notAssigned.textContent = "Not Assigned";

  select.appendChild(notAssigned);

  specializations.forEach((specialization) => {
    const option = document.createElement("option");

    option.value = specialization;

    option.textContent = specialization;

    select.appendChild(option);
  });

  select.value = user.specialization || "";

  select.addEventListener("change", async () => {
    select.disabled = true;

    await updateAssignment(user.id, "specialization", select.value);

    select.disabled = false;
  });

  return select;
}

/* UPDATE ASSIGNMENT */

async function updateAssignment(userId, field, value) {
  try {
    const userRef = doc(db, "users", userId);

    await updateDoc(userRef, {
      [field]: value,
    });

    const user = allUsers.find((item) => item.id === userId);

    if (user) {
      user[field] = value;
    }

    renderTable();
  } catch (error) {
    console.error("Error updating assignment:", error);

    await appAlert("Unable to save the assignment.", { type: "error" });

    renderTable();
  }
}

/* RENDER USER TABLE */

function renderTable() {
  const table = document.getElementById("userTable");

  if (!table) {
    return;
  }

  const searchInput = document.getElementById("searchInput");

  const search = searchInput?.value.trim().toLowerCase() || "";

  table.innerHTML = "";

  let filtered = allUsers;

  /* STUDENTS */

  if (currentFilter === "Student") {
    filtered = allUsers.filter((user) => user.role === "Student");
  }

  /* FACULTY + ADMIN */

  if (currentFilter === "Faculty/Admin") {
    filtered = allUsers.filter(
      (user) =>
        user.role === "Faculty" ||
        user.role === "Admin" ||
        user.role === "ADMIN",
    );
  }

  /* SEARCH (name, role, section, specialization, status) */

  filtered = filtered.filter((user) => {
    const name = (
      user.fullname ||
      user.email ||
      user.studentNumber ||
      ""
    ).toLowerCase();

    const role = (user.role || "").toLowerCase();

    const section = (user.section || "").toLowerCase();

    const specialization = (user.specialization || "").toLowerCase();

    const status = getStatusText(user).toLowerCase();

    return (
      name.includes(search) ||
      role.includes(search) ||
      section.includes(search) ||
      specialization.includes(search) ||
      status.includes(search)
    );
  });

  /* NO USERS */

  if (filtered.length === 0) {
    table.innerHTML = `

            <tr class="no-data">

                <td colspan="6">
                    No users found
                </td>

            </tr>

        `;

    return;
  }

  /* CREATE ROWS */

  filtered.forEach((user) => {
    const row = document.createElement("tr");

    /* USER */

    const nameCell = document.createElement("td");

    nameCell.textContent =
      user.fullname || user.email || user.studentNumber || "Unknown";

    /* ROLE */

    const roleCell = document.createElement("td");

    roleCell.textContent = user.role || "";

    /* SECTION */

    const sectionCell = document.createElement("td");

    if (user.role === "Student") {
      sectionCell.appendChild(createSectionSelect(user));
    } else {
      sectionCell.textContent = "—";
    }

    /* SPECIALIZATION */

    const specializationCell = document.createElement("td");

    if (user.role === "Faculty") {
      specializationCell.appendChild(createSpecializationSelect(user));
    } else {
      specializationCell.textContent = "—";
    }

    /* STATUS */

    const statusCell = document.createElement("td");

    const isInactive = user.active !== true;

    statusCell.textContent = getStatusText(user);

    if (isTerminatedForCheating(user)) {
      /* Hover to see why the account was locked */

      statusCell.title = user.deactivatedReason;

      statusCell.style.color = "#a52e3c";

      statusCell.style.fontWeight = "600";
    }

    /* ACTIVATE / DEACTIVATE */

    const toggleCell = document.createElement("td");

    const label = document.createElement("label");

    label.className = "switch";

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";

    checkbox.checked = !isInactive;

    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;

      await toggleUser(user.id, isInactive, user.role);
    });

    const slider = document.createElement("span");

    slider.className = "slider";

    label.appendChild(checkbox);

    label.appendChild(slider);

    toggleCell.appendChild(label);

    /* ADD CELLS */

    row.appendChild(nameCell);

    row.appendChild(roleCell);

    row.appendChild(sectionCell);

    row.appendChild(specializationCell);

    row.appendChild(statusCell);

    row.appendChild(toggleCell);

    table.appendChild(row);
  });
}

/* ACTIVATE / DEACTIVATE USER */

async function toggleUser(userId, isInactive, role) {
  const targetUser = allUsers.find((item) => item.id === userId);

  if (isInactive) {
    let confirmMessage = "Do you want to activate this account?";

    if (role === "Faculty") {
      confirmMessage = "Do you want to approve this Faculty account?";
    }

    /* Student locked out by the exam anti-cheat system */

    if (targetUser && isTerminatedForCheating(targetUser)) {
      confirmMessage =
        "This account was deactivated because of an " +
        "exam violation:\n\n" +
        targetUser.deactivatedReason +
        "\n\nReactivate it so the student can log in " +
        "and retake the exam?";
    }

    const wasCheating = targetUser && isTerminatedForCheating(targetUser);

    const confirmActivate = await appConfirm(confirmMessage, {
      title: wasCheating
        ? "Reactivate Student Account"
        : role === "Faculty"
          ? "Approve Faculty Account"
          : "Activate Account",

      confirmText: wasCheating
        ? "Reactivate"
        : role === "Faculty"
          ? "Approve"
          : "Activate",

      type: "question",
    });

    if (!confirmActivate) {
      renderTable();

      return;
    }
  } else {
    const confirmDeactivate = await appConfirm(
      "Do you want to deactivate this account?",
      {
        title: "Deactivate Account",

        confirmText: "Deactivate",

        type: "warning",

        danger: true,
      },
    );

    if (!confirmDeactivate) {
      renderTable();

      return;
    }
  }

  try {
    const newActiveState = isInactive;

    const updates = {
      active: newActiveState,
    };

    /* Reactivating clears the cheating lock information */

    if (newActiveState) {
      updates.deactivatedReason = deleteField();

      updates.deactivatedAt = deleteField();
    }

    await updateDoc(
      doc(db, "users", userId),

      updates,
    );

    if (targetUser) {
      targetUser.active = newActiveState;

      if (newActiveState) {
        delete targetUser.deactivatedReason;

        delete targetUser.deactivatedAt;
      }
    }

    renderTable();
  } catch (error) {
    console.error("Error updating user:", error);

    await appAlert("Unable to update account status.", { type: "error" });

    renderTable();
  }
}

/* SEARCH */

function searchUsers() {
  renderTable();
}

window.searchUsers = searchUsers;

/* PAGE LOAD */

document.addEventListener("DOMContentLoaded", async () => {
  await loadUsers();
});

/* GLOBAL FUNCTIONS */

window.toggleSidebar = toggleSidebar;

window.goPage = goPage;

window.logout = logout;

window.closeLogoutConfirmation = closeLogoutConfirmation;

window.confirmLogout = confirmLogout;
