import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* ================================================= */
/* AUTHENTICATION */
/* ================================================= */

let currentUser = null;


onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.replace(
                "../login.html"
            );

            return;

        }


        currentUser = user;


        console.log(
            "Student Dashboard Auth:",
            user.email
        );


        console.log(
            "Student Dashboard UID:",
            user.uid
        );


        await loadStudentName();

    }
);


/* ================================================= */
/* LOAD STUDENT NAME */
/* ================================================= */

async function loadStudentName() {

    const welcomeName =
        document.getElementById(
            "student-welcome-name"
        );


    if (!welcomeName) {

        return;

    }


    const user =
        currentUser ||
        auth.currentUser;


    if (!user) {

        welcomeName.textContent =
            "Student";

        return;

    }


    try {

        /*
         * IMPORTANT:
         * Read only the student's own
         * users document using UID.
         *
         * This avoids querying the
         * entire users collection.
         */

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const snapshot =
            await getDoc(
                userRef
            );


        if (snapshot.exists()) {

            const data =
                snapshot.data();


            const fullname =
                (
                    data.fullname ||
                    data.name ||
                    ""
                ).trim();


            if (fullname) {

                welcomeName.textContent =
                    fullname;

                return;

            }

        }


        /*
         * Fallback to Firebase email
         * if fullname does not exist.
         */

        if (user.email) {

            welcomeName.textContent =
                user.email.split("@")[0];

        }
        else {

            welcomeName.textContent =
                "Student";

        }

    }
    catch (error) {

        console.error(
            "Unable to load student name:",
            error
        );


        /*
         * Do not break the dashboard
         * just because the name failed.
         */

        welcomeName.textContent =
            "Student";

    }

}


/* ================================================= */
/* CALENDAR */
/* ================================================= */

function renderCalendar() {

    const calendarBody =
        document.getElementById(
            "calendar-body"
        );


    const calendarTitle =
        document.getElementById(
            "calendar-title"
        );


    if (!calendarBody) {

        return;

    }


    const today =
        new Date();


    const year =
        today.getFullYear();


    const month =
        today.getMonth();


    const monthNames = [

        "JANUARY",
        "FEBRUARY",
        "MARCH",
        "APRIL",
        "MAY",
        "JUNE",
        "JULY",
        "AUGUST",
        "SEPTEMBER",
        "OCTOBER",
        "NOVEMBER",
        "DECEMBER"

    ];


    if (calendarTitle) {

        calendarTitle.textContent =
            `${monthNames[month]} ${year}`;

    }


    const firstDay =
        new Date(
            year,
            month,
            1
        ).getDay();


    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();


    calendarBody.innerHTML =
        "";


    let row =
        document.createElement(
            "tr"
        );


    /*
     * Empty cells before
     * the first day.
     */

    for (
        let i = 0;
        i < firstDay;
        i++
    ) {

        const cell =
            document.createElement(
                "td"
            );


        cell.innerHTML =
            "&nbsp;";


        row.appendChild(
            cell
        );

    }


    /*
     * Calendar days.
     */

    for (
        let day = 1;
        day <= daysInMonth;
        day++
    ) {

        const cell =
            document.createElement(
                "td"
            );


        cell.textContent =
            day;


        /*
         * Highlight today.
         */

        if (
            day === today.getDate()
        ) {

            cell.classList.add(
                "today"
            );

        }


        row.appendChild(
            cell
        );


        /*
         * End of week.
         */

        if (
            (firstDay + day) % 7 === 0
        ) {

            calendarBody.appendChild(
                row
            );


            row =
                document.createElement(
                    "tr"
                );

        }

    }


    /*
     * Complete the final row.
     */

    if (
        row.children.length > 0
    ) {

        while (
            row.children.length < 7
        ) {

            const cell =
                document.createElement(
                    "td"
                );


            cell.innerHTML =
                "&nbsp;";


            row.appendChild(
                cell
            );

        }


        calendarBody.appendChild(
            row
        );

    }

}


/* ================================================= */
/* PAGE NAVIGATION */
/* ================================================= */

function goPage(page) {

    if (!page) {

        return;

    }


    window.location.href =
        page;

}


/* ================================================= */
/* PAGE INITIALIZATION */
/* ================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        renderCalendar();

    }
);


/* ================================================= */
/* EXPORT */
/* ================================================= */

window.goPage =
    goPage;

window.renderCalendar =
    renderCalendar;