import { db, auth } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    buildSpecializationStats,
    loadSpecializationTags,
    getInterestProfile,
    evaluateRecommendation
} from "./recommendation.js";

// =========================================================
// GLOBAL VARIABLES
// =========================================================

let allUsers = [];
let allResults = [];
let usersLoaded = false;
let resultsLoaded = false;
let specializationTags = null;

// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("../login.html");
    }
});

// =========================================================
// HELPERS
// =========================================================

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

// =========================================================
// LOAD FILTERS
// =========================================================

async function loadFilters() {
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

// =========================================================
// LOAD STUDENTS
// =========================================================

async function loadUsers() {
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
}

// =========================================================
// LOAD ALL RESULTS
// =========================================================

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
}

// =========================================================
// LOAD REPORT
// =========================================================

async function loadResults() {
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
}

// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
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
});

// =========================================================
// GLOBAL EXPORTS
// =========================================================

window.loadResults = loadResults;
window.toggleSidebar = toggleSidebar;
window.goPage = goPage;
