import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../login.html");

    return;
  }

  loadPage(user);
});

/* =========================================================
   PAGE CACHE FIX
========================================================= */

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

function goPage(url) {
  document.body.style.opacity = "0";

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

/* =========================================================
   LOGOUT
========================================================= */

function logout() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    console.error("Logout overlay not found.");

    return;
  }

  overlay.classList.add("active");
}

function closeLogoutModal() {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.remove("active");
  }
}

function closeLogoutOutside(event) {
  if (event.target && event.target.id === "logout-overlay") {
    closeLogoutModal();
  }
}

async function performLogout() {
  try {
    await signOut(auth);

    localStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);

    alert("Unable to log out.");
  }
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   GET ACTIVE ACADEMIC YEAR
========================================================= */

async function getActiveAcademicYear() {
  const q = query(collection(db, "academicYears"), where("active", "==", true));

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return "";
  }

  return snapshot.docs[0].data().year || "";
}

/* =========================================================
   CHECK IF ADMIN HAS ADMINISTERED AN EXAM
========================================================= */

async function getAdminApprovedSpecializations(academicYear) {
  const q = query(
    collection(db, "questionBank"),
    where("academicYear", "==", academicYear),
  );

  const snapshot = await getDocs(q);

  const approved = new Set();

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();

    /*
     * ONLY ADMIN-ADMINISTERED EXAMS
     */

    if (data.status === "administered" && data.specialization) {
      approved.add(String(data.specialization).trim());
    }
  });

  return Array.from(approved).sort();
}

/* =========================================================
   GET STUDENT RESULTS
========================================================= */

async function getStudentResults(user, academicYear) {
  const q = query(
    collection(db, "results"),
    where("studentUid", "==", user.uid),
    where("academicYear", "==", academicYear),
  );

  const snapshot = await getDocs(q);

  const results = [];

  snapshot.forEach((docSnapshot) => {
    results.push({
      id: docSnapshot.id,

      ...docSnapshot.data(),
    });
  });

  return results;
}

/* =========================================================
   CALCULATE RECOMMENDATION
========================================================= */

function calculateRecommendation(approvedSpecializations, studentResults) {
  const scores = {};

  /*
   * Calculate only from:
   *
   * 1. Current academic year
   * 2. Completed results
   * 3. Admin-approved specializations
   */

  studentResults.forEach((result) => {
    if (result.status !== "Completed" || !result.specialization) {
      return;
    }

    const specialization = String(result.specialization).trim();

    if (!approvedSpecializations.includes(specialization)) {
      return;
    }

    const score = Number(result.score || 0);

    const totalItems = Number(result.totalItems || 0);

    let percentage = score;

    /*
     * Normalize score to percentage.
     */

    if (totalItems > 0) {
      percentage = (score / totalItems) * 100;
    }

    if (!scores[specialization]) {
      scores[specialization] = 0;
    }

    scores[specialization] += percentage;
  });

  /*
   * Make sure every Admin-approved
   * specialization appears.
   */

  approvedSpecializations.forEach((specialization) => {
    if (scores[specialization] === undefined) {
      scores[specialization] = 0;
    }
  });

  const rankings = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (rankings.length === 0) {
    return "";
  }

  return rankings[0][0];
}

/* =========================================================
   LOAD PAGE
========================================================= */

async function loadPage(user) {
  const selectionContainer = document.getElementById("selectionContainer");

  const recommendationBox = document.getElementById("recommendationBox");

  if (!selectionContainer) {
    return;
  }

  selectionContainer.innerHTML = `

        <div class="selection">

            <h2>
                Checking Your Exam Results...
            </h2>

            <p>
                Please wait.
            </p>

        </div>

    `;

  try {
    /* =================================================
           GET USER
        ================================================= */

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      selectionContainer.innerHTML = `

                <div class="selection">

                    <p>
                        User information could not be found.
                    </p>

                </div>

            `;

      return;
    }

    const userData = userSnap.data();

    /* =================================================
           IF ALREADY SELECTED
        ================================================= */

    if (userData.selectedSpecialization) {
      selectionContainer.innerHTML = `

                <div class="selection">

                    <h2>
                        Your Selected Specialization
                    </h2>

                    <br>

                    <h1 style="color:#ff4fa3;">

                        ${escapeHTML(userData.selectedSpecialization)}

                    </h1>

                    <p>
                        You have already confirmed your specialization.
                    </p>

                    <br>

                    <h3 style="color:#2f2fa2;">

                        Enrollment Reminder

                    </h3>

                    <p>

                        Please proceed to the
                        <strong>HEIMS Enrollment System</strong>
                        to complete your enrollment.

                    </p>

                </div>

            `;

      if (recommendationBox) {
        recommendationBox.innerHTML = `

                    <div class="selection">

                        <h2>
                            Your Selected Specialization
                        </h2>

                        <h1 style="color:#2f2fa2;">

                            ${escapeHTML(userData.selectedSpecialization)}

                        </h1>

                    </div>

                `;
      }

      return;
    }

    /* =================================================
           ACTIVE ACADEMIC YEAR
        ================================================= */

    const activeAcademicYear = await getActiveAcademicYear();

    if (!activeAcademicYear) {
      selectionContainer.innerHTML = `

                <div class="selection">

                    <p>
                        No active academic year is available yet.
                    </p>

                </div>

            `;

      return;
    }

    /* =================================================
           GET ADMIN-APPROVED EXAMS
        ================================================= */

    const approvedSpecializations =
      await getAdminApprovedSpecializations(activeAcademicYear);

    if (approvedSpecializations.length === 0) {
      selectionContainer.innerHTML = `

                <div class="selection">

                    <h2>
                        Specialization Selection Unavailable
                    </h2>

                    <p>
                        No specialization exams have been approved by the Admin yet.
                    </p>

                </div>

            `;

      if (recommendationBox) {
        recommendationBox.innerHTML = "";
      }

      return;
    }

    /* =================================================
           GET STUDENT RESULTS
        ================================================= */

    const studentResults = await getStudentResults(user, activeAcademicYear);

    /* =================================================
           CHECK COMPLETED EXAMS
        ================================================= */

    const completedSpecializations = new Set();

    studentResults.forEach((result) => {
      if (result.status === "Completed" && result.specialization) {
        const specialization = String(result.specialization).trim();

        if (approvedSpecializations.includes(specialization)) {
          completedSpecializations.add(specialization);
        }
      }
    });

    /* =================================================
           CHECK REMAINING EXAMS
        ================================================= */

    const incompleteSpecializations = approvedSpecializations.filter(
      (specialization) => !completedSpecializations.has(specialization),
    );

    /*
     * DO NOT ALLOW SELECTION YET.
     */

    if (incompleteSpecializations.length > 0) {
      let listHTML = "";

      incompleteSpecializations.forEach((specialization) => {
        listHTML += `

                        <li>
                            ${escapeHTML(specialization)}
                        </li>

                    `;
      });

      selectionContainer.innerHTML = `

                <div class="selection">

                    <h2>
                        Complete the Exam First
                    </h2>

                    <p>

                        Please go to
                        <strong>Take Exam</strong>
                        and finish the Interest Assessment and the
                        Comprehensive IT Examination before choosing
                        your specialization.

                    </p>

                </div>

            `;

      if (recommendationBox) {
        recommendationBox.innerHTML = `

                    <div class="selection">

                        <h2>
                            Recommendation Not Available Yet
                        </h2>

                        <p>

                            Your recommendation will appear
                            after you complete the
                            Comprehensive IT Examination.

                        </p>

                    </div>

                `;
      }

      return;
    }

    /* =================================================
           CALCULATE RECOMMENDATION
        ================================================= */

    const recommended = calculateRecommendation(
      approvedSpecializations,
      studentResults,
    );

    if (!recommended) {
      selectionContainer.innerHTML = `

        const interest =
            getInterestProfile(
                studentResults
            );


        const evaluation =
            evaluateRecommendation(
                stats,
                interest,
                tagMap
            );


      return;
    }

    /* =================================================
           DISPLAY RECOMMENDATION
        ================================================= */

    if (recommendationBox) {
      recommendationBox.innerHTML = `;

      recommendationBox.innerHTML = `

                    <div class="selection">

                        <h2>
                            ${
                              evaluation.confidence === "Low"
                                ? "Best Relative Fit"
                                : "Recommended Specialization"
                            }
                        </h2>

                        ${escapeHTML(recommended)}

                            ${escapeHTML(recommended)}

                        </h1>

                        <p>

                            Confidence:
                            <strong>
                                ${escapeHTML(evaluation.confidence)}
                            </strong>
                            .
                            This recommendation is based on
                            your completed exam
                            ${interest ? "and your interest assessment" : ""}.
                            See the
                            <strong>Specialization Recommendation</strong>
                            page for the full explanation.

                        </p>

            `;
    }

    /* =================================================
           LOAD SPECIALIZATIONS
        ================================================= */

    const specSnap = await getDocs(collection(db, "specializations"));

    let html = `

            <h2>
                Choose Your Preferred Specialization
            </h2>

            <p>

                Your recommended specialization is:
                <strong style="color:#2f2fa2;">

                    ${escapeHTML(recommended)}

                </strong>

            </p>

            <br>

        `;

    specSnap.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      const spec = data.name;

      if (!spec) {
        return;
      }

      const isRecommended = String(spec).trim() === String(recommended).trim();

      html += `

                <button

                    class="submit-btn"

                    style="
                        margin:10px;
                        ${
                          isRecommended
                            ? "border:3px solid #ff4fa3; box-shadow:0 0 10px rgba(255,79,163,0.35);"
                            : ""
                        }
                    "

                    onclick="selectSpec('${escapeHTML(spec)}')"

                >

                    ${escapeHTML(spec)}

                    ${isRecommended ? " ⭐ Recommended" : ""}

                </button>

            `;
    });

    selectionContainer.innerHTML = html;
  } catch (error) {
    console.error("Selection page error:", error);

    selectionContainer.innerHTML = `

            <div class="selection">

                <p>
                    Unable to load specialization selection.
                </p>

            </div>

        `;
  }
}

/* =========================================================
   SAVE SPECIALIZATION
========================================================= */

window.selectSpec = async function (spec) {
  const confirmChoice = confirm(
    `Are you sure you want to choose ${spec}?

You cannot change it after confirming.`,
  );

  if (!confirmChoice) {
    return;
  }

  try {
    await updateDoc(
      doc(db, "users", auth.currentUser.uid),

      {
        selectedSpecialization: spec,
      },
    );

    alert("Specialization successfully selected.");

    location.reload();
  } catch (error) {
    console.error("Selection error:", error);

    alert("Unable to save your specialization.");
  }
};

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.toggleSidebar = toggleSidebar;

window.goPage = goPage;

window.logout = logout;

window.closeLogoutModal = closeLogoutModal;

window.closeLogoutOutside = closeLogoutOutside;

window.performLogout = performLogout;
