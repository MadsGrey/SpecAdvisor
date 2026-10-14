import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
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

        await loadProgress();

    }
);


/* ================================================= */
/* ESCAPE HTML */
/* ================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


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
/* MY PROGRESS                                       */
/* (replaces the old separate Final Result page)     */
/* ================================================= */

async function loadProgress() {

    const box =
        document.getElementById(
            "progress-box"
        );


    if (!box) {

        return;

    }


    const user =
        currentUser ||
        auth.currentUser;


    if (!user) {

        return;

    }


    try {

        /* Active academic year */

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


        let academicYear = "";

        if (!yearSnapshot.empty) {

            const yearData =
                yearSnapshot.docs[0].data();

            academicYear = String(
                yearData.year ||
                yearData.name ||
                ""
            );

        }


        /* Chosen specialization (if any) */

        const userSnapshot =
            await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


        const selected =
            userSnapshot.exists()
                ? String(
                    userSnapshot.data()
                        .selectedSpecialization ||
                    ""
                ).trim()
                : "";


        /* Completed exam result for the active year */

        let result = null;

        if (academicYear) {

            const resultSnapshot =
                await getDocs(
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
                    )
                );


            result =
                resultSnapshot.docs
                    .map(item => item.data())
                    .find(
                        item =>
                            item.status === "Completed"
                    ) || null;

        }


        renderProgress(
            box,
            {
                academicYear,
                result,
                selected
            }
        );

    }
    catch (error) {

        console.error(
            "Unable to load progress:",
            error
        );


        /* The dashboard still works without this card. */

        box.innerHTML = "";

    }

}


function renderProgress(
    box,
    {
        academicYear,
        result,
        selected
    }
) {

    const hasCompleted =
        !!result;


    /* ---------- one step of the strip ---------- */

    const step = (
        number,
        label,
        state
    ) => {

        const done =
            state === "done";

        const current =
            state === "current";

        return `

            <div style="display:flex;align-items:center;gap:10px;
                flex:1 1 180px;">

                <span style="width:30px;height:30px;border-radius:50%;
                    display:flex;align-items:center;
                    justify-content:center;font-size:14px;
                    font-weight:700;flex-shrink:0;
                    background:${
                        done
                        ? "#2e8b57"
                        : current
                        ? "#244b5a"
                        : "#e8eff1"
                    };
                    color:${
                        done || current
                        ? "#fff"
                        : "#829197"
                    };">
                    ${done ? "✓" : number}
                </span>

                <span style="font-size:13px;line-height:1.3;
                    font-weight:${current ? "700" : "500"};
                    color:${
                        done || current
                        ? "#244b5a"
                        : "#829197"
                    };">
                    ${escapeHTML(label)}
                </span>

            </div>

        `;

    };


    const step1 =
        hasCompleted
            ? "done"
            : "current";

    const step2 =
        selected
            ? "done"
            : hasCompleted
            ? "current"
            : "todo";

    const step3 =
        selected
            ? "done"
            : "todo";


    /* ---------- status text + next action ---------- */

    let title = "";
    let message = "";
    let buttonLabel = "";
    let buttonPage = "";


    if (!academicYear) {

        title =
            "No active academic year yet";

        message =
            "The Administrator has not set an active academic year. " +
            "Please check back later.";

    }
    else if (selected) {

        title =
            "You're all set!";

        message =
            `You selected ${selected}. Please proceed to the ` +
            `HEIMS Enrollment System to complete your enrollment.`;

    }
    else if (hasCompleted) {

        title =
            "Your exam is complete";

        message =
            "See which specialization fits you best, then confirm " +
            "your choice.";



    }
    else {

        title =
            "Next step: take the exam";

        message =
            "Answer the short interest check and the Comprehensive " +
            "IT Examination to get your recommendation. " +
            "The exam can only be taken once.";


    }


    /* ---------- exam score line (was the Final Result page) ---------- */

    let scoreLine = "";

    if (
        result &&
        Number(result.totalItems) > 0
    ) {

        const score =
            Number(result.score) || 0;

        const total =
            Number(result.totalItems);

        const percent =
            ((score / total) * 100).toFixed(1);

        scoreLine = `

            <p style="margin:0 0 16px;color:#334c55;font-size:14px;">

                Exam score:

                <strong style="color:#244b5a;">
                    ${score} / ${total}
                    (${percent}%)
                </strong>

                ${
                    result.date
                    ? `<span style="color:#829197;">
                        &nbsp;•&nbsp; Submitted
                        ${escapeHTML(result.date)}
                       </span>`
                    : ""
                }

            </p>

        `;

    }


    box.innerHTML = `

        <div style="background:#fff;border:1px solid #e1eaed;
            border-top:4px solid #8ec6d1;border-radius:14px;
            padding:22px;margin-bottom:24px;">

            <h3 style="margin:0 0 6px;color:#244b5a;">
                My Progress
            </h3>

            <p style="margin:0 0 16px;color:#667981;
                line-height:1.5;">

                <strong style="color:#244b5a;">
                    ${escapeHTML(title)}
                </strong>

                <br>

                ${escapeHTML(message)}

            </p>

            ${scoreLine}

            <div style="display:flex;flex-wrap:wrap;gap:12px;
                padding:14px;background:#f8fbfc;
                border:1px solid #e1eaed;border-radius:12px;
                margin-bottom:${buttonLabel ? "16px" : "0"};">

                ${step(1, "Take the exam", step1)}
                ${step(2, "View your recommendation", step2)}
                ${step(3, "Choose your specialization", step3)}

            </div>

            ${
                buttonLabel
                ? `<button type="button"
                    onclick="goPage('${buttonPage}')"
                    style="border:0;border-radius:10px;
                    padding:12px 22px;background:#244b5a;
                    color:#fff;font-weight:700;font-size:14px;
                    cursor:pointer;">
                    ${escapeHTML(buttonLabel)}
                   </button>`
                : ""
            }

        </div>

    `;

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
