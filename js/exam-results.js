import { db, auth } from "./firebase-config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allUsers = [];
let loadedResults = [];
let availableSections = [];
let availableYears = [];

// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../Login.html");
  }
});

// =========================================================
// PAGE INITIALIZATION
// =========================================================

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

// =========================================================
// LOAD SECTIONS
// =========================================================

async function loadFilters() {
  try {
    const sectionsSnapshot = await getDocs(collection(db, "sections"));

    const sectionFilter = document.getElementById("sectionFilter");

    if (!sectionFilter) {
      return;
    }

    sectionFilter.innerHTML = `
            <option value="All">
                All Sections
            </option>
        `;

    let sections = [];

    sectionsSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.name) {
        sections.push(data.name);
      }
    });

    sections.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        sensitivity: "base",
      }),
    );

    sections.forEach((section) => {
      const option = document.createElement("option");

      option.value = section;

      option.textContent = section;

      sectionFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Section Filter Error:", error);
  }
}

// =========================================================
// LOAD ACADEMIC YEARS
// =========================================================

async function loadAcademicYears() {
  try {
    const snapshot = await getDocs(collection(db, "academicYears"));

    const dropdown = document.getElementById("academicYearFilter");

    if (!dropdown) {
      return;
    }

    dropdown.innerHTML = `
            <option value="All">
                All Academic Years
            </option>
        `;

    let years = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.year) {
        years.push(data.year);
      }
    });

    years.sort((a, b) => String(b).localeCompare(String(a)));

    years.forEach((year) => {
      const option = document.createElement("option");

      option.value = year;

      option.textContent = year;

      dropdown.appendChild(option);
    });
  } catch (error) {
    console.error("Academic Year Error:", error);
  }
}

// =========================================================
// LOAD STUDENTS
// =========================================================

async function loadUsers() {
  if (usersLoaded) {
    return;
  }

  try {
    const usersSnapshot = await getDocs(
      query(
        collection(db, "users"),

        where("role", "==", "Student"),
      ),
    );

    allUsers = [];

    usersSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      allUsers.push({
        uid: docSnap.id,

        ...data,

        studentNumber: data.studentNumber || "N/A",
      });
    });

    usersLoaded = true;
  } catch (error) {
    console.error("Users Error:", error);
  }
}

// =========================================================
// LOAD SPECIALIZATIONS
// =========================================================

async function loadSpecializations() {
  if (specializationsLoaded) {
    return;
  }

  try {
    const snapshot = await getDocs(collection(db, "specializations"));

    allSpecializations = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const name = data.name || data.specialization;

      if (name) {
        allSpecializations.push(name);
      }
    });

    allSpecializations = [...new Set(allSpecializations)];

    allSpecializations.sort((a, b) =>
      String(a).localeCompare(String(b), undefined, {
        sensitivity: "base",
      }),
    );

    specializationsLoaded = true;
  } catch (error) {
    console.error("Specializations Error:", error);
  }
}

// =========================================================
// LOAD RESULTS FROM FIRESTORE
// =========================================================

async function loadResultsFromFirestore() {
  try {
    const academicYearFilter = document.getElementById("academicYearFilter");

    const selectedYear = academicYearFilter ? academicYearFilter.value : "All";

    let snapshot;

    if (selectedYear === "All") {
      snapshot = await getDocs(collection(db, "results"));
    } else {
      snapshot = await getDocs(
        query(
          collection(db, "results"),

          where("academicYear", "==", selectedYear),
        ),
      );
    }

    loadedResults = [];

    snapshot.forEach((docSnap) => {
      loadedResults.push({
        id: docSnap.id,

        ...docSnap.data(),
      });
    });
  } catch (error) {
    console.error("Results Error:", error);
  }
}

// =========================================================
// LOAD ACADEMIC YEARS AND SECTIONS
// =========================================================

async function loadResults() {
  try {
    await Promise.all([
      loadUsers(),

      loadSpecializations(),

      loadResultsFromFirestore(),
    ]);

    const tableHead = document.getElementById("reportHead");

    const tableBody = document.getElementById("resultsTable");

    if (!tableHead || !tableBody) {
      return;
    }

    const sectionFilter = document.getElementById("sectionFilter");

    const searchInput = document.getElementById("searchInput");

    const selectedSection = sectionFilter ? sectionFilter.value : "All";

    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";

    // =====================================================
    // GROUP RESULTS BY STUDENT
    // =====================================================

    let grouped = {};

    loadedResults.forEach((result) => {
      const studentName = result.studentName || result.currentStudentName;

      if (!studentName) {
        return;
      }

      const student = allUsers.find((user) => {
        return user.fullname === studentName || user.name === studentName;
      });

      if (!student) {
        return;
      }

      if (!grouped[studentName]) {
        grouped[studentName] = {
          studentNumber: student.studentNumber || "N/A",

          section: student.section || "N/A",

          scores: {},
        };
      }

      grouped[studentName].scores[result.specialization] = result.score ?? 0;
    });

    // =====================================================
    // TABLE HEADER
    // =====================================================

    tableHead.innerHTML = `

            <tr>

                <th>
                    Student Number
                </th>

                <th>
                    Student
                </th>

                <th>
                    Section
                </th>

                ${allSpecializations
                  .map(
                    (spec) => `
                            <th>
                                ${escapeHtml(spec)}
                            </th>
                        `,
                  )
                  .join("")}

            </tr>

        `;

    // =====================================================
    // CLEAR TABLE
    // =====================================================

    tableBody.innerHTML = "";

    let students = Object.keys(grouped);

    // =====================================================
    // SORT STUDENTS
    // =====================================================

    students.sort((a, b) =>
      a.localeCompare(b, undefined, {
        sensitivity: "base",
      }),
    );

    // =====================================================
    // DISPLAY STUDENTS
    // =====================================================

    students.forEach((studentName) => {
      const data = grouped[studentName];

      // SECTION FILTER

      if (selectedSection !== "All" && data.section !== selectedSection) {
        return;
      }

      // SEARCH FILTER

      if (search && !studentName.toLowerCase().includes(search)) {
        return;
      }

      let row = `

                <tr class="result-row">

                    <td class="student-number">

                        ${escapeHtml(data.studentNumber)}

                    </td>


                    <td class="student-name">

                        ${escapeHtml(studentName)}

                    </td>


                    <td class="student-section">

                        ${escapeHtml(data.section)}

                    </td>

            `;

      allSpecializations.forEach((specialization) => {
        const score = data.scores[specialization];

        row += `

                        <td class="score-cell">

                            ${score === undefined ? "-" : escapeHtml(score)}

                        </td>

                    `;
      });

      row += `

                </tr>

            `;

      tableBody.innerHTML += row;
    });

    // =====================================================
    // NO DATA
    // =====================================================

    if (tableBody.innerHTML.trim() === "") {
      tableBody.innerHTML = `

                <tr class="no-data">

                    <td
                        colspan="${allSpecializations.length + 3}"
                    >

                        No student results found

                    </td>

                </tr>

            `;
    }
  } catch (error) {
    console.error("Exam Results Error:", error);
  }
}

// =========================================================
// DATE FORMATTING
// =========================================================

function formatDate(value) {
  if (!value) return "—";

  let date;

  if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value === "number") {
    date = new Date(value);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// =========================================================
// MATCH A RESULT TO A STUDENT
// Prefer UID; fall back to email or name for older documents.
// =========================================================

function findStudent(result) {
  const uid = result.studentUid || result.uid;

  if (uid) {
    const byUid = allUsers.find((user) => user.uid === uid);
    if (byUid) return byUid;
  }

  const email = String(result.studentEmail || "").toLowerCase();

  if (email) {
    const byEmail = allUsers.find(
      (user) => String(user.email || "").toLowerCase() === email,
    );

    if (byEmail) return byEmail;
  }

  const name = String(result.studentName || result.currentStudentName || "")
    .trim()
    .toLowerCase();

  if (name) {
    return (
      allUsers.find(
        (user) =>
          String(user.fullname || user.name || "")
            .trim()
            .toLowerCase() === name,
      ) || null
    );
  }

  return null;
}

// =========================================================
// DISPLAY SPECIALIZATION BREAKDOWN
// Supports an array or object if one is saved in Firestore.
// =========================================================

function formatBreakdown(result) {
  const breakdown = result.specializationBreakdown || result.breakdown || null;

  if (!breakdown) {
    return "—";
  }

  if (Array.isArray(breakdown)) {
    if (breakdown.length === 0) return "—";

    return breakdown
      .map((item) => {
        if (typeof item !== "object" || item === null) {
          return escapeHtml(item);
        }

        const name =
          item.specialization || item.name || item.subject || "Specialization";

        const correct = item.correct ?? item.score ?? item.correctAnswers;

        const total = item.total ?? item.totalItems ?? item.questions;

        if (correct !== undefined && total !== undefined) {
          return `${escapeHtml(name)}: ${escapeHtml(correct)}/${escapeHtml(total)}`;
        }

        return `${escapeHtml(name)}: ${escapeHtml(item.score ?? "—")}`;
      })
      .join("<br>");
  }

  if (typeof breakdown === "object") {
    const entries = Object.entries(breakdown);

    if (entries.length === 0) return "—";

    return entries
      .map(([name, value]) => {
        if (typeof value === "object" && value !== null) {
          const correct = value.correct ?? value.score ?? "—";
          const total = value.total ?? value.totalItems;

          return total !== undefined
            ? `${escapeHtml(name)}: ${escapeHtml(correct)}/${escapeHtml(total)}`
            : `${escapeHtml(name)}: ${escapeHtml(correct)}`;
        }

        return `${escapeHtml(name)}: ${escapeHtml(value)}`;
      })
      .join("<br>");
  }

  return escapeHtml(breakdown);
}

// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}

// =========================================================
// RENDER RESULTS
// =========================================================

function renderResults() {
  const tableHead = $("reportHead");
  const tableBody = $("resultsTable");

  if (!tableHead || !tableBody) return;

  const selectedYear = $("academicYearFilter")?.value || "All";
  const selectedSection = $("sectionFilter")?.value || "All";
  const search = ($("searchInput")?.value || "").trim().toLowerCase();

  // Group exam attempts by student.
  const grouped = new Map();

  loadedResults.forEach((result) => {
    const student = findStudent(result);

    const uid = result.studentUid || result.uid || student?.uid;

    const rawName =
      result.currentStudentName || student?.fullname || student?.name || "";

    const studentName =
      rawName || result.studentName || result.studentEmail || "Unknown student";

    const year = result.academicYear || "—";

    if (selectedYear !== "All" && year !== selectedYear) {
      return;
    }

    const section = student?.section || result.section || "N/A";

    if (selectedSection !== "All" && section !== selectedSection) {
      return;
    }

    const searchableText = [
      studentName,
      student?.studentNumber,
      result.studentEmail,
      section,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (search && !searchableText.includes(search)) {
      return;
    }

    // UID is the preferred group key. Name/email are fallbacks.
    const key = uid || String(result.studentEmail || studentName).toLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        studentNumber:
          student?.studentNumber ||
          student?.studentId ||
          result.studentNumber ||
          "N/A",

        studentName,
        section,
        attempts: [],
      });
    }

    grouped.get(key).attempts.push(result);
  });

  // Table header.
  tableHead.innerHTML = `
        <tr>
            <th>Student Number</th>
            <th>Student</th>
            <th>Section</th>
            <th>Academic Year</th>
            <th>Exam</th>
            <th>Score</th>
            <th>Specialization Breakdown</th>
            <th>Status</th>
        </tr>
    `;

  const rows = [];

  const students = [...grouped.values()].sort((a, b) =>
    a.studentName.localeCompare(b.studentName, undefined, {
      sensitivity: "base",
    }),
  );

  students.forEach((student) => {
    // Sort each student's attempts newest first.
    student.attempts.sort((a, b) => getTimestamp(b) - getTimestamp(a));

    student.attempts.forEach((result) => {
      const score = result.score ?? 0;
      const total = result.totalItems ?? "—";

      const status = result.status || "Unknown";
      const examTitle = result.examTitle || "Comprehensive IT Examination";
      const year = result.academicYear || "—";

      rows.push(`
                <tr class="result-row">
                    <td class="student-number">
                        ${escapeHtml(student.studentNumber)}
                    </td>

                    <td class="student-name">
                        ${escapeHtml(student.studentName)}
                    </td>

                    <td class="student-section">
                        ${escapeHtml(student.section)}
                    </td>

                    <td>
                        ${escapeHtml(year)}
                    </td>

                    <td>
                        ${escapeHtml(examTitle)}
                        <div class="result-date">
                            ${escapeHtml(
                              formatDate(
                                result.submittedAt ||
                                  result.date ||
                                  result.completedAt,
                              ),
                            )}
                        </div>
                    </td>

                    <td class="score-cell">
                        ${escapeHtml(score)} / ${escapeHtml(total)}
                    </td>

                    <td>
                        ${formatBreakdown(result)}
                    </td>

                    <td>
                        ${escapeHtml(status)}
                    </td>
                </tr>
            `);
    });
  });

  if (rows.length === 0) {
    tableBody.innerHTML = `
            <tr class="no-data">
                <td colspan="8">No student exam results found.</td>
            </tr>
        `;
    return;
  }

  tableBody.innerHTML = rows.join("");
}

// =========================================================
// RESULT TIMESTAMP FOR SORTING
// =========================================================

function getTimestamp(result) {
  const value = result.submittedAt || result.date || result.completedAt;

  if (!value) return 0;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value.toDate === "function") {
    return value.toDate().getTime();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

// =========================================================
// FILTER EVENTS
// =========================================================

function attachFilterEvents() {
  $("academicYearFilter")?.addEventListener("change", renderResults);
  $("sectionFilter")?.addEventListener("change", renderResults);
  $("searchInput")?.addEventListener("input", renderResults);
}

// =========================================================
// SIDEBAR AND NAVIGATION
// =========================================================

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

// =========================================================
// PAGE NAVIGATION
// =========================================================

function goPage(url) {
  window.location.href = url;
}

// =========================================================
// CLEAN UP LIVE LISTENER WHEN LEAVING THE PAGE
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadAcademicYears(),

    loadFilters(),

    loadSpecializations(),
  ]);

  await loadResults();

  const academicYearFilter = document.getElementById("academicYearFilter");

  const sectionFilter = document.getElementById("sectionFilter");

  const searchInput = document.getElementById("searchInput");

  if (academicYearFilter) {
    academicYearFilter.addEventListener("change", async () => {
      await loadResults();
    });
  }

  if (sectionFilter) {
    sectionFilter.addEventListener("change", async () => {
      await loadResults();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      await loadResults();
    });
  }
});

// =========================================================
// WINDOW EXPORTS FOR HTML onclick HANDLERS
// =========================================================

window.loadResults = loadResults;

window.toggleSidebar = toggleSidebar;

window.goPage = goPage;
