import { auth, db }
from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc
}
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================
   AUTH PROTECTION
========================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.replace("../login.html");

        return;

    }

    await loadAdminFullname(user);

});


/* =========================
   LOAD ADMIN FULLNAME
========================= */

async function loadAdminFullname(user) {

    const fullnameElement =
        document.getElementById("adminFullname");

    if (!fullnameElement) {

        return;

    }

    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        const userSnapshot =
            await getDoc(userRef);


        if (userSnapshot.exists()) {

            const userData =
                userSnapshot.data();


            if (userData.fullname) {

                fullnameElement.textContent =
                    userData.fullname;

            }
            else {

                fullnameElement.textContent =
                    "Administrator";

            }

        }
        else {

            fullnameElement.textContent =
                "Administrator";

        }

    }
    catch (error) {

        console.error(
            "Error loading admin fullname:",
            error
        );

        fullnameElement.textContent =
            "Administrator";

    }

}


/* =========================
   PREVENT BACK BUTTON CACHE
========================= */

window.addEventListener(
    "pageshow",
    (event) => {

        if (event.persisted) {

            window.location.reload();

        }

    }
);


/* =========================
   SIDEBAR
========================= */

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


/* =========================
   NAVIGATION
========================= */

function goPage(url) {

    document.body.style.opacity =
        "0";

    setTimeout(() => {

        window.location.href =
            url;

    }, 300);

}


/* =========================
   ACADEMIC YEAR
========================= */

let selectedAcademicYear = "";

let academicYearsLoaded = false;


/* =========================
   LOAD ACADEMIC YEARS
========================= */

async function loadAcademicYears() {

    if (academicYearsLoaded) {

        return;

    }

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
                "academicYearSelect"
            );


        if (!dropdown) {

            return;

        }


        dropdown.innerHTML = "";


        let activeYear = "";


        snapshot.forEach(
            (docSnap) => {

                const data =
                    docSnap.data();


                if (!data.year) {

                    return;

                }


                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    data.year;


                option.textContent =
                    data.year;


                dropdown.appendChild(
                    option
                );


                if (data.active) {

                    activeYear =
                        data.year;

                }

            }
        );


        academicYearsLoaded =
            true;


        if (activeYear) {

            selectedAcademicYear =
                activeYear;

        }
        else if (
            dropdown.options.length > 0
        ) {

            selectedAcademicYear =
                dropdown.options[0].value;

        }


        dropdown.value =
            selectedAcademicYear;


        dropdown.onchange =
            async () => {

                selectedAcademicYear =
                    dropdown.value;


                await loadDashboardStats(
                    selectedAcademicYear
                );

            };


        if (selectedAcademicYear) {

            await loadDashboardStats(
                selectedAcademicYear
            );

        }

    }
    catch (error) {

        console.error(
            "Error loading academic years:",
            error
        );

    }

}


/* =========================
   LOAD DASHBOARD STATS
========================= */

async function loadDashboardStats(
    year
) {

    if (!year) {

        return;

    }


    try {

        /* STUDENTS */

        const studentsQuery =
            query(
                collection(
                    db,
                    "users"
                ),
                where(
                    "role",
                    "==",
                    "Student"
                ),
                where(
                    "activeAcademicYear",
                    "==",
                    year
                )
            );


        /* FACULTY */

        const facultyQuery =
            query(
                collection(
                    db,
                    "users"
                ),
                where(
                    "role",
                    "==",
                    "Faculty"
                ),
                where(
                    "activeAcademicYear",
                    "==",
                    year
                )
            );


        /* SPECIALIZATIONS */

        const specializationsQuery =
            collection(
                db,
                "specializations"
            );


        /* COMPLETED RESULTS */

        const recommendationsQuery =
            query(
                collection(
                    db,
                    "results"
                ),
                where(
                    "academicYear",
                    "==",
                    year
                ),
                where(
                    "status",
                    "==",
                    "Completed"
                )
            );


        const [
            studentsSnapshot,
            facultySnapshot,
            specializationsSnapshot,
            recommendationsSnapshot
        ] = await Promise.all([

            getDocs(
                studentsQuery
            ),

            getDocs(
                facultyQuery
            ),

            getDocs(
                specializationsQuery
            ),

            getDocs(
                recommendationsQuery
            )

        ]);


        const totalStudents =
            studentsSnapshot.size;


        const totalFaculty =
            facultySnapshot.size;


        const totalSpecializations =
            specializationsSnapshot.size;


        const totalRecommendations =
            recommendationsSnapshot.size;


        const studentsElement =
            document.getElementById(
                "totalStudents"
            );


        const facultyElement =
            document.getElementById(
                "totalFaculty"
            );


        const specializationsElement =
            document.getElementById(
                "totalSpecializations"
            );


        const recommendationsElement =
            document.getElementById(
                "totalRecommendations"
            );


        if (studentsElement) {

            studentsElement.textContent =
                totalStudents;

        }


        if (facultyElement) {

            facultyElement.textContent =
                totalFaculty;

        }


        if (specializationsElement) {

            specializationsElement.textContent =
                totalSpecializations;

        }


        if (recommendationsElement) {

            recommendationsElement.textContent =
                totalRecommendations;

        }


        console.log(
            "Dashboard stats loaded:",
            {
                year: year,
                students: totalStudents,
                faculty: totalFaculty,
                recommendations:
                    totalRecommendations,
                specializations:
                    totalSpecializations
            }
        );

    }
    catch (error) {

        console.error(
            "Error loading dashboard stats:",
            error
        );

    }

}


/* =========================
   LOAD DASHBOARD
========================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await loadAcademicYears();

    }
);


/* =========================
   GLOBAL FUNCTIONS
========================= */

window.toggleSidebar =
    toggleSidebar;

window.goPage =
    goPage;


/*
 * DO NOT define window.logout here.
 *
 * admin-profile.js remains the
 * central admin profile handler.
 */


/* =====================================================
   DASHBOARD LOGOUT MODAL
===================================================== */

function openDashboardLogout() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );


    if (!overlay) {

        console.error(
            "Dashboard logout overlay was not found."
        );

        return;

    }


    overlay.classList.add(
        "active"
    );


    overlay.style.display =
        "flex";


    document.body.style.overflow =
        "hidden";

}


function closeDashboardLogout() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );


    if (!overlay) {

        return;

    }


    overlay.classList.remove(
        "active"
    );


    overlay.style.display =
        "none";


    document.body.style.overflow =
        "";

}


function closeDashboardLogoutOutside(
    event
) {

    if (
        event &&
        event.target &&
        event.target.id ===
            "logout-overlay"
    ) {

        closeDashboardLogout();

    }

}


async function confirmDashboardLogout() {

    const confirmButton =
        document.querySelector(
            ".logout-confirm-btn"
        );


    if (confirmButton) {

        confirmButton.disabled =
            true;

        confirmButton.textContent =
            "Logging out...";

    }


    try {

        await signOut(auth);


        localStorage.clear();


        window.location.replace(
            "../login.html"
        );

    }

    catch (error) {

        console.error(
            "Logout failed:",
            error
        );


        if (confirmButton) {

            confirmButton.disabled =
                false;

            confirmButton.textContent =
                "Log Out";

        }


        alert(
            "Unable to log out. Please try again."
        );

    }

}


/* =====================================================
   MAKE FUNCTIONS AVAILABLE TO HTML onclick
===================================================== */

window.openDashboardLogout =
    openDashboardLogout;

window.closeDashboardLogout =
    closeDashboardLogout;

window.closeDashboardLogoutOutside =
    closeDashboardLogoutOutside;

window.confirmDashboardLogout =
    confirmDashboardLogout;