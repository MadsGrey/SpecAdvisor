
import { db, auth } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// STATE
// =========================================================

let allUsers = [];
let loadedResults = [];
let availableSections = [];
let availableYears = [];

let resultsUnsubscribe = null;
let initialized = false;

const $ = (id) => document.getElementById(id);

// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("../login.html");
        return;
    }

    if (initialized) return;
    initialized = true;

    await initializePage();
});

// =========================================================
// PAGE INITIALIZATION
// =========================================================

async function initializePage() {
    showMessage("Loading exam results...", 8);

    await Promise.all([
        loadUsers(),
        loadFilters()
    ]);

    renderFilterOptions();
    listenForResults();
    attachFilterEvents();
}

// =========================================================
// LOAD STUDENTS
// =========================================================

async function loadUsers() {
    try {
        const snapshot = await getDocs(
            collection(db, "users")
        );

        allUsers = snapshot.docs
            .map((docSnap) => ({
                uid: docSnap.id,
                ...docSnap.data()
            }))
            .filter((user) =>
                String(user.role || "").toLowerCase() === "student"
            );

    } catch (error) {
        console.error("Unable to load students:", error);
    }
}

// =========================================================
// LOAD ACADEMIC YEARS AND SECTIONS
// =========================================================

async function loadFilters() {
    try {
        const [yearsSnapshot, sectionsSnapshot] =
            await Promise.all([
                getDocs(collection(db, "academicYears")),
                getDocs(collection(db, "sections"))
            ]);

        availableYears = yearsSnapshot.docs
            .map((docSnap) => {
                const data = docSnap.data();
                return data.year || data.academicYear || "";
            })
            .filter(Boolean);

        availableYears = [...new Set(availableYears)];

        availableSections = sectionsSnapshot.docs
            .map((docSnap) => {
                const data = docSnap.data();
                return data.name || data.section || "";
            })
            .filter(Boolean);

        availableSections = [...new Set(availableSections)];

    } catch (error) {
        console.error("Unable to load filters:", error);
    }
}

// =========================================================
// RENDER FILTER OPTIONS
// =========================================================

function renderFilterOptions() {
    const yearFilter = $("academicYearFilter");
    const sectionFilter = $("sectionFilter");

    if (yearFilter) {
        const previousYear = yearFilter.value || "All";

        yearFilter.innerHTML = `
            <option value="All">All Academic Years</option>
        `;

        availableYears
            .sort((a, b) => String(b).localeCompare(String(a)))
            .forEach((year) => {
                const option = document.createElement("option");
                option.value = year;
                option.textContent = year;
                yearFilter.appendChild(option);
            });

        yearFilter.value =
            [...yearFilter.options].some(
                option => option.value === previousYear
            )
                ? previousYear
                : "All";
    }

    if (sectionFilter) {
        const previousSection = sectionFilter.value || "All";

        sectionFilter.innerHTML = `
            <option value="All">All Sections</option>
        `;

        availableSections
            .sort((a, b) =>
                String(a).localeCompare(String(b), undefined, {
                    sensitivity: "base"
                })
            )
            .forEach((section) => {
                const option = document.createElement("option");
                option.value = section;
                option.textContent = section;
                sectionFilter.appendChild(option);
            });

        sectionFilter.value =
            [...sectionFilter.options].some(
                option => option.value === previousSection
            )
                ? previousSection
                : "All";
    }
}

// =========================================================
// LISTEN FOR FIRESTORE RESULTS
// Automatically refreshes when a result is added or changed.
// =========================================================

function listenForResults() {
    if (resultsUnsubscribe) {
        resultsUnsubscribe();
    }

    resultsUnsubscribe = onSnapshot(
        collection(db, "results"),

        (snapshot) => {
            loadedResults = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data()
            }));

            // Include academic years present in results, too.
            const resultYears = loadedResults
                .map(result => result.academicYear)
                .filter(Boolean);

            availableYears = [
                ...new Set([...availableYears, ...resultYears])
            ];

            renderFilterOptions();
            renderResults();
        },

        (error) => {
            console.error("Error listening to exam results:", error);

            const head = $("reportHead");
            const body = $("resultsTable");

            if (head) head.innerHTML = "";

            if (body) {
                body.innerHTML = `
                    <tr>
                        <td colspan="8">
                            Unable to load exam results.
                            Check your Firestore permissions and internet connection.
                        </td>
                    </tr>
                `;
            }
        }
    );
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
        minute: "2-digit"
    });
}

// =========================================================
// MATCH A RESULT TO A STUDENT
// Prefer UID; fall back to email or name for older documents.
// =========================================================

function findStudent(result) {
    const uid = result.studentUid || result.uid;

    if (uid) {
        const byUid = allUsers.find(user => user.uid === uid);
        if (byUid) return byUid;
    }

    const email = String(result.studentEmail || "").toLowerCase();

    if (email) {
        const byEmail = allUsers.find(
            user => String(user.email || "").toLowerCase() === email
        );

        if (byEmail) return byEmail;
    }

    const name = String(
        result.studentName || result.currentStudentName || ""
    ).trim().toLowerCase();

    if (name) {
        return allUsers.find(user =>
            String(user.fullname || user.name || "")
                .trim()
                .toLowerCase() === name
        ) || null;
    }

    return null;
}

// =========================================================
// DISPLAY SPECIALIZATION BREAKDOWN
// Supports an array or object if one is saved in Firestore.
// =========================================================

function formatBreakdown(result) {
    const breakdown =
        result.specializationBreakdown ||
        result.breakdown ||
        null;

    if (!breakdown) {
        return "—";
    }

    if (Array.isArray(breakdown)) {
        if (breakdown.length === 0) return "—";

        return breakdown.map(item => {
            if (typeof item !== "object" || item === null) {
                return escapeHtml(item);
            }

            const name =
                item.specialization ||
                item.name ||
                item.subject ||
                "Specialization";

            const correct =
                item.correct ??
                item.score ??
                item.correctAnswers;

            const total =
                item.total ??
                item.totalItems ??
                item.questions;

            if (correct !== undefined && total !== undefined) {
                return `${escapeHtml(name)}: ${escapeHtml(correct)}/${escapeHtml(total)}`;
            }

            return `${escapeHtml(name)}: ${escapeHtml(item.score ?? "—")}`;
        }).join("<br>");
    }

    if (typeof breakdown === "object") {
        const entries = Object.entries(breakdown);

        if (entries.length === 0) return "—";

        return entries.map(([name, value]) => {
            if (typeof value === "object" && value !== null) {
                const correct = value.correct ?? value.score ?? "—";
                const total = value.total ?? value.totalItems;

                return total !== undefined
                    ? `${escapeHtml(name)}: ${escapeHtml(correct)}/${escapeHtml(total)}`
                    : `${escapeHtml(name)}: ${escapeHtml(correct)}`;
            }

            return `${escapeHtml(name)}: ${escapeHtml(value)}`;
        }).join("<br>");
    }

    return escapeHtml(breakdown);
}

// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================
// TABLE MESSAGE
// =========================================================

function showMessage(message, columns = 8) {
    const head = $("reportHead");
    const body = $("resultsTable");

    if (head) head.innerHTML = "";

    if (body) {
        body.innerHTML = `
            <tr class="no-data">
                <td colspan="${columns}">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
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
    const search = ($("searchInput")?.value || "")
        .trim()
        .toLowerCase();

    // Group exam attempts by student.
    const grouped = new Map();

    loadedResults.forEach((result) => {
        const student = findStudent(result);

const uid = result.studentUid || result.uid || student?.uid;

const rawName =
    result.currentStudentName ||
    student?.fullname ||
    student?.name ||
    "";

const studentName =
    rawName ||
    result.studentName ||
    result.studentEmail ||
    "Unknown student";

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
            section
        ].filter(Boolean).join(" ").toLowerCase();

        if (search && !searchableText.includes(search)) {
            return;
        }

        // UID is the preferred group key. Name/email are fallbacks.
        const key = uid || String(
            result.studentEmail || studentName
        ).toLowerCase();

        if (!grouped.has(key)) {
            grouped.set(key, {
                studentNumber:
                    student?.studentNumber ||
                    student?.studentId ||
                    result.studentNumber ||
                    "N/A",

                studentName,
                section,
                attempts: []
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
            sensitivity: "base"
        })
    );

    students.forEach((student) => {
        // Sort each student's attempts newest first.
        student.attempts.sort((a, b) =>
            getTimestamp(b) - getTimestamp(a)
        );

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
                            ${escapeHtml(formatDate(
                                result.submittedAt ||
                                result.date ||
                                result.completedAt
                            ))}
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
    const value =
        result.submittedAt ||
        result.date ||
        result.completedAt;

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
    $("sidebar")?.classList.toggle("active");
}

function goPage(url) {
    window.location.href = url;
}

// =========================================================
// CLEAN UP LIVE LISTENER WHEN LEAVING THE PAGE
// =========================================================

window.addEventListener("pagehide", () => {
    if (resultsUnsubscribe) {
        resultsUnsubscribe();
        resultsUnsubscribe = null;
    }
});

// =========================================================
// WINDOW EXPORTS FOR HTML onclick HANDLERS
// =========================================================

window.loadResults = renderResults;
window.toggleSidebar = toggleSidebar;
window.goPage = goPage;
