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
    getDoc,
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert } from "./ui-dialog.js";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;
let allLogs = [];
let academicYears = [];

// For the daily reset of the totals
let totalUsersCount = 0;
let statsDayKey = "";
let rolloverWatcherStarted = false;


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.replace("../login.html");

        return;

    }

    currentUser = user;

    /* Make sure the logout modal is hidden on first load. */

    hideLogoutModal();

    await loadAdminName();

    await loadAcademicYears();

    await loadMonitoring();

    startDayRolloverWatcher();

});


/* =========================================================
   ADMIN NAME
========================================================= */

async function loadAdminName() {

    const adminName =
        document.getElementById("admin-name");

    if (!adminName) return;

    try {

        const snapshot =
            await getDoc(
                doc(
                    db,
                    "users",
                    currentUser.uid
                )
            );

        const data =
            snapshot.exists()
                ? snapshot.data()
                : {};

        adminName.textContent =
            data.fullname ||
            data.name ||
            "ADMIN";

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
   SIDEBAR + NAVIGATION
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    if (!sidebar) return;

    sidebar.classList.toggle("active");

}


function goPage(page) {

    document.body.style.opacity = "0";

    setTimeout(() => {

        window.location.href = page;

    }, 150);

}


/* =========================================================
   LOGOUT MODAL (unchanged behavior)
========================================================= */

function hideLogoutModal() {

    const overlay =
        document.getElementById("logout-overlay");

    if (!overlay) return;

    overlay.classList.remove("active");

    overlay.style.display = "none";

    document.body.style.overflow = "";

}


function logout() {

    const overlay =
        document.getElementById("logout-overlay");

    if (!overlay) {

        console.error("Logout modal not found.");

        return;

    }

    overlay.classList.add("active");

    overlay.style.display = "flex";

    document.body.style.overflow = "hidden";

}


function closeLogoutModal() {

    hideLogoutModal();

}


function closeLogoutOutside(event) {

    if (
        event &&
        event.target &&
        event.target.id === "logout-overlay"
    ) {

        closeLogoutModal();

    }

}


async function confirmLogout() {

    const confirmButton =
        document.querySelector(".logout-confirm-btn");

    if (confirmButton) {

        confirmButton.disabled = true;

        confirmButton.textContent = "Logging out...";

    }

    try {

        await signOut(auth);

        localStorage.clear();

        window.location.replace("../login.html");

    }

    catch (error) {

        console.error("Logout error:", error);

        if (confirmButton) {

            confirmButton.disabled = false;

            confirmButton.textContent = "Log Out";

        }

        await appAlert(
            "Unable to log out. Please try again.",
            { type: "error" }
        );

    }

}


/* =========================================================
   DATE HELPERS
========================================================= */

function getTimestampDate(timestamp) {

    if (!timestamp) return null;

    const date =
        typeof timestamp.toDate === "function"
            ? timestamp.toDate()
            : new Date(timestamp);

    return isNaN(date.getTime())
        ? null
        : date;

}


function formatDate(timestamp) {

    const date = getTimestampDate(timestamp);

    if (!date) return "N/A";

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


function formatTime(timestamp) {

    const date = getTimestampDate(timestamp);

    if (!date) return "N/A";

    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );

}


/* One key per calendar day, e.g. "2026-10-13" (local time). */

function getDayKey(date = new Date()) {

    const month =
        String(date.getMonth() + 1).padStart(2, "0");

    const day =
        String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable(logs) {

    const table =
        document.getElementById("activityTable");

    if (!table) return;

    table.innerHTML = "";

    if (!logs || logs.length === 0) {

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

        const hasDate =
            !!getTimestampDate(log.timestamp);

        const date =
            hasDate
                ? formatDate(log.timestamp)
                : "N/A";

        const time =
            hasDate
                ? formatTime(log.timestamp)
                : "N/A";

        const user =
            log.resolvedFullname ||
            log.fullname ||
            log.userName ||
            log.name ||
            log.user ||
            log.email ||
            "N/A";

        const role =
            log.role || "N/A";

        /* Same wording as the System Activity Report (log.action). */

        const activity =
            log.action ||
            log.activity ||
            log.description ||
            "N/A";

        const status =
            log.status || "Success";

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>
                ${escapeHtml(date)}
                <br>
                <small>${escapeHtml(time)}</small>
            </td>
            <td>${escapeHtml(user)}</td>
            <td>${escapeHtml(role)}</td>
            <td>${escapeHtml(activity)}</td>
            <td>${escapeHtml(status)}</td>
        `;

        table.appendChild(row);

    });

}


/* =========================================================
   LOAD ACADEMIC YEARS
========================================================= */

async function loadAcademicYears() {

    const select =
        document.getElementById("filterYear");

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

            const data = docSnap.data();

            const year =
                data.academicYear ||
                data.year ||
                docSnap.id;

            if (year) {

                academicYears.push(String(year));

            }

        });

        academicYears =
            [...new Set(academicYears)].sort();

        select.innerHTML = `
            <option value="">
                All Academic Years
            </option>
        `;

        academicYears.forEach((year) => {

            const option =
                document.createElement("option");

            option.value = year;

            option.textContent = year;

            select.appendChild(option);

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
   RESOLVE A LOG'S USER TO A FULL NAME
========================================================= */

function resolveFullname(log, usersByIdentifier) {

    /* log.user can already be a full name, or an email / ID. */

    if (
        log.user &&
        String(log.user).trim() !== ""
    ) {

        const loggedUser =
            String(log.user).trim();

        if (
            loggedUser.includes(" ") &&
            !loggedUser.includes("@")
        ) {

            return loggedUser;

        }

        const found =
            usersByIdentifier.get(
                loggedUser.toLowerCase()
            );

        if (found) return found;

    }

    /* Try the other identifiers a log may carry. */

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

    for (const identifier of identifiers) {

        if (
            identifier === undefined ||
            identifier === null
        ) {

            continue;

        }

        const key =
            String(identifier)
                .trim()
                .toLowerCase();

        if (!key) continue;

        const found =
            usersByIdentifier.get(key);

        if (found) return found;

    }

    return "";

}


/* =========================================================
   LOAD MONITORING
========================================================= */

async function loadMonitoring() {

    const table =
        document.getElementById("activityTable");

    if (table) {

        table.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">
                    Loading activity logs...
                </td>
            </tr>
        `;

    }

    try {

        /* All logs, newest first (no limit). */

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

        const [
            logsSnapshot,
            usersSnapshot
        ] = await Promise.all([

            getDocs(logsQuery),

            getDocs(
                collection(
                    db,
                    "users"
                )
            )

        ]);

        /* Lookup: any identifier -> full name */

        const usersByIdentifier =
            new Map();

        usersSnapshot.forEach((docSnap) => {

            const user = docSnap.data();

            const fullname =
                user.fullname ||
                user.name ||
                "";

            if (!fullname) return;

            [
                docSnap.id,
                user.uid,
                user.userId,
                user.email,
                user.studentNumber,
                user.facultyId,
                user.idNumber,
                user.username
            ].forEach((identifier) => {

                if (
                    identifier === undefined ||
                    identifier === null
                ) {

                    return;

                }

                const key =
                    String(identifier)
                        .trim()
                        .toLowerCase();

                if (key) {

                    usersByIdentifier.set(
                        key,
                        fullname
                    );

                }

            });

        });

        allLogs = [];

        logsSnapshot.forEach((docSnap) => {

            const log = docSnap.data();

            allLogs.push({

                id: docSnap.id,

                ...log,

                resolvedFullname:
                    resolveFullname(
                        log,
                        usersByIdentifier
                    ) || "N/A"

            });

        });

        calculateMonitoringStats(
            allLogs,
            usersSnapshot.size
        );

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
                    <td colspan="5" class="no-data">
                        Unable to load monitoring data.
                    </td>
                </tr>
            `;

        }

    }

}


/* =========================================================
   MONITORING STATISTICS (DAILY TOTALS)

   Login, failed-login and cheating totals count ONLY
   today's activity, so they start from zero every new day.
   "Total users" is the number of accounts, so it is not
   reset. The table below still lists every log.
========================================================= */

function calculateMonitoringStats(
    logs,
    totalUsers
) {

    totalUsersCount = totalUsers;

    statsDayKey = getDayKey();

    let totalLogins = 0;

    let failedLogins = 0;

    let cheatingAlerts = 0;

    logs.forEach((log) => {

        const logDate =
            getTimestampDate(log.timestamp);

        /* Skip anything that did not happen today. */

        if (
            !logDate ||
            getDayKey(logDate) !== statsDayKey
        ) {

            return;

        }

        const activity =
            String(
                log.action ||
                log.activity ||
                log.description ||
                ""
            ).toLowerCase();

        const status =
            String(
                log.status || ""
            ).toLowerCase();

        if (activity.includes("login")) {

            if (
                activity.includes("failed") ||
                status.includes("failed")
            ) {

                failedLogins++;

            }

            else {

                totalLogins++;

            }

        }

        if (
            activity.includes("cheat") ||
            activity.includes("violation") ||
            activity.includes("warning")
        ) {

            cheatingAlerts++;

        }

    });

    setText("totalLogins", totalLogins);

    setText("failedLogins", failedLogins);

    setText("cheatingAlerts", cheatingAlerts);

    const usersElement =
        document.getElementById("totalUsers") ||
        document.getElementById("activeUsers");

    if (usersElement) {

        usersElement.textContent = totalUsers;

    }

    /* Optional: <span id="statsDate"></span> in the HTML */

    const dateLabel =
        document.getElementById("statsDate");

    if (dateLabel) {

        dateLabel.textContent =
            "Today, " +
            new Date().toLocaleDateString(
                "en-US",
                {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                }
            );

    }

}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent = value;

    }

}


/* =========================================================
   DAILY RESET WATCHER

   Checks every 30 seconds (and whenever the tab becomes
   visible again, e.g. after the computer wakes up) whether
   the date changed. If it did, the logs are reloaded and
   the totals restart from zero for the new day.
========================================================= */

function startDayRolloverWatcher() {

    if (rolloverWatcherStarted) return;

    rolloverWatcherStarted = true;

    const checkRollover = async () => {

        if (
            statsDayKey &&
            getDayKey() !== statsDayKey
        ) {

            await loadMonitoring();

        }

    };

    setInterval(checkRollover, 30000);

    document.addEventListener(
        "visibilitychange",
        () => {

            if (!document.hidden) {

                checkRollover();

            }

        }
    );

}


/* =========================================================
   APPLY FILTERS
========================================================= */

function applyFilters() {

    const selectedDate =
        document.getElementById("filterDate")?.value || "";

    const selectedYear =
        document.getElementById("filterYear")?.value || "";

    const selectedTime =
        document.getElementById("filterTime")?.value || "";

    /* 09:00 = 9:00 AM through 9:59 AM, and so on. */

    let selectedHour = null;

    if (selectedTime) {

        selectedHour =
            parseInt(
                selectedTime.split(":")[0],
                10
            );

        if (isNaN(selectedHour)) {

            selectedHour = null;

        }

    }

    const filteredLogs =
        allLogs.filter((log) => {

            const timestampDate =
                getTimestampDate(log.timestamp);

            if (!timestampDate) return false;

            if (
                selectedDate &&
                getDayKey(timestampDate) !== selectedDate
            ) {

                return false;

            }

            if (
                selectedYear &&
                String(log.academicYear || "").trim() !==
                String(selectedYear).trim()
            ) {

                return false;

            }

            if (
                selectedHour !== null &&
                timestampDate.getHours() !== selectedHour
            ) {

                return false;

            }

            return true;

        });

    renderTable(filteredLogs);

}


/* =========================================================
   CLEAR FILTERS
========================================================= */

function clearFilters() {

    ["filterDate", "filterYear", "filterTime"]
        .forEach((id) => {

            const element =
                document.getElementById(id);

            if (element) {

                element.value = "";

            }

        });

    renderTable(allLogs);

}


/* =========================================================
   FILTER EVENT LISTENERS
========================================================= */

function setupFilterListeners() {

    ["filterDate", "filterYear", "filterTime"]
        .forEach((id) => {

            document
                .getElementById(id)
                ?.addEventListener(
                    "change",
                    applyFilters
                );

        });

}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

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
