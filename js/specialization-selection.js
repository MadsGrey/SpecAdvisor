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
    getDocs,
    doc,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert, appConfirm } from "./ui-dialog.js";

/*
 * Same rule engine as the Specialization Recommendation page
 * (it lives in recommendation.js), so the "Recommended" star
 * here always matches that page.
 */
import {
    buildSpecializationStats,
    loadSpecializationTags,
    getInterestProfile,
    evaluateRecommendation
} from "./recommendation.js";


/* =========================================================
   AUTHENTICATION
========================================================= */

onAuthStateChanged(auth, (user) => {

    if (!user) {

        window.location.replace(
            "../login.html"
        );

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
        document.getElementById(
            "logout-overlay"
        );

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
        document.getElementById(
            "logout-overlay"
        );

    if (overlay) {

        overlay.classList.remove("active");

    }

}


function closeLogoutOutside(event) {

    if (
        event.target &&
        event.target.id ===
            "logout-overlay"
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

        await appAlert(
            "Unable to log out.",
            { type: "error" }
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


    const data =
        snapshot.docs[0].data();


    return String(
        data.year ||
        data.name ||
        ""
    );

}


/* =========================================================
   CHECK IF ADMIN HAS ADMINISTERED AN EXAM
========================================================= */

async function hasAdministeredExam(
    academicYear
) {

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


    return snapshot.docs.some(
        docSnapshot =>
            docSnapshot.data().status ===
            "administered"
    );

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
   LOAD PAGE
========================================================= */

async function loadPage(user) {

    const selectionContainer =
        document.getElementById(
            "selectionContainer"
        );


    const recommendationBox =
        document.getElementById(
            "recommendationBox"
        );


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

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


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


        const userData =
            userSnap.data();


        /* =================================================
           IF ALREADY SELECTED
        ================================================= */

        if (
            userData.selectedSpecialization
        ) {

            selectionContainer.innerHTML = `

                <div class="selection">

                    <h2>
                        Your Selected Specialization
                    </h2>

                    <br>

                    <h1 style="color:#ff4fa3;">

                        ${escapeHTML(
                            userData.selectedSpecialization
                        )}

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

                            ${escapeHTML(
                                userData.selectedSpecialization
                            )}

                        </h1>

                    </div>

                `;

            }


            return;

        }


        /* =================================================
           ACTIVE ACADEMIC YEAR
        ================================================= */

        const activeAcademicYear =
            await getActiveAcademicYear();


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
           GET STUDENT RESULTS
        ================================================= */

        const studentResults =
            await getStudentResults(
                user,
                activeAcademicYear
            );


        /* =================================================
           HAS THE STUDENT FINISHED THE COMPREHENSIVE EXAM?

           take-exam.js saves ONE Completed result for the
           whole exam (not one per specialization).
        ================================================= */

        const hasCompleted =
            studentResults.some(
                result =>
                    result.status === "Completed"
            );


        if (!hasCompleted) {

            /*
             * Only a student who has NOT finished the exam needs the
             * Admin's exam to still be administered. A student who
             * already finished can always choose, even after the
             * exam period ends and the exam stops automatically.
             */

            const examAvailable =
                await hasAdministeredExam(
                    activeAcademicYear
                );


            if (!examAvailable) {

                selectionContainer.innerHTML = `

                    <div class="selection">

                        <h2>
                            Specialization Selection Unavailable
                        </h2>

                        <p>
                            The Admin has not administered the
                            examination yet. Please check back later.
                        </p>

                    </div>

                `;


                if (recommendationBox) {

                    recommendationBox.innerHTML = "";

                }


                return;

            }


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
           CALCULATE RECOMMENDATION (shared rule engine)
        ================================================= */

        const stats =
            buildSpecializationStats(
                studentResults
            );


        const tagMap =
            await loadSpecializationTags();


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


        const recommended =
            evaluation.status === "recommended"
                ? evaluation.primary.specialization
                : "";


        /* =================================================
           DISPLAY RECOMMENDATION
        ================================================= */

        if (recommendationBox) {

            if (recommended) {

                recommendationBox.innerHTML = `

                    <div class="selection">

                        <h2>
                            ${
                                evaluation.confidence === "Low"
                                ? "Best Relative Fit"
                                : "Recommended Specialization"
                            }
                        </h2>

                        <h1 style="color:#2f2fa2;">

                            ${escapeHTML(
                                recommended
                            )}

                        </h1>

                        <p>

                            Confidence:
                            <strong>
                                ${escapeHTML(
                                    evaluation.confidence
                                )}
                            </strong>
                            .
                            This recommendation is based on
                            your completed exam
                            ${
                                interest
                                ? "and your interest assessment"
                                : ""
                            }.
                            See the
                            <strong>Specialization Recommendation</strong>
                            page for the full explanation.

                        </p>

                        ${
                            evaluation.confidence === "Low"
                            ? `<p>
                                Your scores were low across all
                                specializations. Please talk with
                                your adviser before deciding.
                               </p>`
                            : ""
                        }

                    </div>

                `;

            }
            else {

                recommendationBox.innerHTML = `

                    <div class="selection">

                        <h2>
                            No Clear Recommendation
                        </h2>

                        <p>

                            ${escapeHTML(
                                evaluation.reasons[0]
                            )}
                            Please talk with your adviser
                            before choosing.

                        </p>

                    </div>

                `;

            }

        }


        /* =================================================
           LOAD SPECIALIZATIONS
        ================================================= */

        const specSnap =
            await getDocs(
                collection(
                    db,
                    "specializations"
                )
            );


        let html = `

            <h2>
                Choose Your Preferred Specialization
            </h2>

            ${
                recommended
                ? `<p>
                    Your recommended specialization is:
                    <strong style="color:#2f2fa2;">
                        ${escapeHTML(recommended)}
                    </strong>
                   </p>`
                : ""
            }

            <br>

        `;


        specSnap.forEach(docSnapshot => {

            const data =
                docSnapshot.data();


            const spec =
                data.name;


            if (!spec) {

                return;

            }


            const isRecommended =
                recommended &&
                String(spec).trim() ===
                String(recommended).trim();


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

                    ${
                        isRecommended
                        ? " ⭐ Recommended"
                        : ""
                    }

                </button>

            `;

        });


        selectionContainer.innerHTML =
            html;


    }
    catch (error) {

        console.error(
            "Selection page error:",
            error
        );


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

window.selectSpec =
    async function(spec) {

        const confirmChoice =
            await appConfirm(

                `Are you sure you want to choose ${spec}?\n\n` +
                `You cannot change it after confirming.`,

                {
                    title: "Confirm Specialization",
                    confirmText: "Yes, Choose",
                    type: "warning"
                }

            );


        if (!confirmChoice) {

            return;

        }


        try {

            await updateDoc(

                doc(
                    db,
                    "users",
                    auth.currentUser.uid
                ),

                {
                    selectedSpecialization:
                        spec
                }

            );


            await appAlert(
                "Specialization successfully selected.",
                {
                    title: "Specialization Selected",
                    type: "success"
                }
            );


            location.reload();


        }
        catch (error) {

            console.error(
                "Selection error:",
                error
            );


            await appAlert(
                "Unable to save your specialization.",
                { type: "error" }
            );

        }

    };


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
