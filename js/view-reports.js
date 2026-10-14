import { db, auth } from "./firebase-config.js";
<<<<<<< HEAD
=======

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

<<<<<<< HEAD
import {
    buildSpecializationStats,
    loadSpecializationTags,
    getInterestProfile,
    evaluateRecommendation
} from "./recommendation.js";

// =========================================================
// GLOBAL VARIABLES
// =========================================================

=======
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
let allUsers = [];
let allResults = [];
let usersLoaded = false;
<<<<<<< HEAD
let resultsLoaded = false;
let specializationTags = null;
=======

/* Used so the recommendation matches the student's own page. */
let activeAcademicYear = "";

/* Specializations the Admin has administered (null = unknown). */
let approvedSpecializations = null;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, (user) => {
<<<<<<< HEAD
    if (!user) {
        window.location.replace("../login.html");
    }
=======
  if (!user) {
    window.location.replace("../login.html");
  }
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
});

// =========================================================
// HELPERS
// =========================================================

<<<<<<< HEAD
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}

function parseDate(value) {
    if (!value) return 0;

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
=======
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

// =========================================================
// LOAD FILTERS
// =========================================================

async function loadFilters() {
<<<<<<< HEAD
    const sectionFilter = document.getElementById("sectionFilter");
    if (!sectionFilter) return;

    try {
        const snapshot = await getDocs(collection(db, "sections"));
        const sections = new Set();

        snapshot.forEach((docSnap) => {
            const name = docSnap.data().name;
            if (name) sections.add(String(name).trim());
        });

        const previousValue = sectionFilter.value || "All";

        sectionFilter.innerHTML =
            `<option value="All">All Sections</option>`;

        [...sections]
            .sort((a, b) => a.localeCompare(b, undefined, {
                sensitivity: "base"
            }))
            .forEach((section) => {
                const option = document.createElement("option");
                option.value = section;
                option.textContent = section;
                sectionFilter.appendChild(option);
            });

        if ([...sectionFilter.options].some(
            option => option.value === previousValue
        )) {
            sectionFilter.value = previousValue;
        }
    } catch (error) {
        console.error("Section Filter Error:", error);
    }
}

async function loadAcademicYears() {
    const dropdown = document.getElementById("academicYearFilter");
    if (!dropdown) return;

    try {
        const snapshot = await getDocs(collection(db, "academicYears"));
        const years = new Set();
        let activeYear = "";

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const year = String(data.year || data.name || "").trim();

            if (year) years.add(year);
            if (data.active === true && year && !activeYear) {
                activeYear = year;
            }
        });

        const previousValue = dropdown.value;

        dropdown.innerHTML =
            `<option value="All">All Academic Years</option>`;

        [...years]
            .sort((a, b) => b.localeCompare(a))
            .forEach((year) => {
                const option = document.createElement("option");
                option.value = year;
                option.textContent = year;
                dropdown.appendChild(option);
            });

        if ([...dropdown.options].some(
            option => option.value === previousValue
        ) && previousValue) {
            dropdown.value = previousValue;
        } else if ([...dropdown.options].some(
            option => option.value === activeYear
        )) {
            dropdown.value = activeYear;
        } else {
            dropdown.value = "All";
        }
    } catch (error) {
        console.error("Academic Year Error:", error);
    }
}

=======
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
// LOAD ACTIVE YEAR + ADMIN-APPROVED SPECIALIZATIONS
// (same rules the student's recommendation page uses)
// =========================================================

async function loadRecommendationContext() {
  activeAcademicYear = "";

  approvedSpecializations = null;

  try {
    const yearSnapshot = await getDocs(
      query(
        collection(db, "academicYears"),

        where("active", "==", true),
      ),
    );

    if (yearSnapshot.empty) {
      return;
    }

    activeAcademicYear = yearSnapshot.docs[0].data().year || "";

    if (!activeAcademicYear) {
      return;
    }

    const questionSnapshot = await getDocs(
      query(
        collection(db, "questionBank"),

        where("academicYear", "==", activeAcademicYear),
      ),
    );

    const approved = new Set();

    questionSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (data.status === "administered" && data.specialization) {
        approved.add(String(data.specialization).trim());
      }
    });

    approvedSpecializations = approved;
  } catch (error) {
    /* If this cannot be loaded, the report still works
           without the "approved only" filter. */

    console.error("Recommendation context error:", error);

    approvedSpecializations = null;
  }
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
// =========================================================
// LOAD STUDENTS
// =========================================================

async function loadUsers() {
<<<<<<< HEAD
    if (usersLoaded) return;

    const snapshot = await getDocs(
        query(
            collection(db, "users"),
            where("role", "==", "Student")
        )
    );

    allUsers = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
            uid: docSnap.id,
            ...data,
            studentNumber: data.studentNumber || "N/A"
        };
    });

    usersLoaded = true;
=======
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
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

// =========================================================
// LOAD ALL RESULTS
// =========================================================

<<<<<<< HEAD
async function loadAllResults() {
    if (resultsLoaded) return;

    const snapshot = await getDocs(collection(db, "results"));

    allResults = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
    }));

    resultsLoaded = true;
}

// =========================================================
// LOAD SHARED RECOMMENDATION RULES
// =========================================================

async function loadRecommendationEngine() {
    try {
        specializationTags = await loadSpecializationTags();
    } catch (error) {
        console.error("Unable to load specialization tags:", error);
        specializationTags = null;
    }
}

// =========================================================
// FIND A STUDENT'S RESULTS
// =========================================================

function getStudentResults(student, selectedYear) {
    return allResults.filter((result) => {
        if (result.status !== "Completed") return false;

        if (
            selectedYear !== "All" &&
            String(result.academicYear || "") !== selectedYear
        ) {
            return false;
        }

        // Prefer the exact Firebase user document ID.
        if (result.studentUid) {
            return result.studentUid === student.uid;
        }

        // Fallback only for older results without studentUid.
        if (result.studentEmail && student.email) {
            return normalize(result.studentEmail) === normalize(student.email);
        }

        if (result.studentName) {
            return normalize(result.studentName) ===
                normalize(student.fullname || student.name);
        }

        return false;
    });
}

// =========================================================
// CALCULATE RECOMMENDATION USING THE SAME ENGINE AS STUDENTS
// =========================================================

function calculateRecommendation(studentResults) {
    if (!studentResults.length || !specializationTags) {
        return "N/A";
    }

    try {
        const stats = buildSpecializationStats(studentResults);
        const interest = getInterestProfile(studentResults);

        const evaluation = evaluateRecommendation(
            stats,
            interest,
            specializationTags
        );

        if (
            evaluation?.status === "recommended" &&
            evaluation.primary?.specialization
        ) {
            return String(
                evaluation.primary.specialization
            ).trim();
        }

        return "N/A";
    } catch (error) {
        console.error("Recommendation Calculation Error:", error);
        return "N/A";
    }
=======
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
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

// =========================================================
// LOAD REPORT
// =========================================================

async function loadResults() {
<<<<<<< HEAD
    const tableHead = document.getElementById("reportHead");
    const tableBody = document.getElementById("resultsTable");

    if (!tableHead || !tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6">Loading reports...</td>
        </tr>
    `;

    try {
        await Promise.all([
            loadUsers(),
            loadAllResults(),
            loadRecommendationEngine()
        ]);

        const selectedYear =
            document.getElementById("academicYearFilter")?.value || "All";

        const selectedSection =
            document.getElementById("sectionFilter")?.value || "All";

        const search = normalize(
            document.getElementById("searchInput")?.value || ""
        );

        tableHead.innerHTML = `
            <tr>
                <th>Student Number</th>
                <th>Student</th>
                <th>Section</th>
                <th>System Recommendation</th>
                <th>Student Choice</th>
                <th>Status</th>
            </tr>
        `;

        const rows = [];

        for (const student of allUsers) {
            const studentName =
                student.fullname || student.name || "Unknown Student";

            const studentNumber = student.studentNumber || "N/A";
            const section = student.section || "N/A";

            if (selectedSection !== "All" && section !== selectedSection) {
                continue;
            }

            if (
                search &&
                !normalize(studentName).includes(search) &&
                !normalize(studentNumber).includes(search)
            ) {
                continue;
            }

            const studentResults = getStudentResults(
                student,
                selectedYear
            );

            // Calculate the recommendation even if the result document
            // has no saved "specialization" field.
            const recommended = calculateRecommendation(studentResults);

            // The selected choice is stored on the users document.
            const selected = String(
                student.selectedSpecialization || ""
            ).trim();

            let status = "Pending";

            if (recommended !== "N/A") {
                if (!selected) {
                    status = "Not Selected";
                } else {
                    status = normalize(selected) === normalize(recommended)
                        ? "Match"
                        : "Different";
                }
            }

            rows.push({
                studentNumber,
                studentName,
                section,
                recommended,
                selected: selected || "Not Selected",
                status
            });
        }

        rows.sort((a, b) =>
            a.studentName.localeCompare(b.studentName, undefined, {
                sensitivity: "base"
            })
        );

        if (!rows.length) {
            tableBody.innerHTML = `
                <tr class="no-data">
                    <td colspan="6">No student reports found.</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = rows.map((row) => `
            <tr class="result-row">
                <td>${escapeHtml(row.studentNumber)}</td>
                <td class="student-name">${escapeHtml(row.studentName)}</td>
                <td class="student-section">${escapeHtml(row.section)}</td>
                <td><b>${escapeHtml(row.recommended)}</b></td>
                <td>${escapeHtml(row.selected)}</td>
                <td>${escapeHtml(row.status)}</td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("Report Error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6">
                    Unable to load reports. Check the browser console.
                </td>
            </tr>
        `;
    }
}

// =========================================================
// SIDEBAR AND NAVIGATION
// =========================================================

function toggleSidebar() {
    document.getElementById("sidebar")?.classList.toggle("active");
}

function goPage(url) {
    window.location.href = url;
=======
  try {
    await Promise.all([
      loadUsers(),

      loadResultsFromFirestore(),

      loadRecommendationContext(),
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
    // GROUP STUDENTS
    // =====================================================

    let grouped = {};

    loadedResults.forEach((result) => {
      const resultName = result.studentName || result.currentStudentName || "";

      // Find the student by account ID first,
      // then fall back to the saved name.

      const student =
        allUsers.find(
          (user) => result.studentUid && user.uid === result.studentUid,
        ) ||
        allUsers.find(
          (user) =>
            resultName &&
            (user.fullname === resultName || user.name === resultName),
        );

      if (!student) {
        return;
      }

      const key = student.uid;

      if (!grouped[key]) {
        grouped[key] = {
          name:
            student.fullname || student.name || resultName || "Unknown Student",

          studentNumber: student.studentNumber || "N/A",

          section: student.section || "N/A",

          // Total percentage per specialization.
          totals: {},

          selected: student.selectedSpecialization || "Not Selected",
        };
      }

      // =================================================
      // EXAM SCORE
      //
      // Same rule as the student's recommendation page:
      //  - completed results only
      //  - score converted to a percentage
      //  - percentages added up per specialization
      //  - Admin-administered specializations only
      //    (for the active academic year)
      // =================================================

      if (result.status !== "Completed" || !result.specialization) {
        return;
      }

      const specialization = String(result.specialization).trim();

      if (
        approvedSpecializations &&
        result.academicYear === activeAcademicYear &&
        !approvedSpecializations.has(specialization)
      ) {
        return;
      }

      const score = Number(result.score || 0);

      const totalItems = Number(result.totalItems || 0);

      let percentage = score;

      if (totalItems > 0) {
        percentage = (score / totalItems) * 100;
      }

      grouped[key].totals[specialization] =
        (grouped[key].totals[specialization] || 0) + percentage;
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

                <th>
                    System Recommendation
                </th>

                <th>
                    Student Choice
                </th>

                <th>
                    Status
                </th>

            </tr>

        `;

    tableBody.innerHTML = "";

    let students = Object.keys(grouped);

    students.sort((a, b) =>
      grouped[a].name.localeCompare(grouped[b].name, undefined, {
        sensitivity: "base",
      }),
    );

    // =====================================================
    // DISPLAY REPORT
    // =====================================================

    students.forEach((key) => {
      const data = grouped[key];

      const studentName = data.name;

      // SECTION FILTER

      if (selectedSection !== "All" && data.section !== selectedSection) {
        return;
      }

      // SEARCH FILTER

      if (search && !studentName.toLowerCase().includes(search)) {
        return;
      }

      // =================================================
      // CALCULATE RECOMMENDATION
      // =================================================

      let highest = -1;

      let recommended = "N/A";

      for (const specialization in data.totals) {
        const total = data.totals[specialization] || 0;

        if (total > highest) {
          highest = total;

          recommended = specialization;
        }
      }

      // =================================================
      // STATUS
      // =================================================

      let status = "Pending";

      if (data.selected !== "Not Selected") {
        if (
          recommended !== "N/A" &&
          String(data.selected).trim().toLowerCase() ===
            String(recommended).trim().toLowerCase()
        ) {
          status = "Match";
        } else {
          status = "Different";
        }
      }

      // =================================================
      // TABLE ROW
      // =================================================

      tableBody.innerHTML += `

                <tr class="result-row">


                    <td>

                        ${escapeHtml(data.studentNumber)}

                    </td>


                    <td class="student-name">

                        ${escapeHtml(studentName)}

                    </td>


                    <td class="student-section">

                        ${escapeHtml(data.section)}

                    </td>


                    <td>

                        <b>

                            ${escapeHtml(recommended)}

                        </b>

                    </td>


                    <td>

                        ${escapeHtml(data.selected)}

                    </td>


                    <td>

                        ${escapeHtml(status)}

                    </td>


                </tr>

            `;
    });

    // =====================================================
    // NO DATA
    // =====================================================

    if (tableBody.innerHTML.trim() === "") {
      tableBody.innerHTML = `

                <tr class="no-data">

                    <td colspan="6">

                        No student reports found

                    </td>

                </tr>

            `;
    }
  } catch (error) {
    console.error("Report Error:", error);
  }
}

// =========================================================
// HTML ESCAPE
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
// SIDEBAR
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
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
<<<<<<< HEAD
    try {
        await Promise.all([
            loadAcademicYears(),
            loadFilters()
        ]);

        await Promise.all([
            loadUsers(),
            loadAllResults(),
            loadRecommendationEngine()
        ]);

        await loadResults();

        document.getElementById("academicYearFilter")
            ?.addEventListener("change", loadResults);

        document.getElementById("sectionFilter")
            ?.addEventListener("change", loadResults);

        document.getElementById("searchInput")
            ?.addEventListener("input", loadResults);

    } catch (error) {
        console.error("Report Initialization Error:", error);
    }
=======
  await Promise.all([loadAcademicYears(), loadFilters()]);

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
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
});

// =========================================================
// GLOBAL EXPORTS
// =========================================================

window.loadResults = loadResults;
<<<<<<< HEAD
window.toggleSidebar = toggleSidebar;
=======

window.toggleSidebar = toggleSidebar;

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
window.goPage = goPage;
