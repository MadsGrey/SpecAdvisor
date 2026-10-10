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

let loadedResults = [];

let usersLoaded = false;

/* Used so the recommendation matches the student's own page. */
let activeAcademicYear = "";

/* Specializations the Admin has administered (null = unknown). */
let approvedSpecializations = null;


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
// LOAD ACTIVE YEAR + ADMIN-APPROVED SPECIALIZATIONS
// (same rules the student's recommendation page uses)
// =========================================================

async function loadRecommendationContext() {

    activeAcademicYear = "";

    approvedSpecializations = null;


    try {

        const yearSnapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "academicYears"
                    ),

                    where(
                        "active",
                        "==",
                        true
                    )
                )
            );


        if (yearSnapshot.empty) {

            return;

        }


        activeAcademicYear =
            yearSnapshot.docs[0].data().year ||
            "";


        if (!activeAcademicYear) {

            return;

        }


        const questionSnapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "questionBank"
                    ),

                    where(
                        "academicYear",
                        "==",
                        activeAcademicYear
                    )
                )
            );


        const approved =
            new Set();


        questionSnapshot.forEach((docSnap) => {

            const data =
                docSnap.data();


            if (
                data.status === "administered" &&
                data.specialization
            ) {

                approved.add(
                    String(
                        data.specialization
                    ).trim()
                );

            }

        });


        approvedSpecializations =
            approved;


    } catch (error) {

        /* If this cannot be loaded, the report still works
           without the "approved only" filter. */

        console.error(
            "Recommendation context error:",
            error
        );

        approvedSpecializations = null;

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

                uid:
                    docSnap.id,

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
// LOAD RESULTS
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

                id:
                    docSnap.id,

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
// LOAD REPORT
// =========================================================

async function loadResults() {

    try {

        await Promise.all([

            loadUsers(),

            loadResultsFromFirestore(),

            loadRecommendationContext()

        ]);


        const tableHead =
            document.getElementById(
                "reportHead"
            );


        const tableBody =
            document.getElementById(
                "resultsTable"
            );


        if (
            !tableHead ||
            !tableBody
        ) {

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
        // GROUP STUDENTS
        // =====================================================

        let grouped = {};


        loadedResults.forEach((result) => {

            const resultName =
                result.studentName ||
                result.currentStudentName ||
                "";


            // Find the student by account ID first,
            // then fall back to the saved name.

            const student =
                allUsers.find(
                    (user) =>
                        result.studentUid &&
                        user.uid === result.studentUid
                )
                ||
                allUsers.find(
                    (user) =>
                        resultName &&
                        (
                            user.fullname === resultName ||
                            user.name === resultName
                        )
                );


            if (!student) {

                return;

            }


            const key =
                student.uid;


            if (!grouped[key]) {

                grouped[key] = {

                    name:
                        student.fullname ||
                        student.name ||
                        resultName ||
                        "Unknown Student",

                    studentNumber:
                        student.studentNumber ||
                        "N/A",

                    section:
                        student.section ||
                        "N/A",

                    // Total percentage per specialization.
                    totals: {},

                    selected:
                        student.selectedSpecialization ||
                        "Not Selected"

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

            if (
                result.status !== "Completed" ||
                !result.specialization
            ) {

                return;

            }


            const specialization =
                String(
                    result.specialization
                ).trim();


            if (
                approvedSpecializations &&
                result.academicYear === activeAcademicYear &&
                !approvedSpecializations.has(
                    specialization
                )
            ) {

                return;

            }


            const score =
                Number(
                    result.score || 0
                );


            const totalItems =
                Number(
                    result.totalItems || 0
                );


            let percentage =
                score;


            if (totalItems > 0) {

                percentage =
                    (score / totalItems) * 100;

            }


            grouped[key]
                .totals[specialization] =
                (
                    grouped[key]
                        .totals[specialization] || 0
                ) + percentage;

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


        let students =
            Object.keys(grouped);


        students.sort((a, b) =>
            grouped[a].name.localeCompare(
                grouped[b].name,
                undefined,
                {
                    sensitivity: "base"
                }
            )
        );


        // =====================================================
        // DISPLAY REPORT
        // =====================================================

        students.forEach((key) => {

            const data =
                grouped[key];


            const studentName =
                data.name;


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


            // =================================================
            // CALCULATE RECOMMENDATION
            // =================================================

            let highest = -1;

            let recommended = "N/A";


            for (
                const specialization in
                data.totals
            ) {

                const total =
                    data.totals[
                        specialization
                    ] || 0;


                if (
                    total > highest
                ) {

                    highest =
                        total;


                    recommended =
                        specialization;

                }

            }


            // =================================================
            // STATUS
            // =================================================

            let status =
                "Pending";


            if (
                data.selected !==
                "Not Selected"
            ) {

                if (
                    recommended !== "N/A" &&
                    String(data.selected)
                        .trim()
                        .toLowerCase() ===
                    String(recommended)
                        .trim()
                        .toLowerCase()
                ) {

                    status =
                        "Match";

                } else {

                    status =
                        "Different";

                }

            }


            // =================================================
            // TABLE ROW
            // =================================================

            tableBody.innerHTML += `

                <tr class="result-row">


                    <td>

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


                    <td>

                        <b>

                            ${escapeHtml(
                                recommended
                            )}

                        </b>

                    </td>


                    <td>

                        ${escapeHtml(
                            data.selected
                        )}

                    </td>


                    <td>

                        ${escapeHtml(
                            status
                        )}

                    </td>


                </tr>

            `;

        });


        // =====================================================
        // NO DATA
        // =====================================================

        if (
            tableBody.innerHTML.trim() === ""
        ) {

            tableBody.innerHTML = `

                <tr class="no-data">

                    <td colspan="6">

                        No student reports found

                    </td>

                </tr>

            `;

        }


    } catch (error) {

        console.error(
            "Report Error:",
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

            loadFilters()

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