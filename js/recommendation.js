import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


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

    const sidebar =
        document.getElementById("sidebar");

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

    const overlay =
        document.getElementById("logout-overlay");

    if (!overlay) {

        console.error(
            "Logout overlay not found."
        );

        return;

    }

    overlay.classList.add("active");

}


function closeLogoutModal() {

    const overlay =
        document.getElementById("logout-overlay");

    if (overlay) {

        overlay.classList.remove("active");

    }

}


function closeLogoutOutside(event) {

    if (
        event.target &&
        event.target.id === "logout-overlay"
    ) {

        closeLogoutModal();

    }

}


async function performLogout() {

    try {

        await signOut(auth);

        localStorage.clear();

        window.location.replace(
            "../login.html"
        );

    }
    catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Unable to log out."
        );

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

    const q =
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
        );


    const snapshot =
        await getDocs(q);


    if (snapshot.empty) {

        return "";

    }


    return (
        snapshot.docs[0]
            .data()
            .year || ""
    );

}


/* =========================================================
   GET ADMIN-APPROVED / ADMINISTERED EXAMS
========================================================= */

async function getAdminApprovedSpecializations(
    academicYear
) {

    /*
     * IMPORTANT:
     *
     * We DO NOT change anything coming from Admin.
     *
     * Administered = approved/available to students.
     *
     * ready_for_admin = NOT counted.
     */

    const q =
        query(
            collection(
                db,
                "questionBank"
            ),
            where(
                "academicYear",
                "==",
                academicYear
            )
        );


    const snapshot =
        await getDocs(q);


    const approved =
        new Set();


    snapshot.forEach(docSnapshot => {

        const data =
            docSnapshot.data();


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


    return Array.from(
        approved
    ).sort();

}


/* =========================================================
   GET STUDENT RESULTS
========================================================= */

async function getStudentResults(
    user,
    academicYear
) {

    const q =
        query(
            collection(
                db,
                "results"
            ),
            where(
                "studentUid",
                "==",
                user.uid
            ),
            where(
                "academicYear",
                "==",
                academicYear
            )
        );


    const snapshot =
        await getDocs(q);


    const results = [];


    snapshot.forEach(docSnapshot => {

        results.push({

            id: docSnapshot.id,

            ...docSnapshot.data()

        });

    });


    return results;

}


/* =========================================================
   LOAD RECOMMENDATION
========================================================= */

async function loadRecommendation(user) {

    const container =
        document.getElementById(
            "recommendationContainer"
        );


    if (!container) {

        return;

    }


    /*
     * Hide Continue button first.
     */

    const continueBtn =
        document.getElementById(
            "continueBtn"
        );


    if (continueBtn) {

        continueBtn.style.display =
            "none";

    }


    container.innerHTML = `

        <div class="loading-box">

            <h2>
                Checking Your Exams...
            </h2>

            <p>
                Please wait.
            </p>

        </div>

    `;


    try {


        /* =================================================
           ACTIVE ACADEMIC YEAR
        ================================================= */

        const activeAcademicYear =
            await getActiveAcademicYear();


        if (!activeAcademicYear) {

            container.innerHTML = `

                <div class="rec-empty">

                    <p>
                        No active academic year is available yet.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================================
           ADMIN-APPROVED EXAMS
        ================================================= */

        const approvedSpecializations =
            await getAdminApprovedSpecializations(
                activeAcademicYear
            );


        if (
            approvedSpecializations.length === 0
        ) {

            container.innerHTML = `

                <div class="rec-empty">

                    <h2>
                        No approved specialization exams yet.
                    </h2>

                    <p>
                        Please wait for the Admin to administer the specialization exams.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================================
           STUDENT RESULTS
        ================================================= */

        const studentResults =
            await getStudentResults(
                user,
                activeAcademicYear
            );


        /* =================================================
           FIND COMPLETED EXAMS
        ================================================= */

        const completedSpecializations =
            new Set();


        studentResults.forEach(result => {

            if (
                result.status === "Completed" &&
                result.specialization
            ) {

                const specialization =
                    String(
                        result.specialization
                    ).trim();


                /*
                 * Only count results for exams that
                 * Admin currently approved.
                 */

                if (
                    approvedSpecializations.includes(
                        specialization
                    )
                ) {

                    completedSpecializations.add(
                        specialization
                    );

                }

            }

        });


        /* =================================================
           FIND REMAINING EXAMS
        ================================================= */

        const incompleteSpecializations =
            approvedSpecializations.filter(
                specialization =>
                    !completedSpecializations.has(
                        specialization
                    )
            );


        /* =================================================
           NOT ALL EXAMS COMPLETED
        ================================================= */

        if (
            incompleteSpecializations.length > 0
        ) {

            let examListHTML = "";


            incompleteSpecializations.forEach(
                specialization => {

                    examListHTML += `

                        <li>
                            ${escapeHTML(
                                specialization
                            )}
                        </li>

                    `;

                }
            );


            container.innerHTML = `

                <div class="rec-empty">

                    <h2>
                        You still have specialization exams to complete.
                    </h2>

                    <p>
                        Please complete all Admin-approved specialization exams before your recommendation can be generated.
                    </p>

                    <ul>

                        ${examListHTML}

                    </ul>

                    <p>
                        Go to <strong>Take Exam</strong> to complete them.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================================
           ALL APPROVED EXAMS COMPLETED
        ================================================= */

        const specializationScores = {};


        /*
         * Only use completed results from the
         * Admin-approved specializations.
         */

        studentResults.forEach(result => {

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
                !approvedSpecializations.includes(
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


            /*
             * Convert scores to percentage so
             * exams with different question counts
             * can be compared fairly.
             */

            let percentage = score;


            if (totalItems > 0) {

                percentage =
                    (
                        score /
                        totalItems
                    ) * 100;

            }


            if (
                !specializationScores[
                    specialization
                ]
            ) {

                specializationScores[
                    specialization
                ] = 0;

            }


            specializationScores[
                specialization
            ] += percentage;

        });


        /* =================================================
           MAKE SURE EVERY APPROVED SPECIALIZATION EXISTS
        ================================================= */

        approvedSpecializations.forEach(
            specialization => {

                if (
                    specializationScores[
                        specialization
                    ] === undefined
                ) {

                    specializationScores[
                        specialization
                    ] = 0;

                }

            }
        );


        /* =================================================
           RANK SPECIALIZATIONS
        ================================================= */

        const rankings =
            Object.entries(
                specializationScores
            )
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


        if (
            rankings.length === 0
        ) {

            container.innerHTML = `

                <div class="rec-empty">

                    <p>
                        No recommendation results are available yet.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================================
           BEST SPECIALIZATION
        ================================================= */

        const bestSpec =
            rankings[0][0];


        /* =================================================
           RANKING HTML
        ================================================= */

        let rankingHTML = "";


        rankings.forEach(
            (
                [specialization, score],
                index
            ) => {

                rankingHTML += `

                    <div class="ranking-card">

                        <h3>

                            ${index + 1}.
                            ${escapeHTML(
                                specialization
                            )}

                        </h3>

                        <p>

                            Exam Match Score:

                            <b>

                                ${Number(
                                    score
                                ).toFixed(1)}%

                            </b>

                        </p>

                    </div>

                `;

            }
        );


        /* =================================================
           DISPLAY RECOMMENDATION
        ================================================= */

        container.innerHTML = `

            <div class="rec-main">

                <div class="rec-icon">

                    <svg
                        viewBox="0 0 24 24"
                        width="32"
                        height="32"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >

                        <path d="M12 3l2.6 5.3L20.5 9l-4.2 4.1 1 5.9L12 16.2 6.7 19l1-5.9L3.5 9l5.9-.7L12 3z"></path>

                    </svg>

                </div>


                <div>

                    <div class="rec-name">

                        ${escapeHTML(
                            bestSpec
                        )}

                    </div>


                    <p>

                        Based on your completed
                        specialization exam performance.

                        <br><br>

                        ✔ All Admin-approved exams completed

                        <br>

                        ✔ Current Academic Year

                        <br>

                        ✔ Exam Performance

                    </p>

                </div>

            </div>


            <br>


            <div class="ranking-section">

                <h2>
                    Specialization Rankings
                </h2>

                ${rankingHTML}

            </div>

        `;


        /*
         * Allow Continue / Selection button.
         */

        if (continueBtn) {

            continueBtn.style.display =
                "inline-block";

        }


    }
    catch (error) {

        console.error(
            "Recommendation error:",
            error
        );


        container.innerHTML = `

            <div class="rec-empty">

                <p>
                    Unable to load your recommendation.
                    Please try again.
                </p>

            </div>

        `;

    }

}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
    auth,
    user => {

        if (!user) {

            window.location.replace(
                "../login.html"
            );

            return;

        }


        loadRecommendation(user);

    }
);


/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.toggleSidebar =
    toggleSidebar;


window.goPage =
    goPage;


window.logout =
    logout;


window.closeLogoutModal =
    closeLogoutModal;


window.closeLogoutOutside =
    closeLogoutOutside;


window.performLogout =
    performLogout;