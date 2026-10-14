import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let selectedAcademicYear = "";


// ===============================
// AUTHENTICATION
// ===============================

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace("../login.html");
        return;
    }

    // Load faculty name for welcome message
    await loadFacultyWelcomeName(user.uid);
});


// ===============================
// LOAD FACULTY FULL NAME
// ===============================

async function loadFacultyWelcomeName(uid) {

    const welcomeName = document.getElementById("faculty-welcome-name");

    if (!welcomeName) {
        console.warn("faculty-welcome-name element was not found.");
        return;
    }

    try {

        const facultyRef = doc(db, "users", uid);
        const facultySnap = await getDoc(facultyRef);

        if (facultySnap.exists()) {

            const data = facultySnap.data();

            const fullname =
                data.fullname ||
                data.name ||
                "Faculty";

            welcomeName.textContent = fullname;

        } else {

            welcomeName.textContent = "Faculty";
        }

    } catch (error) {

        console.error(
            "Faculty Welcome Name Error:",
            error
        );

        welcomeName.textContent = "Faculty";
    }
}


// ===============================
// RELOAD WHEN PAGE IS RESTORED
// ===============================

window.addEventListener("pageshow", (event) => {

    if (event.persisted) {
        window.location.reload();
    }

});


// ===============================
// SIDEBAR
// ===============================

function toggleSidebar() {

    const sidebar = document.getElementById("sidebar");

    if (!sidebar) {
        return;
    }

    sidebar.classList.toggle("active");
}


// ===============================
// PAGE NAVIGATION
// ===============================

function goPage(url) {

    window.location.href = url;
}


// ===============================
// LOAD ACADEMIC YEARS
// ===============================

async function loadAcademicYears() {

    const select =
        document.getElementById("academicYearSelect");

    if (!select) {
        console.warn("academicYearSelect was not found.");
        return;
    }

    try {

        const snapshot =
            await getDocs(
                collection(db, "academicYears")
            );

        const years = [];

        snapshot.forEach((docSnap) => {

            const data = docSnap.data();

            years.push({
                id: docSnap.id,
                year: data.year,
                active: data.active === true
            });

        });


        // ===============================
        // SORT YEARS
        // ===============================

        years.sort((a, b) => {

            return String(b.year).localeCompare(
                String(a.year)
            );

        });


        // ===============================
        // CLEAR DROPDOWN
        // ===============================

        select.innerHTML = "";


        // ===============================
        // NO ACADEMIC YEAR
        // ===============================

        if (years.length === 0) {

            select.innerHTML = `
                <option value="">
                    No academic year available
                </option>
            `;

            selectedAcademicYear = "";

            await loadDashboardStats("");

            return;
        }


        // ===============================
        // ADD YEARS
        // ===============================

        years.forEach((item) => {

            const option =
                document.createElement("option");

            option.value = item.year;
            option.textContent = item.year;

            select.appendChild(option);

        });


        // ===============================
        // FIND ACTIVE YEAR
        // ===============================

        const activeYear =
            years.find((item) => item.active);


        if (activeYear) {

            selectedAcademicYear =
                activeYear.year;

            select.value =
                activeYear.year;

        } else {

            selectedAcademicYear =
                years[0].year;

            select.value =
                years[0].year;
        }


        // ===============================
        // YEAR CHANGE
        // ===============================

        select.onchange = async function () {

            selectedAcademicYear =
                this.value;

            await loadDashboardStats(
                selectedAcademicYear
            );

        };


        // ===============================
        // INITIAL DASHBOARD LOAD
        // ===============================

        await loadDashboardStats(
            selectedAcademicYear
        );

    } catch (error) {

        console.error(
            "Unable to load academic years:",
            error
        );

        select.innerHTML = `
            <option value="">
                Unable to load academic years
            </option>
        `;
    }
}


// ===============================
// MATCHING HELPERS
//
// Results store the student's account ID (studentUid)
// and email. A student is matched using every ID the
// student record can have, so the dashboard card and
// the table always agree.
// ===============================

function normalizeKey(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();
}


function getStudentKeys(student) {

    return [
        student.id,
        student.uid,
        student.userId,
        student.email
    ]
        .map(normalizeKey)
        .filter(Boolean);
}


function hasCompletedExam(student, completedKeys) {

    return getStudentKeys(student).some(
        (key) => completedKeys.has(key)
    );
}


// ===============================
// LOAD DASHBOARD STATISTICS
// ===============================

async function loadDashboardStats(year) {

    try {

        // ===============================
        // STUDENTS
        // ===============================

        let students = [];

        if (year) {

            const studentsQuery =
                query(
                    collection(db, "users"),
                    where("role", "==", "Student"),
                    where(
                        "activeAcademicYear",
                        "==",
                        year
                    )
                );

            const studentsSnapshot =
                await getDocs(studentsQuery);

            studentsSnapshot.forEach((docSnap) => {

                students.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });

            });

        }


        // ===============================
        // RESULTS
        // ===============================

        let results = [];

        if (year) {

            const resultsQuery =
                query(
                    collection(db, "results"),
                    where(
                        "academicYear",
                        "==",
                        year
                    )
                );

            const resultsSnapshot =
                await getDocs(resultsQuery);

            resultsSnapshot.forEach((docSnap) => {

                results.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });

            });

        }


        // ===============================
        // SPECIALIZATIONS
        // ===============================

        const specializationSnapshot =
            await getDocs(
                collection(db, "specializations")
            );

        const specializations = [];

        specializationSnapshot.forEach((docSnap) => {

            specializations.push({
                id: docSnap.id,
                ...docSnap.data()
            });

        });


        // ===============================
        // TOTAL STUDENTS
        // ===============================

        const totalStudents =
            students.length;


        // ===============================
        // IDS / EMAILS THAT HAVE A RESULT
        // ===============================

        const completedKeys =
            new Set();


        results.forEach((result) => {

            const uidKey =
                normalizeKey(result.studentUid);

            const emailKey =
                normalizeKey(result.studentEmail);


            if (uidKey) {

                completedKeys.add(uidKey);

            }


            if (emailKey) {

                completedKeys.add(emailKey);

            }

        });


        // ===============================
        // COMPLETED STUDENTS
        //
        // Counted from the SAME student list the
        // table uses, so the card and the table
        // always show the same numbers.
        // ===============================

        const completedStudents =
            students.filter(
                (student) =>
                    hasCompletedExam(
                        student,
                        completedKeys
                    )
            ).length;


        // ===============================
        // REMAINING STUDENTS
        // ===============================

        const remainingStudents =
            Math.max(
                totalStudents -
                completedStudents,
                0
            );


        // ===============================
        // UPDATE DASHBOARD CARDS
        // ===============================

        const totalStudentsElement =
            document.getElementById(
                "totalStudents"
            );

        const completedStudentsElement =
            document.getElementById(
                "completedStudents"
            );

        const remainingStudentsElement =
            document.getElementById(
                "remainingStudents"
            );

        const totalSpecializationsElement =
            document.getElementById(
                "totalSpecializations"
            );


        if (totalStudentsElement) {

            totalStudentsElement.textContent =
                totalStudents;

        }


        if (completedStudentsElement) {

            completedStudentsElement.textContent =
                completedStudents;

        }


        if (remainingStudentsElement) {

            remainingStudentsElement.textContent =
                remainingStudents;

        }


        if (totalSpecializationsElement) {

            totalSpecializationsElement.textContent =
                specializations.length;

        }


        // ===============================
        // COMPLETION TABLE
        // ===============================

        loadCompletionTable(
            students,
            completedKeys
        );


    } catch (error) {

        console.error(
            "Unable to load dashboard statistics:",
            error
        );

    }
}


// ===============================
// COMPLETION TABLE
// ===============================

function loadCompletionTable(
    students,
    completedKeys
) {

    const tableBody =
        document.querySelector(
            "#completionTable tbody"
        );

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = "";


    // ===============================
    // NO STUDENTS
    // ===============================

    if (students.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No students available yet.
                </td>
            </tr>
        `;

        return;
    }


    // ===============================
    // ADD STUDENTS
    // ===============================

    students.forEach((student) => {

        const row =
            document.createElement("tr");


        const fullname =
            student.fullname ||
            student.name ||
            "N/A";


        const section =
            student.section ||
            "N/A";


        const academicYear =
            student.activeAcademicYear ||
            selectedAcademicYear ||
            "N/A";


        const completed =
            hasCompletedExam(
                student,
                completedKeys
            );


        const status =
            completed
                ? "Completed"
                : "Not Completed";


        row.innerHTML = `
            <td>${escapeHtml(fullname)}</td>

            <td>${escapeHtml(section)}</td>

            <td>${escapeHtml(academicYear)}</td>

            <td>
                <span class="status ${
                    completed
                        ? "completed"
                        : "pending"
                }">
                    ${status}
                </span>
            </td>
        `;


        tableBody.appendChild(row);

    });

}


// ===============================
// BASIC HTML ESCAPE
// ===============================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ===============================
// INITIALIZE DASHBOARD
// ===============================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadAcademicYears();

        if (
            typeof generateCalendar ===
            "function"
        ) {

            generateCalendar();

        }

    }
);


// ===============================
// WINDOW EXPORTS
// ===============================

window.toggleSidebar =
    toggleSidebar;

window.goPage =
    goPage;
