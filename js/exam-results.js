import {
    db,
    auth
} from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


let allUsers = [];
let allSpecializations = [];

let usersLoaded = false;
let specializationsLoaded = false;

let loadedResults = [];


// =========================================================
// AUTHENTICATION
// =========================================================

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.replace("../login.html");

    }

});


// =========================================================
// PAGE SHOW
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

        const sectionsSnapshot =
            await getDocs(
                collection(db, "sections")
            );


        const sectionFilter =
            document.getElementById(
                "sectionFilter"
            );


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

            const data =
                docSnap.data();


            if (data.name) {

                sections.push(
                    data.name
                );

            }

        });


        sections.sort((a, b) =>
            String(a).localeCompare(
                String(b),
                undefined,
                {
                    sensitivity: "base"
                }
            )
        );


        sections.forEach((section) => {

            const option =
                document.createElement("option");


            option.value =
                section;


            option.textContent =
                section;


            sectionFilter.appendChild(
                option
            );

        });


    } catch (error) {

        console.error(
            "Section Filter Error:",
            error
        );

    }

}


// =========================================================
// LOAD ACADEMIC YEARS
// =========================================================

async function loadAcademicYears() {

    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "academicYears"
                )
            );


        const dropdown =
            document.getElementById(
                "academicYearFilter"
            );


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

            const data =
                docSnap.data();


            if (data.year) {

                years.push(
                    data.year
                );

            }

        });


        years.sort((a, b) =>
            String(b).localeCompare(
                String(a)
            )
        );


        years.forEach((year) => {

            const option =
                document.createElement("option");


            option.value =
                year;


            option.textContent =
                year;


            dropdown.appendChild(
                option
            );

        });


    } catch (error) {

        console.error(
            "Academic Year Error:",
            error
        );

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

        const usersSnapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "users"
                    ),

                    where(
                        "role",
                        "==",
                        "Student"
                    )
                )
            );


        allUsers = [];


        usersSnapshot.forEach((docSnap) => {

            const data =
                docSnap.data();


            allUsers.push({

                uid: docSnap.id,

                ...data,

                studentNumber:
                    data.studentNumber ||
                    "N/A"

            });

        });


        usersLoaded = true;


    } catch (error) {

        console.error(
            "Users Error:",
            error
        );

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

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "specializations"
                )
            );


        allSpecializations = [];


        snapshot.forEach((docSnap) => {

            const data =
                docSnap.data();


            const name =
                data.name ||
                data.specialization;


            if (name) {

                allSpecializations.push(
                    name
                );

            }

        });


        allSpecializations =
            [
                ...new Set(
                    allSpecializations
                )
            ];


        allSpecializations.sort(
            (a, b) =>
                String(a).localeCompare(
                    String(b),
                    undefined,
                    {
                        sensitivity: "base"
                    }
                )
        );


        specializationsLoaded = true;


    } catch (error) {

        console.error(
            "Specializations Error:",
            error
        );

    }

}


// =========================================================
// LOAD RESULTS FROM FIRESTORE
// =========================================================

async function loadResultsFromFirestore() {

    try {

        const academicYearFilter =
            document.getElementById(
                "academicYearFilter"
            );


        const selectedYear =
            academicYearFilter
                ? academicYearFilter.value
                : "All";


        let snapshot;


        if (selectedYear === "All") {

            snapshot =
                await getDocs(
                    collection(
                        db,
                        "results"
                    )
                );

        } else {

            snapshot =
                await getDocs(
                    query(
                        collection(
                            db,
                            "results"
                        ),

                        where(
                            "academicYear",
                            "==",
                            selectedYear
                        )
                    )
                );

        }


        loadedResults = [];


        snapshot.forEach((docSnap) => {

            loadedResults.push({

                id: docSnap.id,

                ...docSnap.data()

            });

        });


    } catch (error) {

        console.error(
            "Results Error:",
            error
        );

    }

}


// =========================================================
// LOAD AND DISPLAY RESULTS
// =========================================================

async function loadResults() {

    try {

        await Promise.all([

            loadUsers(),

            loadSpecializations(),

            loadResultsFromFirestore()

        ]);


        const tableHead =
            document.getElementById(
                "reportHead"
            );


        const tableBody =
            document.getElementById(
                "resultsTable"
            );


        if (!tableHead || !tableBody) {

            return;

        }


        const sectionFilter =
            document.getElementById(
                "sectionFilter"
            );


        const searchInput =
            document.getElementById(
                "searchInput"
            );


        const selectedSection =
            sectionFilter
                ? sectionFilter.value
                : "All";


        const search =
            searchInput
                ? searchInput.value
                    .trim()
                    .toLowerCase()
                : "";


        // =====================================================
        // GROUP RESULTS BY STUDENT
        // =====================================================

        let grouped = {};


        loadedResults.forEach((result) => {

            const studentName =
                result.studentName ||
                result.currentStudentName;


            if (!studentName) {

                return;

            }


            const student =
                allUsers.find(
                    (user) => {

                        return (

                            user.fullname ===
                            studentName

                            ||

                            user.name ===
                            studentName

                        );

                    }
                );


            if (!student) {

                return;

            }


            if (!grouped[studentName]) {

                grouped[studentName] = {

                    studentNumber:
                        student.studentNumber ||
                        "N/A",

                    section:
                        student.section ||
                        "N/A",

                    scores: {}

                };

            }


            grouped[studentName]
                .scores[
                    result.specialization
                ] =
                    result.score ?? 0;

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
                        `
                    )
                    .join("")
                }

            </tr>

        `;


        // =====================================================
        // CLEAR TABLE
        // =====================================================

        tableBody.innerHTML = "";


        let students =
            Object.keys(grouped);


        // =====================================================
        // SORT STUDENTS
        // =====================================================

        students.sort((a, b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    sensitivity: "base"
                }
            )
        );


        // =====================================================
        // DISPLAY STUDENTS
        // =====================================================

        students.forEach((studentName) => {

            const data =
                grouped[studentName];


            // SECTION FILTER

            if (
                selectedSection !== "All" &&
                data.section !== selectedSection
            ) {

                return;

            }


            // SEARCH FILTER

            if (
                search &&
                !studentName
                    .toLowerCase()
                    .includes(search)
            ) {

                return;

            }


            let row = `

                <tr class="result-row">

                    <td class="student-number">

                        ${escapeHtml(
                            data.studentNumber
                        )}

                    </td>


                    <td class="student-name">

                        ${escapeHtml(
                            studentName
                        )}

                    </td>


                    <td class="student-section">

                        ${escapeHtml(
                            data.section
                        )}

                    </td>

            `;


            allSpecializations.forEach(
                (specialization) => {

                    const score =
                        data.scores[
                            specialization
                        ];


                    row += `

                        <td class="score-cell">

                            ${
                                score === undefined
                                    ? "-"
                                    : escapeHtml(score)
                            }

                        </td>

                    `;

                }
            );


            row += `

                </tr>

            `;


            tableBody.innerHTML += row;

        });


        // =====================================================
        // NO DATA
        // =====================================================

        if (
            tableBody.innerHTML.trim() === ""
        ) {

            tableBody.innerHTML = `

                <tr class="no-data">

                    <td
                        colspan="${
                            allSpecializations.length + 3
                        }"
                    >

                        No student results found

                    </td>

                </tr>

            `;

        }


    } catch (error) {

        console.error(
            "Exam Results Error:",
            error
        );

    }

}


// =========================================================
// HTML ESCAPE
// =========================================================

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// =========================================================
// SIDEBAR
// =========================================================

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (sidebar) {

        sidebar.classList.toggle(
            "active"
        );

    }

}


// =========================================================
// PAGE NAVIGATION
// =========================================================

function goPage(url) {

    window.location.href =
        url;

}


// =========================================================
// INITIALIZE
// =========================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await Promise.all([

            loadAcademicYears(),

            loadFilters(),

            loadSpecializations()

        ]);


        await loadResults();


        const academicYearFilter =
            document.getElementById(
                "academicYearFilter"
            );


        const sectionFilter =
            document.getElementById(
                "sectionFilter"
            );


        const searchInput =
            document.getElementById(
                "searchInput"
            );


        if (academicYearFilter) {

            academicYearFilter.addEventListener(
                "change",
                async () => {

                    await loadResults();

                }
            );

        }


        if (sectionFilter) {

            sectionFilter.addEventListener(
                "change",
                async () => {

                    await loadResults();

                }
            );

        }


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                async () => {

                    await loadResults();

                }
            );

        }

    }
);


// =========================================================
// WINDOW EXPORTS
// =========================================================

window.loadResults =
    loadResults;

window.toggleSidebar =
    toggleSidebar;

window.goPage =
    goPage;