/* =========================================================
   ADMIN MONITORING
   SpecAdvisor
========================================================= */

import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;
let allLogs = [];
let academicYears = [];


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.replace("../login.html");

        return;

    }

    currentUser = user;

    console.log(
        "Monitoring Auth:",
        user.email
    );


    /* Make sure logout modal is hidden
       when the page first loads. */

    hideLogoutModal();


    await loadAdminName();

    await loadAcademicYears();

    await loadMonitoring();

});


/* =========================================================
   ADMIN NAME
========================================================= */

async function loadAdminName() {

    const adminName =
        document.getElementById(
            "admin-name"
        );

    if (!adminName) return;


    try {

        const usersSnapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        let fullname = "ADMIN";


        usersSnapshot.forEach((docSnap) => {

            const data =
                docSnap.data();


            if (
                docSnap.id === currentUser.uid
            ) {

                fullname =
                    data.fullname ||
                    data.name ||
                    "ADMIN";

            }

        });


        adminName.textContent =
            fullname;

    }

    catch (error) {

        console.error(
            "Unable to load admin name:",
            error
        );

        adminName.textContent =
            "ADMIN";

    }

}


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    if (!sidebar) return;

    sidebar.classList.toggle(
        "active"
    );

}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

function goPage(page) {

    document.body.style.opacity =
        "0";


    setTimeout(() => {

        window.location.href =
            page;

    }, 150);

}


/* =========================================================
   LOGOUT MODAL
========================================================= */

function hideLogoutModal() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );

    if (!overlay) return;

    overlay.classList.remove(
        "active"
    );

    overlay.style.display =
        "none";

    document.body.style.overflow =
        "";

}


function logout() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );


    if (!overlay) {

        console.error(
            "Logout modal not found."
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


/* =========================================================
   CLOSE LOGOUT MODAL
========================================================= */

function closeLogoutModal() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );

    if (!overlay) return;


    overlay.classList.remove(
        "active"
    );

    overlay.style.display =
        "none";

    document.body.style.overflow =
        "";

}


/* =========================================================
   CLOSE LOGOUT MODAL OUTSIDE
========================================================= */

function closeLogoutOutside(event) {

    if (
        event &&
        event.target &&
        event.target.id ===
            "logout-overlay"
    ) {

        closeLogoutModal();

    }

}


/* =========================================================
   CONFIRM LOGOUT
========================================================= */

async function confirmLogout() {

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
            "Logout error:",
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


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(timestamp) {

    if (!timestamp) {

        return "N/A";

    }


    let date;


    if (
        timestamp &&
        typeof timestamp.toDate ===
            "function"
    ) {

        date =
            timestamp.toDate();

    }

    else {

        date =
            new Date(timestamp);

    }


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "N/A";

    }


    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(timestamp) {

    if (!timestamp) {

        return "N/A";

    }


    let date;


    if (
        timestamp &&
        typeof timestamp.toDate ===
            "function"
    ) {

        date =
            timestamp.toDate();

    }

    else {

        date =
            new Date(timestamp);

    }


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "N/A";

    }


    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );

}


/* =========================================================
   GET DATE OBJECT
========================================================= */

function getTimestampDate(timestamp) {

    if (!timestamp) {

        return null;

    }


    let date;


    if (
        timestamp &&
        typeof timestamp.toDate ===
            "function"
    ) {

        date =
            timestamp.toDate();

    }

    else {

        date =
            new Date(timestamp);

    }


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable(logs) {

    const table =
        document.getElementById(
            "activityTable"
        );

    if (!table) return;


    table.innerHTML = "";


    if (
        !logs ||
        logs.length === 0
    ) {

        table.innerHTML = `
            <tr class="no-data">
                <td colspan="5">
                    No activity logs found.
                </td>
            </tr>
        `;

        return;

    }


    logs.forEach((log) => {

        const timestampDate =
            getTimestampDate(
                log.timestamp
            );


        const date =
            timestampDate
                ? formatDate(
                    log.timestamp
                )
                : "N/A";


        const time =
            timestampDate
                ? formatTime(
                    log.timestamp
                )
                : "N/A";


        /* =================================================
           USER
        ================================================= */

        const user =
            log.resolvedFullname ||
            log.fullname ||
            log.userName ||
            log.name ||
            log.user ||
            log.email ||
            "N/A";


        /* =================================================
           ROLE
        ================================================= */

        const role =
            log.role ||
            "N/A";


        /* =================================================
           ACTION

           IMPORTANT:
           SYSTEM ACTIVITY REPORT uses log.action.

           We now prioritize ACTION first so Monitoring
           shows the exact same activity descriptions.

           Example:
           - Exam Finished
           - Exam Completed
           - Cheating Detected
           - Browser Violation
           - Login Attempt
           ================================================= */

        const activity =
            log.action ||
            log.activity ||
            log.description ||
            "N/A";


        /* =================================================
           STATUS
        ================================================= */

        const status =
            log.status ||
            "Success";


        const row =
            document.createElement(
                "tr"
            );


        row.innerHTML = `

            <td>
                ${escapeHtml(date)}
                <br>
                <small>
                    ${escapeHtml(time)}
                </small>
            </td>

            <td>
                ${escapeHtml(user)}
            </td>

            <td>
                ${escapeHtml(role)}
            </td>

            <td>
                ${escapeHtml(activity)}
            </td>

            <td>
                ${escapeHtml(status)}
            </td>

        `;


        table.appendChild(
            row
        );

    });

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


/* =========================================================
   LOAD ACADEMIC YEARS
========================================================= */

async function loadAcademicYears() {

    const select =
        document.getElementById(
            "filterYear"
        );

    if (!select) return;


    try {

        const snapshot =
            await getDocs(
                collection(
                    db,
                    "academicYears"
                )
            );


        academicYears = [];


        snapshot.forEach((docSnap) => {

            const data =
                docSnap.data();


            const year =
                data.academicYear ||
                data.year ||
                docSnap.id;


            if (year) {

                academicYears.push(
                    String(year)
                );

            }

        });


        academicYears =
            [
                ...new Set(
                    academicYears
                )
            ];


        academicYears.sort();


        select.innerHTML = `

            <option value="">
                All Academic Years
            </option>

        `;


        academicYears.forEach((year) => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                year;


            option.textContent =
                year;


            select.appendChild(
                option
            );

        });

    }

    catch (error) {

        console.error(
            "Unable to load academic years:",
            error
        );

    }

}


/* =========================================================
   LOAD MONITORING
========================================================= */

async function loadMonitoring() {

    const table =
        document.getElementById(
            "activityTable"
        );


    if (table) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="no-data"
                >
                    Loading activity logs...
                </td>

            </tr>

        `;

    }


    try {

        /* =================================================
           LOAD ALL ACTIVITY LOGS

           IMPORTANT:
           There is NO limit(100) anymore.

           This allows Monitoring Activities to show
           older activity records too, just like the
           System Activity Report.
        ================================================= */

        const logsQuery =
            query(
                collection(
                    db,
                    "activityLogs"
                ),
                orderBy(
                    "timestamp",
                    "desc"
                )
            );


        /* =================================================
           LOAD LOGS + USERS
        ================================================= */

        const [
            logsSnapshot,
            usersSnapshot
        ] =
            await Promise.all([

                getDocs(
                    logsQuery
                ),

                getDocs(
                    collection(
                        db,
                        "users"
                    )
                )

            ]);


        /* =================================================
           CREATE USER LOOKUP
        ================================================= */

        const usersByIdentifier =
            new Map();


        usersSnapshot.forEach(
            (docSnap) => {

                const user =
                    docSnap.data();


                const fullname =
                    user.fullname ||
                    user.name ||
                    "";


                if (!fullname) {

                    return;

                }


                /* FIRESTORE DOCUMENT ID */

                usersByIdentifier.set(

                    String(
                        docSnap.id
                    )
                        .trim()
                        .toLowerCase(),

                    fullname

                );


                /* OTHER IDENTIFIERS */

                const identifiers = [

                    user.uid,

                    user.userId,

                    user.email,

                    user.studentNumber,

                    user.facultyId,

                    user.idNumber,

                    user.username

                ];


                identifiers.forEach(
                    (identifier) => {

                        if (
                            identifier ===
                                undefined ||
                            identifier ===
                                null
                        ) {

                            return;

                        }


                        const key =
                            String(
                                identifier
                            )
                                .trim()
                                .toLowerCase();


                        if (!key) {

                            return;

                        }


                        usersByIdentifier.set(

                            key,

                            fullname

                        );

                    }
                );

            }
        );


        /* =================================================
           RESOLVE FULLNAME FOR EACH LOG
        ================================================= */

        allLogs = [];


        logsSnapshot.forEach(
            (docSnap) => {

                const log =
                    docSnap.data();


                let resolvedFullname =
                    "";


                /* =================================================
                   CHECK log.user FIRST
                ================================================= */

                if (
                    log.user &&
                    String(
                        log.user
                    ).trim() !== ""
                ) {

                    const loggedUser =
                        String(
                            log.user
                        ).trim();


                    /* Already a fullname */

                    if (
                        loggedUser.includes(
                            " "
                        ) &&
                        !loggedUser.includes(
                            "@"
                        )
                    ) {

                        resolvedFullname =
                            loggedUser;

                    }

                    else {

                        const key =
                            loggedUser
                                .toLowerCase();


                        resolvedFullname =
                            usersByIdentifier.get(
                                key
                            ) || "";

                    }

                }


                /* =================================================
                   TRY OTHER IDENTIFIERS
                ================================================= */

                if (
                    !resolvedFullname
                ) {

                    const identifiers = [

                        log.uid,

                        log.userUid,

                        log.userId,

                        log.email,

                        log.studentNumber,

                        log.facultyId,

                        log.idNumber,

                        log.username

                    ];


                    for (
                        const identifier
                        of identifiers
                    ) {

                        if (
                            identifier ===
                                undefined ||
                            identifier ===
                                null
                        ) {

                            continue;

                        }


                        const key =
                            String(
                                identifier
                            )
                                .trim()
                                .toLowerCase();


                        if (!key) {

                            continue;

                        }


                        const foundName =
                            usersByIdentifier.get(
                                key
                            );


                        if (
                            foundName
                        ) {

                            resolvedFullname =
                                foundName;

                            break;

                        }

                    }

                }


                /* =================================================
                   SAVE RESOLVED NAME
                ================================================= */

                allLogs.push({

                    id:
                        docSnap.id,

                    ...log,

                    resolvedFullname:
                        resolvedFullname ||
                        "N/A"

                });

            }
        );


        /* =================================================
           UPDATE STATISTICS
        ================================================= */

        calculateMonitoringStats(
    allLogs,
    usersSnapshot.size
);


        /* =================================================
           APPLY FILTERS
        ================================================= */

        applyFilters();

    }

    catch (error) {

        console.error(
            "Loading monitoring failed:",
            error
        );


        if (table) {

            table.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="no-data"
                    >
                        Unable to load monitoring data.
                    </td>

                </tr>

            `;

        }

    }

}


/* =========================================================
   MONITORING STATISTICS
========================================================= */

function calculateMonitoringStats(
    logs,
    totalUsers
) {

    let totalLogins = 0;

    let failedLogins = 0;

    let cheatingAlerts = 0;


    logs.forEach((log) => {

        /*
         * IMPORTANT:
         * Use ACTION first because this is what
         * System Activity Report uses.
         */

        const activity =
            String(
                log.action ||
                log.activity ||
                log.description ||
                ""
            ).toLowerCase();


        const status =
            String(
                log.status ||
                ""
            ).toLowerCase();


        /* =================================================
           LOGIN STATISTICS
        ================================================= */

        if (
            activity.includes(
                "login"
            )
        ) {

            if (
                activity.includes(
                    "failed"
                ) ||
                status.includes(
                    "failed"
                )
            ) {

                failedLogins++;

            }

            else {

                totalLogins++;

            }

        }


        /* =================================================
           CHEATING / VIOLATION STATISTICS
        ================================================= */

        if (
            activity.includes(
                "cheat"
            ) ||
            activity.includes(
                "violation"
            ) ||
            activity.includes(
                "warning"
            )
        ) {

            cheatingAlerts++;

        }

    });


    const totalLoginsElement =
        document.getElementById(
            "totalLogins"
        );


    const failedLoginsElement =
        document.getElementById(
            "failedLogins"
        );


    const cheatingAlertsElement =
        document.getElementById(
            "cheatingAlerts"
        );


    if (
        totalLoginsElement
    ) {

        totalLoginsElement.textContent =
            totalLogins;

    }


    if (
        failedLoginsElement
    ) {

        failedLoginsElement.textContent =
            failedLogins;

    }


    if (
        cheatingAlertsElement
    ) {

        cheatingAlertsElement.textContent =
            cheatingAlerts;

    }


    const totalUsersElement =
    document.getElementById("totalUsers") ||
    document.getElementById("activeUsers");

if (totalUsersElement) {
    totalUsersElement.textContent =
        totalUsers;
}

}


/* =========================================================
   APPLY FILTERS
========================================================= */

function applyFilters() {

    const selectedDate =
        document.getElementById(
            "filterDate"
        )?.value || "";


    const selectedYear =
        document.getElementById(
            "filterYear"
        )?.value || "";


    const selectedTime =
        document.getElementById(
            "filterTime"
        )?.value || "";


    let filteredLogs =
        [
            ...allLogs
        ];


    /* =================================================
       TIME FILTER
       
       09:00 = 9:00 AM through 9:59 AM
       10:00 = 10:00 AM through 10:59 AM
       12:00 = 12:00 PM through 12:59 PM
       13:00 = 1:00 PM through 1:59 PM
       18:00 = 6:00 PM through 6:59 PM
       21:00 = 9:00 PM through 9:59 PM
    ================================================= */

    let selectedHour =
        null;


    if (
        selectedTime
    ) {

        const timeParts =
            selectedTime.split(":");


        selectedHour =
            parseInt(
                timeParts[0],
                10
            );


        if (
            isNaN(
                selectedHour
            )
        ) {

            selectedHour =
                null;

        }

    }


    filteredLogs =
        filteredLogs.filter(
            (log) => {

                const timestampDate =
                    getTimestampDate(
                        log.timestamp
                    );


                if (
                    !timestampDate
                ) {

                    return false;

                }


                /* =================================================
                   DATE FILTER
                ================================================= */

                if (
                    selectedDate
                ) {

                    const year =
                        timestampDate.getFullYear();


                    const month =
                        String(
                            timestampDate.getMonth() + 1
                        ).padStart(
                            2,
                            "0"
                        );


                    const day =
                        String(
                            timestampDate.getDate()
                        ).padStart(
                            2,
                            "0"
                        );


                    const logDate =
                        `${year}-${month}-${day}`;


                    if (
                        logDate !==
                        selectedDate
                    ) {

                        return false;

                    }

                }


                /* =================================================
                   ACADEMIC YEAR FILTER
                ================================================= */

                if (
                    selectedYear
                ) {

                    const logYear =
                        String(
                            log.academicYear ||
                            ""
                        ).trim();


                    if (
                        logYear !==
                        String(
                            selectedYear
                        ).trim()
                    ) {

                        return false;

                    }

                }


                /* =================================================
                   TIME FILTER
                ================================================= */

                if (
                    selectedHour !==
                    null
                ) {

                    const logHour =
                        timestampDate.getHours();


                    if (
                        logHour !==
                        selectedHour
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    renderTable(
        filteredLogs
    );

}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearFilters() {

    const dateFilter =
        document.getElementById(
            "filterDate"
        );


    const yearFilter =
        document.getElementById(
            "filterYear"
        );


    const timeFilter =
        document.getElementById(
            "filterTime"
        );


    if (
        dateFilter
    ) {

        dateFilter.value =
            "";

    }


    if (
        yearFilter
    ) {

        yearFilter.value =
            "";

    }


    if (
        timeFilter
    ) {

        timeFilter.value =
            "";

    }


    renderTable(
        allLogs
    );

}


/* =========================================================
   FILTER EVENT LISTENERS
========================================================= */

function setupFilterListeners() {

    const dateFilter =
        document.getElementById(
            "filterDate"
        );


    const yearFilter =
        document.getElementById(
            "filterYear"
        );


    const timeFilter =
        document.getElementById(
            "filterTime"
        );


    if (
        dateFilter
    ) {

        dateFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (
        yearFilter
    ) {

        yearFilter.addEventListener(
            "change",
            applyFilters
        );

    }


    if (
        timeFilter
    ) {

        timeFilter.addEventListener(
            "change",
            applyFilters
        );

    }

}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /* Hide logout modal immediately */

        hideLogoutModal();

        setupFilterListeners();

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

window.confirmLogout =
    confirmLogout;

window.loadMonitoring =
    loadMonitoring;

window.applyFilters =
    applyFilters;

window.clearFilters =
    clearFilters;