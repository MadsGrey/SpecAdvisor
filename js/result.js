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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   PAGE SHOW
========================================================= */

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

/* =========================================================
   SIDEBAR
========================================================= */

window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
};

/* =========================================================
   NAVIGATION
========================================================= */

window.goPage = function (url) {
  document.body.style.opacity = "0";

  setTimeout(() => {
    window.location.href = url;
  }, 300);
};

/* =========================================================
   LOGOUT MODAL
========================================================= */

window.logout = function () {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    console.error("Logout overlay not found.");

    return;
  }

  overlay.classList.add("active");
};

window.closeLogoutModal = function () {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.remove("active");
  }
};

window.closeLogoutOutside = function (event) {
  if (event.target && event.target.id === "logout-overlay") {
    window.closeLogoutModal();
  }
};

window.performLogout = async function () {
  try {
    await signOut(auth);

    localStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);

    alert("Unable to log out.");
  }
};

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
   NORMALIZE TEXT (for matching exams to results)
========================================================= */

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/* =========================================================
   GET ACTIVE ACADEMIC YEAR
========================================================= */

async function getActiveAcademicYear() {
  const activeYearQuery = query(
    collection(db, "academicYears"),
    where("active", "==", true),
  );

  const snapshot = await getDocs(activeYearQuery);

  if (snapshot.empty) {
    return "";
  }

  return snapshot.docs[0].data().year || "";
}

/* =========================================================
   RENDER RESULTS
========================================================= */

function renderResults(table, resultDocs) {
  if (!table) {
    return;
  }

  if (resultDocs.length === 0) {
    table.innerHTML = `

            <tr class="no-result">

                <td colspan="5">

                    No exam result yet.

                </td>

            </tr>

        `;

    return;
  }

  const rows = [];

  resultDocs.forEach((docSnap) => {
    const data = docSnap.data();

    const total = Number(data.totalItems) || 0;

    const score = Number(data.score) || 0;

    let percentage = 0;

    if (total > 0) {
      percentage = (score / total) * 100;
    }

    let remarks = "Failed";

    if (percentage >= 90) {
      remarks = "Excellent";
    } else if (percentage >= 75) {
      remarks = "Passed";
    } else if (percentage >= 50) {
      remarks = "Needs Improvement";
    }

    rows.push(`

            <tr>

                <td>
                    ${escapeHTML(data.specialization || "N/A")}
                </td>

                <td>
                    ${total}
                </td>

                <td>
                    ${score}
                </td>

                <td>
                    ${percentage.toFixed(2)}%
                </td>

                <td>
                    ${remarks}
                </td>

            </tr>

        `);
  });

  table.innerHTML = rows.join("");
}

/* =========================================================
   RENDER EXAM REMINDER
========================================================= */

/*
 * IMPORTANT: take-exam.js combines EVERY administered exam of a
 * specialization into ONE exam, and saves the result under the
 * combined title ("Exam A + Exam B", titles sorted A-Z).
 *
 * So a student takes ONE exam per specialization, and this
 * reminder checks completion per specialization as well.
 */

function renderReminder(
  reminderBox,
  activeAcademicYear,
  questionDocs,
  resultDocs,
) {
  if (!reminderBox) {
    return;
  }

  /* =====================================================
       NO ACTIVE ACADEMIC YEAR
    ===================================================== */

  if (!activeAcademicYear) {
    reminderBox.innerHTML = `

            <div class="exam-reminder warning">

                <h3>
                    ⚠ Exam Not Available
                </h3>

                <p>
                    No active Academic Year has
                    been set by the Administrator.
                </p>

            </div>

        `;

    return;
  }

  /* =====================================================
       GROUP ADMINISTERED EXAMS BY SPECIALIZATION

       questionDocs already contains ONLY questions with
       status = "administered".
    ===================================================== */

  const groups = {};

  questionDocs.forEach((docSnap) => {
    const data = docSnap.data();

    const specialization = String(data.specialization || "").trim();

    const examTitle = String(data.examTitle || data.title || "").trim();

    const questionText = String(data.question || "").trim();

    if (!specialization || !questionText || data.status !== "administered") {
      return;
    }

    const key = normalize(specialization);

    if (!groups[key]) {
      groups[key] = {
        specialization: specialization,

        titles: new Set(),
      };
    }

    if (examTitle) {
      groups[key].titles.add(examTitle);
    }
  });

  /* Same title that take-exam.js builds and saves. */

  const specializationList = Object.values(groups)
    .map((group) => {
      const titles = Array.from(group.titles).sort((a, b) =>
        a.localeCompare(b),
      );

      return {
        specialization: group.specialization,

        titles: titles,

        combinedTitle:
          titles.length > 0
            ? titles.join(" + ")
            : `${group.specialization} Examination`,
      };
    })
    .sort((a, b) => a.specialization.localeCompare(b.specialization));

  /* =====================================================
       NO EXAMS ADMINISTERED YET

       Prevents the "go to recommendation" message from
       showing before the Admin has administered any exam.
    ===================================================== */

  if (specializationList.length === 0) {
    reminderBox.innerHTML = `

            <div class="exam-reminder warning">

                <div class="reminder-icon">
                    ⚠️
                </div>

                <div class="reminder-content">

                    <h3>
                        No exams available yet
                    </h3>

                    <p>
                        The Administrator has not
                        administered any exams yet.
                        Please check back later.
                    </p>

                </div>

            </div>

        `;

    return;
  }

  /* =====================================================
       COMPLETED RESULTS (active academic year only)
    ===================================================== */

  const completedResults = resultDocs
    .map((docSnap) => docSnap.data())
    .filter((result) => {
      const sameYear =
        !result.academicYear || result.academicYear === activeAcademicYear;

      const completed = !result.status || result.status === "Completed";

      return sameYear && completed;
    });

  function hasCompleted(item) {
    const expectedTitle = normalize(item.combinedTitle);

    const expectedParts = item.titles.map(normalize);

    return completedResults.some((result) => {
      if (normalize(result.specialization) !== normalize(item.specialization)) {
        return false;
      }

      /* Exact match with the combined title. */

      if (normalize(result.examTitle) === expectedTitle) {
        return true;
      }

      /* Saved titles cover every currently administered exam. */

      if (expectedParts.length === 0) {
        return false;
      }

      const savedParts =
        Array.isArray(result.examTitles) && result.examTitles.length > 0
          ? result.examTitles.map(normalize)
          : String(result.examTitle || "")
              .split(" + ")
              .map(normalize);

      return expectedParts.every((part) => savedParts.includes(part));
    });
  }

  const remaining = specializationList.filter((item) => !hasCompleted(item));

  /* Debug: shows what the page expects vs what was saved (F12). */

  console.log(
    "Expected exams:",
    specializationList.map(
      (item) => `${item.specialization} | ${item.combinedTitle}`,
    ),
  );

  console.log(
    "Saved results:",
    completedResults.map(
      (result) => `${result.specialization} | ${result.examTitle}`,
    ),
  );

  /* =====================================================
       STILL HAS EXAMS
    ===================================================== */

  if (remaining.length > 0) {
    const remainingList = remaining
      .map(
        (item) => `

                    <li>

                        <strong>
                            ${escapeHTML(item.specialization)}
                        </strong>

                        -
                        ${escapeHTML(item.combinedTitle)}

                    </li>

                `,
      )
      .join("");

    reminderBox.innerHTML = `

            <div class="exam-reminder warning">

                <div class="reminder-icon">
                    ⚠️
                </div>

                <div class="reminder-content">

                    <h3>
                        You still have
                        specialization exams to complete.
                    </h3>

                    <p>

                        Please go back to
                        <strong>Take Exam</strong>
                        and complete all your remaining
                        exams before viewing your
                        recommended specialization.

                    </p>

                    <ul>

                        ${remainingList}

                    </ul>

                    <button
                        class="reminder-btn"
                        onclick="goPage('../student/take-exam.html')"
                    >

                        Go to Take Exam

                    </button>

                </div>

            </div>

        `;

    return;
  }

  /* =====================================================
       ALL EXAMS COMPLETED
    ===================================================== */

  reminderBox.innerHTML = `

        <div class="exam-reminder success">

            <div class="reminder-icon">
                🎉
            </div>

            <div class="reminder-content">

                <h3>
                    You're done with all your exams!
                </h3>

                <p>

                    Now go to
                    <strong>
                        Specialization Recommendation
                    </strong>
                    to see your recommended specialization.

                </p>

                <button
                    class="reminder-btn"
                    onclick="goPage('../student/recommendation.html')"
                >

                    Go to Recommendation

                </button>

            </div>

        </div>

    `;
}

/* =========================================================
   LOAD RESULT PAGE
========================================================= */

async function loadPage(userUid) {
  const table = document.getElementById("resultBody");

  const reminderBox = document.getElementById("examReminder");

  try {
    /* =================================================
           GET ACTIVE ACADEMIC YEAR
        ================================================= */

    const activeAcademicYear = await getActiveAcademicYear();

    /* =================================================
           GET STUDENT RESULTS ONCE
        ================================================= */

    const studentResultsQuery = query(
      collection(db, "results"),
      where("studentUid", "==", userUid),
    );

    const studentResultsPromise = getDocs(studentResultsQuery);

    /* =================================================
           LOAD ONLY ADMIN-APPROVED EXAMS

           status == "administered"

           Faculty-created but unapproved exams
           will NOT be included.
        ================================================= */

    let questionDocs = [];

    if (activeAcademicYear) {
      const questionQuery = query(
        collection(db, "questionBank"),

        where("academicYear", "==", activeAcademicYear),

        where("status", "==", "administered"),
      );

      const [resultSnapshot, questionSnapshot] = await Promise.all([
        studentResultsPromise,

        getDocs(questionQuery),
      ]);

      const resultDocs = resultSnapshot.docs;

      questionDocs = questionSnapshot.docs;

      /* =============================================
               RENDER STUDENT RESULTS
            ============================================= */

      renderResults(table, resultDocs);

      /* =============================================
               RENDER REMINDER

               The academic year check happens inside
               renderReminder.
            ============================================= */

      renderReminder(reminderBox, activeAcademicYear, questionDocs, resultDocs);

      return;
    }

    /* =================================================
           NO ACTIVE ACADEMIC YEAR

           Still load student's existing results.
        ================================================= */

    const resultSnapshot = await studentResultsPromise;

    const resultDocs = resultSnapshot.docs;

    renderResults(table, resultDocs);

    renderReminder(reminderBox, "", [], []);
  } catch (error) {
    console.error("Error loading result page:", error);

    /* =================================================
           RESULT ERROR
        ================================================= */

    if (table) {
      table.innerHTML = `

                <tr class="no-result">

                    <td colspan="5">

                        Unable to load exam results.

                    </td>

                </tr>

            `;
    }

    /* =================================================
           REMINDER ERROR
        ================================================= */

    if (reminderBox) {
      reminderBox.innerHTML = `

                <div class="exam-reminder warning">

                    <h3>
                        ⚠ Unable to check exam completion
                    </h3>

                    <p>
                        Please try again later.
                    </p>

                </div>

            `;
    }
  }
}

/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../Login.html");

    return;
  }

  loadPage(user.uid);
});
