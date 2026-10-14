import { db, auth } from "./firebase-config.js";

import {
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* AUTHENTICATION */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../Login.html");
  }
});

/* BACK BUTTON PROTECTION */

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

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

/* =========================================================
   LOGOUT MODAL (unchanged)
========================================================= */

function hideLogoutModal() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.remove("active");

  overlay.style.display = "none";

  document.body.style.overflow = "";
}

/* =========================================================
   OPEN LOGOUT MODAL
========================================================= */

function logout() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    console.error("Logout modal not found.");

    return;
  }

  overlay.classList.add("active");

  overlay.style.display = "flex";

  document.body.style.overflow = "hidden";
}

/* =========================================================
   CLOSE LOGOUT MODAL
========================================================= */

function closeLogoutModal() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.remove("active");

  overlay.style.display = "none";

  document.body.style.overflow = "";
}

/* =========================================================
   CLOSE LOGOUT MODAL OUTSIDE
========================================================= */

function closeLogoutOutside(event) {
  if (event && event.target && event.target.id === "logout-overlay") {
    closeLogoutModal();
  }
}

/* =========================================================
   CONFIRM LOGOUT
========================================================= */

async function confirmLogout() {
  const confirmButton = document.querySelector(".logout-confirm-btn");

  if (confirmButton) {
    confirmButton.disabled = true;

    confirmButton.textContent = "Logging out...";
  }

  try {
    await signOut(auth);

    localStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);

    if (confirmButton) {
      confirmButton.disabled = false;

      confirmButton.textContent = "Log Out";
    }

    alert("Unable to log out. Please try again.");
  }
}

/* LOAD EVERYTHING */

async function loadAll() {
  /*
   * These collections are independent,
   * so load them at the same time.
   */

  await Promise.all([loadSpecs(), loadSections(), loadAcademicYears()]);
}

/* SPECIALIZATIONS */

async function addSpec() {
  const input = document.getElementById("specInput");

  const value = input.value.trim();

  if (value === "") {
    alert("Enter specialization");

    return;
  }

  try {
    await addDoc(collection(db, "specializations"), {
      name: value,
    });

    input.value = "";

    await loadSpecs();
  } catch (error) {
    console.error("Error adding specialization:", error);

    alert(error.message);
  }
}

/* LOAD SPECIALIZATIONS */

async function loadSpecs() {
  const list = document.getElementById("specList");

  const dropdown = document.getElementById("specDropdown");

  if (list) {
    list.innerHTML = "";
  }

  if (dropdown) {
    dropdown.innerHTML = `
            <option value="">
                Select Specialization
            </option>
        `;
  }

  try {
    const snapshot = await getDocs(collection(db, "specializations"));

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const name = data.name || "";

      if (list) {
        const item = document.createElement("div");

        item.className = "manage-item";

        item.innerHTML = `
                    <span></span>
                    <button
                        onclick="deleteSpec('${docSnap.id}')">
                        Delete
                    </button>
                `;

        item.querySelector("span").textContent = name;

        list.appendChild(item);
      }

      if (dropdown) {
        const option = document.createElement("option");

        option.value = name;

        option.textContent = name;

        dropdown.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error loading specializations:", error);
  }
}

/* DELETE SPECIALIZATION */

async function deleteSpec(id) {
  if (!confirm("Delete specialization?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "specializations", id));

    await loadSpecs();
  } catch (error) {
    console.error("Error deleting specialization:", error);

    alert(error.message);
  }
}

/* SECTIONS */

async function addSec() {
  const input = document.getElementById("secInput");

  const value = input.value.trim();

  if (value === "") {
    alert("Enter section");

    return;
  }

  try {
    await addDoc(collection(db, "sections"), {
      name: value,
    });

    input.value = "";

    await loadSections();
  } catch (error) {
    console.error("Error adding section:", error);

    alert(error.message);
  }
}

/* LOAD SECTIONS */

async function loadSections() {
  const list = document.getElementById("secList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "sections"));

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const item = document.createElement("div");

      item.className = "manage-item";

      item.innerHTML = `
                <span></span>
                <button>
                    Delete
                </button>
            `;

      item.querySelector("span").textContent = data.name || "";

      list.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading sections:", error);
  }
}

/* DELETE SECTION */

async function deleteSec(id) {
  if (!confirm("Delete section?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "sections", id));

    await loadSections();
  } catch (error) {
    console.error("Error deleting section:", error);

    alert(error.message);
  }
}

/* ACADEMIC YEARS */

async function addAcademicYear() {
  const input = document.getElementById("yearInput");

  const value = input.value.trim();

  if (value === "") {
    alert("Enter academic year");

    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "academicYears"));

    const exists = snapshot.docs.some(
      (docSnap) => docSnap.data().year === value,
    );

    if (exists) {
      alert("Academic Year already exists.");

      return;
    }

    await addDoc(collection(db, "academicYears"), {
      year: value,
      active: false,
    });

    input.value = "";

    await loadAcademicYears();
  } catch (error) {
    console.error("Error adding academic year:", error);

    alert(error.message);
  }
}

/* LOAD ACADEMIC YEARS */

async function loadAcademicYears() {
  const list = document.getElementById("yearList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "academicYears"));

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const item = document.createElement("div");

      item.className = "manage-item";

      const name = document.createElement("b");

      name.textContent = data.year || "";

      item.appendChild(name);

      if (data.active) {
        item.appendChild(document.createTextNode(" (Active)"));
      }

      const buttons = document.createElement("div");

      const activeButton = document.createElement("button");

      activeButton.textContent = "Set Active";

      activeButton.onclick = () => setActiveYear(docSnap.id);

      const deleteButton = document.createElement("button");

      deleteButton.textContent = "Delete";

      deleteButton.onclick = () => deleteAcademicYear(docSnap.id);

      buttons.appendChild(activeButton);

      buttons.appendChild(deleteButton);

      item.appendChild(buttons);

      list.appendChild(item);
    });
  } catch (error) {
    console.error("Error loading academic years:", error);
  }
}

/* SET ACTIVE ACADEMIC YEAR */

async function setActiveYear(id) {
  try {
    const snapshot = await getDocs(collection(db, "academicYears"));

    let batch = writeBatch(db);

    let operationCount = 0;

    for (const yearDoc of snapshot.docs) {
      const yearRef = doc(db, "academicYears", yearDoc.id);

      batch.update(yearRef, {
        active: yearDoc.id === id,
      });

      operationCount++;

      if (operationCount === 450) {
        await batch.commit();

        batch = writeBatch(db);

        operationCount = 0;
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    await loadAcademicYears();
  } catch (error) {
    console.error("Error setting active academic year:", error);

    alert(error.message);
  }
}

/* DELETE ACADEMIC YEAR */

async function deleteAcademicYear(id) {
  if (!confirm("Delete Academic Year?")) {
    return;
  }

  try {
    await deleteDoc(doc(db, "academicYears", id));

    await loadAcademicYears();
  } catch (error) {
    console.error("Error deleting academic year:", error);

    alert(error.message);
  }
}

/* PAGE LOAD */

document.addEventListener("DOMContentLoaded", async () => {
  hideLogoutModal();

  await loadAll();
});

/* EXPORTS */

window.toggleSidebar = toggleSidebar;

window.goPage = goPage;

window.logout = logout;

window.closeLogoutModal = closeLogoutModal;

window.closeLogoutOutside = closeLogoutOutside;

window.confirmLogout = confirmLogout;

/* SPECIALIZATIONS */

window.addSpec = addSpec;

window.deleteSpec = deleteSpec;

/* SECTIONS */

window.addSec = addSec;

window.deleteSec = deleteSec;

/* ACADEMIC YEARS */

window.addAcademicYear = addAcademicYear;

window.setActiveYear = setActiveYear;

window.deleteAcademicYear = deleteAcademicYear;
