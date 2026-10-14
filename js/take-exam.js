import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
<<<<<<< HEAD
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    doc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert, appConfirm } from "./ui-dialog.js";

import {
    INTEREST_QUESTIONS,
    scoreInterestAnswers
} from "./interest-config.js";

=======
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
/* =========================================================
   CONFIGURATION
========================================================= */

const MAX_QUESTIONS = 100;
const QUESTION_TIME_SECONDS = 30;

// One combined exam for every specialization
const EXAM_TITLE = "Comprehensive IT Examination";
const EXAM_SPECIALIZATION = "All Specializations";

// Violations 1 and 2 are warnings. The 3rd violation terminates the exam.
const MAX_VIOLATIONS = 3;

// One action (e.g. a tab switch) can fire several events at once
// (visibilitychange + blur). Ignore repeats inside this window.
const VIOLATION_COOLDOWN_MS = 2000;

let currentUser = null;
let currentQuestions = [];
let activeAcademicYear = "";

let currentQuestionIndex = 0;
let studentAnswers = {};

let examTimerInterval = null;
let questionTimeRemaining = QUESTION_TIME_SECONDS;
let timerQuestionIndex = -1;

// Interest check (answered once before the exam, saved with the result)
let interestDraft = [];
let interestAnswers = null;

let isSubmittingExam = false;
let isTerminating = false;
let examInProgress = false;

let violationCount = 0;
let violationLog = [];
let lastViolationAt = 0;
let warningOpen = false;
let securityListenersInitialized = false;

<<<<<<< HEAD
// Exam schedule (loaded when the page opens)
let scheduleSlots = [];        // [{ startMs, endMs }] of administered exams
let scheduleLoaded = false;
let initialExamContainerHTML = "";
let waitingShown = false;
let availabilityTimer = null;

function progressFlagKey() {
    return `examInProgress:${currentUser?.uid || ""}`;
}

/*
 * A COMPLETED result is always saved under this fixed ID
 * (student + academic year). Firestore rules only accept a
 * completed result with exactly this ID, and students cannot
 * overwrite an existing document, so a second completed result
 * for the same academic year is rejected by the server.
 * (A "/" is not allowed in a document ID, so it becomes "-".
 * The Firestore rules use the same replacement.)
 */
function completedResultId() {
    return (
        currentUser.uid + "_" +
        String(activeAcademicYear).replace(/\//g, "-")
    );
}

=======
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
/* =========================================================
   AUTHENTICATION
========================================================= */

<<<<<<< HEAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("../login.html");
        return;
    }

    currentUser = user;

    try {
        // Deactivated (e.g. terminated for cheating) accounts cannot stay in.
        const userSnap = await getDoc(doc(db, "users", user.uid));

        if (userSnap.exists() && userSnap.data().active !== true) {
            await signOut(auth);
            window.location.replace("../login.html");
            return;
        }

        // Refreshing / leaving the page during an exam = cheating.
        if (localStorage.getItem(progressFlagKey())) {
            examInProgress = true; // lets terminateExam run its full flow
            await terminateExam(
                "Left or refreshed the examination page during the exam"
            );
            return;
        }

        await loadActiveAcademicYear();

        // Already completed the exam this academic year? No retake.
        if (activeAcademicYear && await alreadyFinishedExam()) {
            showAlreadyTaken();
            return;
        }

        initialExamContainerHTML =
            document.getElementById("examContainer")?.innerHTML || "";

        if (activeAcademicYear) {
            await loadExamSchedule();
            applyAvailability();
        } else {
            prepareSelectorUI();
        }
    } catch (error) {
        console.error("Take Exam initialization error:", error);
        showMessage(
            "Unable to initialize the examination. Please refresh the page."
        );
    }
});


/* No specialization selection is needed for the combined exam. */
function prepareSelectorUI() {
    const selector = document.getElementById("examSelector");

    if (selector) {
        selector.style.display = "";
    }
}
=======
const interestQuestions = [
  {
    question: "Which IT activity do you enjoy the most?",
    choices: [
      "Programming applications",
      "Designing websites",
      "Fixing computers",
      "Analyzing data",
    ],
  },

  {
    question: "What excites you the most in IT?",
    choices: [
      "Building systems",
      "Creating UI/UX designs",
      "Networking and hardware",
      "Cybersecurity",
    ],
  },

  {
    question: "Which school task do you prefer?",
    choices: [
      "Coding projects",
      "Design presentations",
      "Troubleshooting",
      "Research and analytics",
    ],
  },

  {
    question: "What would you rather do?",
    choices: [
      "Develop software",
      "Edit graphics/videos",
      "Configure networks",
      "Protect systems",
    ],
  },

  {
    question: "Which IT skill do you want to improve?",
    choices: ["Programming", "Web Design", "Hardware Servicing", "Security"],
  },
];

/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("../login.html");

    return;
  }

  currentUser = user;

  console.log("Take Exam Auth:", user.email);
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

  try {
    await loadActiveAcademicYear();
    await loadSpecializations();
  } catch (error) {
    console.error("Take Exam initialization error:", error);
  }
});

/* =========================================================
   SIDEBAR AND NAVIGATION
========================================================= */

function toggleSidebar() {
<<<<<<< HEAD
    document.getElementById("sidebar")?.classList.toggle("active");
}
window.toggleSidebar = toggleSidebar;

function goPage(url) {
    if (examInProgress) {
        showToast("Please finish your examination before leaving this page.");
        return;
    }

    document.body.style.opacity = "0";

    setTimeout(() => {
        window.location.href = url;
    }, 250);
}
=======
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

window.toggleSidebar = toggleSidebar;

/* =========================================================
   NAVIGATION
========================================================= */

function goPage(url) {
  document.body.style.opacity = "0";

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
window.goPage = goPage;

/* =========================================================
   SAFE HELPERS
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(message) {
    const container = document.getElementById("examContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="no-exam">
            <h2>Examination Notice</h2>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}

/* Loads the student's completed result (for the summary card). */
async function getCompletedResult() {
    if (!currentUser || !activeAcademicYear) return null;

    const q = query(
        collection(db, "results"),
        where("studentUid", "==", currentUser.uid),
        where("academicYear", "==", activeAcademicYear)
    );

    const snapshot = await getDocs(q);

    const found = snapshot.docs
        .map(documentSnapshot => documentSnapshot.data())
        .find(result => result.status === "Completed");

    return found || null;
}

/* Shown whenever the student has already finished the exam. */
async function showAlreadyTaken() {
    const container = document.getElementById("examContainer");
    const selector = document.getElementById("examSelector");

    // Hide the Start button panel so the exam cannot be started again.
    if (selector) selector.style.display = "none";

    if (!container) return;

    let result = null;

    try {
        result = await getCompletedResult();
    } catch (error) {
        console.warn("Unable to load the completed result:", error);
    }

    const detailTile = (label, value) => `
        <div style="flex:1 1 150px;background:#f4f9fa;border:1px solid #e1eaed;
            border-radius:12px;padding:14px 16px;text-align:left;">
            <div style="font-size:12px;color:#829197;margin-bottom:4px;">
                ${escapeHTML(label)}
            </div>
            <div style="font-size:15px;font-weight:700;color:#244b5a;">
                ${escapeHTML(value)}
            </div>
        </div>
    `;

    let tiles = detailTile("Examination", EXAM_TITLE) +
        detailTile("Academic Year", activeAcademicYear);

    if (result && Number(result.totalItems) > 0) {
        tiles += detailTile(
            "Your Score",
            `${Number(result.score) || 0} / ${Number(result.totalItems)}`
        );
    }

    if (result && result.date) {
        tiles += detailTile("Submitted", result.date);
    }

    const step = (number, label, state) => {
        const done = state === "done";
        const current = state === "current";

        return `
            <div style="display:flex;align-items:center;gap:10px;
                flex:1 1 170px;justify-content:center;">
                <span style="width:30px;height:30px;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;
                    font-size:14px;font-weight:700;flex-shrink:0;
                    background:${done ? "#2e8b57" : current ? "#244b5a" : "#e8eff1"};
                    color:${done || current ? "#fff" : "#829197"};">
                    ${done ? "✓" : number}
                </span>
                <span style="font-size:13px;line-height:1.3;text-align:left;
                    font-weight:${current ? "700" : "500"};
                    color:${done || current ? "#244b5a" : "#829197"};">
                    ${escapeHTML(label)}
                </span>
            </div>
        `;
    };

    container.innerHTML = `
        <div style="background:#fff;border:1px solid #e1eaed;
            border-top:5px solid #2e8b57;border-radius:16px;
            padding:36px 28px;text-align:center;
            box-shadow:0 8px 24px rgba(36,75,90,.06);">

            <div style="width:76px;height:76px;margin:0 auto 18px;
                border-radius:50%;background:#e6f4ec;
                display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none"
                    stroke="#2e8b57" stroke-width="2.5"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5"></path>
                </svg>
            </div>

            <h2 style="margin:0 0 8px;color:#244b5a;font-size:24px;">
                You're Done With the Exam!
            </h2>

            <p style="margin:0 auto 24px;max-width:520px;color:#667981;
                line-height:1.6;">
                You have already completed the examination for this
                academic year. The exam can only be taken once, so it
                is now closed for you.
            </p>

            <div style="display:flex;flex-wrap:wrap;gap:12px;
                margin-bottom:26px;">
                ${tiles}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;
                padding:16px;margin-bottom:28px;background:#f8fbfc;
                border:1px solid #e1eaed;border-radius:12px;">
                ${step(1, "Take the exam", "done")}
                ${step(2, "View your recommendation", "current")}
                ${step(3, "Choose your specialization", "todo")}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:12px;
                justify-content:center;">
                <button type="button"
                    onclick="goPage('../student/recommendation.html')"
                    style="border:0;border-radius:10px;padding:14px 26px;
                    background:#244b5a;color:#fff;font-weight:700;
                    font-size:15px;cursor:pointer;">
                    View My Recommendation
                </button>

                <button type="button"
                    onclick="goPage('../student/dashboard.html')"
                    style="border:1px solid #cfdde1;border-radius:10px;
                    padding:14px 26px;background:#fff;color:#334c55;
                    font-weight:700;font-size:15px;cursor:pointer;">
                    Back to Dashboard
                </button>
            </div>
        </div>
    `;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }

    return array;
}

function normalizeChoices(data) {
<<<<<<< HEAD
    if (Array.isArray(data.choices)) {
        return [
            data.choices[0] || "",
            data.choices[1] || "",
            data.choices[2] || "",
            data.choices[3] || ""
        ].map(String);
    }

    if (data.choices && typeof data.choices === "object") {
        return [
            data.choices.A || "",
            data.choices.B || "",
            data.choices.C || "",
            data.choices.D || ""
        ].map(String);
    }

    return [
        data.choiceA || "",
        data.choiceB || "",
        data.choiceC || "",
        data.choiceD || ""
    ].map(String);
}

function resolveCorrectLetter(data, choices) {
    const raw = String(data.correctAnswer || "").trim();
    const upper = raw.toUpperCase();
    const letters = ["A", "B", "C", "D"];

    if (letters.includes(upper)) return upper;

    const matchIndex = choices.findIndex(choice =>
        choice.trim().toLowerCase() === raw.toLowerCase()
    );

    return matchIndex >= 0 ? letters[matchIndex] : "";
}

/* Firestore Timestamp / Date / string -> milliseconds (0 if empty). */
function toMillis(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();

    const time = new Date(value).getTime();

    return Number.isNaN(time) ? 0 : time;
}

/* Non-blocking message (alert() would trigger a window blur). */
function showToast(message) {
    let toast = document.getElementById("examToast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "examToast";
        toast.style.cssText = `
            position:fixed;top:18px;left:50%;transform:translateX(-50%);
            background:#244b5a;color:#fff;padding:12px 20px;
            border-radius:10px;z-index:100000;font-weight:600;
            box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:90%;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = "block";

    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.display = "none";
    }, 2500);
}

=======
  if (Array.isArray(data.choices)) {
    return [
      data.choices[0] || "",
      data.choices[1] || "",
      data.choices[2] || "",
      data.choices[3] || "",
    ].map((choice) => String(choice));
  }

  if (data.choices && typeof data.choices === "object") {
    return [
      data.choices.A || "",
      data.choices.B || "",
      data.choices.C || "",
      data.choices.D || "",
    ].map((choice) => String(choice));
  }

  return [
    data.choiceA || "",
    data.choiceB || "",
    data.choiceC || "",
    data.choiceD || "",
  ].map((choice) => String(choice));
}

/*
 * Returns "A"-"D" for the correct answer. Also handles
 * older questions that stored the full answer text.
 */

function resolveCorrectLetter(data, choicesList) {
  const raw = String(data.correctAnswer || "").trim();
  const upper = raw.toUpperCase();

  if (["A", "B", "C", "D"].includes(upper)) {
    return upper;
  }

  const letters = ["A", "B", "C", "D"];

  for (let i = 0; i < choicesList.length; i++) {
    if (
      raw &&
      choicesList[i] &&
      choicesList[i].trim().toLowerCase() === raw.toLowerCase()
    ) {
      return letters[i];
    }
  }

  return "";
}

function getExamTitleFromData(data) {
  return String(data.examTitle || data.title || "").trim();
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
/* =========================================================
   LOAD ACTIVE ACADEMIC YEAR
========================================================= */

async function loadActiveAcademicYear() {
<<<<<<< HEAD
    const yearElement = document.getElementById("activeAcademicYear");

    try {
        const q = query(
            collection(db, "academicYears"),
            where("active", "==", true)
        );

        const snapshot = await getDocs(q);

        activeAcademicYear = "";

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            activeAcademicYear = String(data.year || data.name || "");
        }

        if (yearElement) {
            yearElement.textContent =
                activeAcademicYear || "No active academic year";
        }
    } catch (error) {
        console.error("Error loading academic year:", error);

        if (yearElement) yearElement.textContent = "Unable to load";

        throw error;
    }
=======
  const yearElement = document.getElementById("activeAcademicYear");

  try {
    const q = query(
      collection(db, "academicYears"),
      where("active", "==", true),
    );

    const snapshot = await getDocs(q);

    activeAcademicYear = "";

    if (!snapshot.empty) {
      const yearData = snapshot.docs[0].data();

      activeAcademicYear = yearData.year || yearData.name || "";
    }

    if (yearElement) {
      yearElement.textContent = activeAcademicYear || "No active academic year";
    }
  } catch (error) {
    console.error("Error loading academic year:", error);

    if (yearElement) {
      yearElement.textContent = "Unable to load";
    }
  }
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

/* =========================================================
   EXAM SCHEDULE (is an exam open right now?)
========================================================= */

<<<<<<< HEAD
/*
 * Reads the schedule the Admin set when administering the exam.
 * Only the dates are kept here; the questions themselves are
 * loaded when the student actually starts the exam.
 */
async function loadExamSchedule() {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, "questionBank"),
                where("academicYear", "==", activeAcademicYear)
            )
        );

        const slots = new Map();

        snapshot.forEach(documentSnapshot => {
            const data = documentSnapshot.data();

            if (data.status !== "administered") return;
            if (!String(data.question || "").trim()) return;

            const startMs = toMillis(data.scheduledStartAt);
            const endMs = toMillis(data.scheduledEndAt);

            slots.set(`${startMs}-${endMs}`, { startMs, endMs });
        });

        scheduleSlots = [...slots.values()];
        scheduleLoaded = true;
    } catch (error) {
        // If the schedule cannot be read, loadExam() still enforces it.
        console.warn("Unable to load the exam schedule:", error);
        scheduleLoaded = false;
    }
}

function getAvailability() {
    if (!scheduleLoaded) return { state: "open" };

    if (scheduleSlots.length === 0) return { state: "none" };

    const now = Date.now();

    const isOpen = scheduleSlots.some(slot =>
        (!slot.startMs || now >= slot.startMs) &&
        (!slot.endMs || now <= slot.endMs)
    );

    if (isOpen) return { state: "open" };

    const upcoming = scheduleSlots
        .filter(slot => slot.startMs && now < slot.startMs)
        .map(slot => slot.startMs);

    if (upcoming.length > 0) {
        return { state: "upcoming", opensAt: Math.min(...upcoming) };
    }

    return {
        state: "closed",
        closedAt: Math.max(...scheduleSlots.map(slot => slot.endMs || 0))
    };
}

function formatScheduleDate(ms) {
    return new Date(ms).toLocaleString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function applyAvailability() {
    clearTimeout(availabilityTimer);

    if (examInProgress) return;

    const availability = getAvailability();

    if (availability.state === "open") {
        restoreStartPanel();
        return;
    }

    showWaiting(availability);

    // Opens the exam automatically when the scheduled time arrives.
    if (availability.state === "upcoming") {
        const wait = availability.opensAt - Date.now() + 500;

        if (wait > 0 && wait < 2000000000) {
            availabilityTimer = setTimeout(applyAvailability, wait);
        }
    }
}

function restoreStartPanel() {
    const container = document.getElementById("examContainer");

    if (container && waitingShown) {
        container.innerHTML = initialExamContainerHTML;
    }

    waitingShown = false;

    prepareSelectorUI();
}

function showWaiting(availability) {
    const container = document.getElementById("examContainer");
    const selector = document.getElementById("examSelector");

    // The Start button is hidden while there is nothing to take.
    if (selector) selector.style.display = "none";

    if (!container) return;

    waitingShown = true;

    let title = "";
    let message = "";
    let tile = "";

    if (availability.state === "upcoming") {
        title = "Please wait for the scheduled exam";
        message =
            "There is no exam open right now. The next exam is " +
            "scheduled below, and this page will unlock when it opens.";
        tile = `
            <div style="display:inline-block;background:#f4f9fa;
                border:1px solid #e1eaed;border-radius:12px;
                padding:14px 20px;text-align:left;margin-bottom:24px;">
                <div style="font-size:12px;color:#829197;margin-bottom:4px;">
                    Exam opens
                </div>
                <div style="font-size:16px;font-weight:700;color:#244b5a;">
                    ${escapeHTML(formatScheduleDate(availability.opensAt))}
                </div>
            </div>
        `;
    }
    else if (availability.state === "closed") {
        title = "The exam period has ended";
        message =
            "The last scheduled exam is already closed. If you think " +
            "this is a mistake, please contact your Admin.";

        if (availability.closedAt) {
            tile = `
                <div style="display:inline-block;background:#f4f9fa;
                    border:1px solid #e1eaed;border-radius:12px;
                    padding:14px 20px;text-align:left;margin-bottom:24px;">
                    <div style="font-size:12px;color:#829197;margin-bottom:4px;">
                        Closed on
                    </div>
                    <div style="font-size:16px;font-weight:700;color:#244b5a;">
                        ${escapeHTML(formatScheduleDate(availability.closedAt))}
                    </div>
                </div>
            `;
        }
    }
    else {
        title = "No exam is scheduled yet";
        message =
            "The Administrator has not administered an exam yet. " +
            "Please check back later.";
    }

    container.innerHTML = `
        <div style="background:#fff;border:1px solid #e1eaed;
            border-top:5px solid #8ec6d1;border-radius:16px;
            padding:36px 28px;text-align:center;
            box-shadow:0 8px 24px rgba(36,75,90,.06);">

            <div style="width:76px;height:76px;margin:0 auto 18px;
                border-radius:50%;background:#eaf5f7;
                display:flex;align-items:center;justify-content:center;">
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none"
                    stroke="#244b5a" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="5" width="18" height="16" rx="2"></rect>
                    <path d="M3 10h18"></path>
                    <path d="M8 3v4"></path>
                    <path d="M16 3v4"></path>
                    <path d="M12 13v3l2 1"></path>
                </svg>
            </div>

            <h2 style="margin:0 0 8px;color:#244b5a;font-size:24px;">
                ${escapeHTML(title)}
            </h2>

            <p style="margin:0 auto 24px;max-width:520px;color:#667981;
                line-height:1.6;">
                ${escapeHTML(message)}
            </p>

            ${tile}

            <div style="display:flex;flex-wrap:wrap;gap:12px;
                justify-content:center;">
                <button type="button" id="recheckScheduleBtn"
                    onclick="recheckExamSchedule()"
                    style="border:0;border-radius:10px;padding:13px 24px;
                    background:#244b5a;color:#fff;font-weight:700;
                    font-size:14px;cursor:pointer;">
                    Check Again
                </button>

                <button type="button"
                    onclick="goPage('../student/dashboard.html')"
                    style="border:1px solid #cfdde1;border-radius:10px;
                    padding:13px 24px;background:#fff;color:#334c55;
                    font-weight:700;font-size:14px;cursor:pointer;">
                    Back to Dashboard
                </button>
            </div>
        </div>
    `;
}

async function recheckExamSchedule() {
    const button = document.getElementById("recheckScheduleBtn");

    if (button) {
        button.disabled = true;
        button.textContent = "Checking...";
    }

    await loadExamSchedule();

    const availability = getAvailability();

    if (availability.state !== "open") {
        showToast("The exam is still not open.");
    }

    applyAvailability();
}
window.recheckExamSchedule = recheckExamSchedule;

=======
async function loadSpecializations() {
  const dropdown = document.getElementById("specializationSelect");

  if (!dropdown) {
    return;
  }

  dropdown.innerHTML = `
        <option value="">
            Loading specializations...
        </option>
    `;

  if (!activeAcademicYear) {
    dropdown.innerHTML = `
            <option value="">
                No active academic year
            </option>
        `;

    return;
  }

  try {
    /*
     * Only questionBank records with
     * status = "administered" are visible to students.
     * Any number of exams can be administered at once.
     */

    const q = query(
      collection(db, "questionBank"),
      where("academicYear", "==", activeAcademicYear),
    );

    const snapshot = await getDocs(q);

    const specializations = new Set();

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      if (data.status === "administered" && data.specialization) {
        specializations.add(String(data.specialization).trim());
      }
    });

    dropdown.innerHTML = `
            <option value="">
                Select Specialization
            </option>
        `;

    Array.from(specializations)
      .sort()
      .forEach((specialization) => {
        const option = document.createElement("option");

        option.value = specialization;

        option.textContent = specialization;

        dropdown.appendChild(option);
      });

    if (specializations.size === 0) {
      dropdown.innerHTML = `
                <option value="">
                    No approved exam available
                </option>
            `;
    }
  } catch (error) {
    console.error("Error loading specializations:", error);

    dropdown.innerHTML = `
            <option value="">
                Unable to load specializations
            </option>
        `;
  }
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
/* =========================================================
   START EXAM
========================================================= */

async function startSelectedExam() {
<<<<<<< HEAD
    if (
        !currentUser ||
        examInProgress ||
        isSubmittingExam ||
        isTerminating
    ) return;

    if (!activeAcademicYear) {
        showMessage("There is no active academic year.");
        return;
    }

    // Step 1: short interest check (not locked, not timed)
    if (!interestAnswers) {

        try {
            if (await alreadyFinishedExam()) {
                showAlreadyTaken();
                return;
            }
        } catch (error) {
            console.error("Error checking previous result:", error);
            showMessage("Unable to check your previous attempts. Please try again.");
            return;
        }

        // Not scheduled right now? Tell the student to wait.
        const availability = getAvailability();

        if (availability.state !== "open") {
            showWaiting(availability);
            return;
        }

        renderInterestStep();
        return;
    }

    await proceedToExam();
}

async function proceedToExam() {
    if (
        !currentUser ||
        examInProgress ||
        isSubmittingExam ||
        isTerminating
    ) return;

    const agreed = await appConfirm(
        "• The exam runs in full-screen mode.\n" +
        "• Switching tabs/windows, exiting full-screen, copying, " +
        "screenshots, or DevTools count as violations.\n" +
        "• You get " + (MAX_VIOLATIONS - 1) + " warnings. The " +
        MAX_VIOLATIONS + "rd violation TERMINATES the exam and " +
        "DEACTIVATES your account. Only the Admin can reactivate it.\n" +
        "• Refreshing or leaving the page terminates the exam " +
        "immediately.\n" +
        "• Each question has " + QUESTION_TIME_SECONDS +
        " seconds and you cannot go back.\n" +
        "• The exam can only be taken ONCE.\n\n" +
        "You must agree below before the exam can begin.",
        {
            title: "Exam Rules",
            confirmText: "Start Exam",
            type: "warning",
            agreeText: "I have read and agree to follow these exam rules."
        }
    );

    if (!agreed) return;

    // Fullscreen must be requested directly from the click (user gesture).
    const root = document.documentElement;

    if (root.requestFullscreen) {
        try {
            await root.requestFullscreen();
        } catch (error) {
            await appAlert(
                "Full-screen mode is required to take the exam. " +
                "Please allow full-screen and try again.",
                { title: "Full-Screen Required", type: "warning" }
            );
            return;
        }
    }

    const startButton = document.getElementById("startExamBtn");

    if (startButton) {
        startButton.disabled = true;
        startButton.textContent = "Loading Exam...";
    }

    try {
        await loadExam();
    } finally {
        if (startButton && !examInProgress) {
            startButton.disabled = false;
            startButton.textContent = "Start Exam";
        }

        if (!examInProgress && document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
        }
    }
}
window.startSelectedExam = startSelectedExam;

=======
  if (isSubmittingExam) {
    return;
  }

  const dropdown = document.getElementById("specializationSelect");

  if (!dropdown) {
    return;
  }

  const specialization = dropdown.value;

  if (!specialization) {
    alert("Please select a specialization first.");

    return;
  }

  selectedSpecialization = specialization;

  await loadExam(specialization);
}

window.startSelectedExam = startSelectedExam;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

/* =========================================================
   INTEREST CHECK STEP
========================================================= */

<<<<<<< HEAD
function renderInterestStep() {
    const container = document.getElementById("examContainer");
    const selector = document.getElementById("examSelector");

    if (!container) return;

    if (selector) selector.style.display = "none";

    let html = `
        <section style="background:#fff;padding:20px;border-radius:12px;
            margin-bottom:18px;border:1px solid #e1eaed;
            border-top:4px solid #8ec6d1;">
            <h2 style="margin:0 0 7px;color:#244b5a;">Quick Interest Check</h2>
            <p style="margin:0;color:#667981;line-height:1.5;">
                Answer these ${INTEREST_QUESTIONS.length} questions honestly.
                There are no right or wrong answers. They help match you with
                a specialization when your exam results are close.
            </p>
        </section>
    `;

    INTEREST_QUESTIONS.forEach((item, qIndex) => {
        html += `
            <section style="background:#fff;padding:20px;
                border:1px solid #e1eaed;border-radius:12px;margin-bottom:14px;">
                <h3 style="margin:0 0 14px;color:#263f49;font-size:16px;">
                    ${qIndex + 1}. ${escapeHTML(item.question)}
                </h3>
                <div style="display:grid;gap:10px;">
        `;

        item.choices.forEach((choice, cIndex) => {
            const checked = interestDraft[qIndex] === cIndex;

            html += `
                <label style="display:flex;align-items:center;gap:12px;
                    padding:13px;border:1px solid ${checked ? "#8ec6d1" : "#dfe8eb"};
                    border-radius:10px;background:${checked ? "#edf8fa" : "#fff"};
                    cursor:pointer;">
                    <input type="radio" name="interest${qIndex}"
                        value="${cIndex}" ${checked ? "checked" : ""}
                        style="accent-color:#244b5a;width:17px;height:17px;">
                    <span style="color:#334c55;">${escapeHTML(choice)}</span>
                </label>
            `;
        });

        html += `</div></section>`;
    });

    html += `
        <div style="display:flex;justify-content:space-between;
            gap:10px;margin-bottom:25px;">
            <button type="button" id="interestBackBtn" style="
                border:1px solid #cfdde1;border-radius:9px;padding:13px 22px;
                background:#fff;color:#334c55;font-weight:700;cursor:pointer;">
                Back
            </button>
            <button type="button" id="interestContinueBtn" style="
                border:0;border-radius:9px;padding:13px 22px;
                background:#244b5a;color:#fff;font-weight:700;cursor:pointer;">
                Continue to Exam
            </button>
        </div>
    `;

    container.innerHTML = html;

    const continueBtn = document.getElementById("interestContinueBtn");

    function refreshContinue() {
        const complete = INTEREST_QUESTIONS.every(
            (_, index) => interestDraft[index] !== undefined
        );

        continueBtn.disabled = !complete;
        continueBtn.style.opacity = complete ? "1" : ".45";
        continueBtn.style.cursor = complete ? "pointer" : "not-allowed";
    }

    container.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener("change", () => {
            const qIndex = Number(input.name.replace("interest", ""));

            interestDraft[qIndex] = Number(input.value);

            // Update highlight without re-rendering (keeps scroll position)
            container
                .querySelectorAll(`input[name="${input.name}"]`)
                .forEach(radio => {
                    const label = radio.closest("label");
                    label.style.background = radio.checked ? "#edf8fa" : "#fff";
                    label.style.borderColor = radio.checked ? "#8ec6d1" : "#dfe8eb";
                });

            refreshContinue();
        });
    });

    document.getElementById("interestBackBtn").addEventListener("click", () => {
        container.innerHTML = "";
        if (selector) selector.style.display = "";
    });

    continueBtn.addEventListener("click", async () => {
        if (continueBtn.disabled) return;

        interestAnswers = [...interestDraft];

        await proceedToExam();
    });

    refreshContinue();
}

/* =========================================================
   LOAD MIXED QUESTIONS (ALL SPECIALIZATIONS)
========================================================= */

async function loadExam() {
    const container = document.getElementById("examContainer");

    if (!container) return;

    container.innerHTML = `
=======
async function loadExam(specialization) {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
        <div class="no-exam">
            <h2>Loading Examination...</h2>
            <p>Please wait while the questions are prepared.</p>
        </div>
    `;

<<<<<<< HEAD
    try {
        const alreadyCompleted = await alreadyFinishedExam();

        if (alreadyCompleted) {
            showAlreadyTaken();
            return;
        }

        const q = query(
            collection(db, "questionBank"),
            where("academicYear", "==", activeAcademicYear)
        );

        const snapshot = await getDocs(q);
        const questionMap = new Map();

        // Availability dates set by the Admin (Administer Exams page)
        const nowMs = Date.now();
        const upcomingStarts = [];
        let closedCount = 0;

        snapshot.forEach(documentSnapshot => {
            const data = documentSnapshot.data();

            // Every specialization is included; only approved questions.
            if (data.status !== "administered") return;

            // Only exams that are open right now can be started.
            const startMs = toMillis(data.scheduledStartAt);
            const endMs = toMillis(data.scheduledEndAt);

            if (startMs && nowMs < startMs) {
                upcomingStarts.push(startMs);
                return;
            }

            if (endMs && nowMs > endMs) {
                closedCount++;
                return;
            }

            const questionText = String(data.question || "").trim();

            if (!questionText) return;

            const choices = normalizeChoices(data);
            const correctLetter = resolveCorrectLetter(data, choices);

            // Questions without an answer key cannot be graded.
            if (!correctLetter) return;

            const duplicateKey = questionText
                .toLowerCase()
                .replace(/\s+/g, " ")
                .replace(/[\s.?!:;,]+$/, "")
                .trim();

            if (questionMap.has(duplicateKey)) return;

            questionMap.set(duplicateKey, {
                id: documentSnapshot.id,
                specialization:
                    String(data.specialization || "Unspecified").trim(),
                question: questionText,
                choices,
                correctLetter
            });
        });

        currentQuestions = [...questionMap.values()];

        if (currentQuestions.length === 0) {
            if (upcomingStarts.length > 0) {
                const opensAt = new Date(Math.min(...upcomingStarts));

                showMessage(
                    `The examination is not open yet. It opens on ` +
                    `${opensAt.toLocaleString()}. Please wait for the ` +
                    `scheduled exam.`
                );
            }
            else if (closedCount > 0) {
                showMessage(
                    "The examination period has ended. Please contact your Admin."
                );
            }
            else {
                showMessage(
                    "There is no Admin-approved examination available yet."
                );
            }

            return;
=======
  try {
    const q = query(
      collection(db, "questionBank"),
      where("academicYear", "==", activeAcademicYear),
    );

    const snapshot = await getDocs(q);

    const questionMap = new Map();

    const examTitleSet = new Set();

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      /* Only administered questions. */
      if (data.status !== "administered") {
        return;
      }

      /* Only this specialization. */
      if (
        String(data.specialization || "").trim() !==
        String(specialization).trim()
      ) {
        return;
      }

      const questionText = String(data.question || "").trim();

      if (!questionText) {
        return;
      }

      const choicesList = normalizeChoices(data);

      const correctLetter = resolveCorrectLetter(data, choicesList);

      const examTitle = getExamTitleFromData(data);

      /*
       * Remove duplicate questions. If the same question
       * appears in more than one administered exam, the
       * student only gets it once. Case, extra spaces and
       * trailing punctuation are ignored when comparing.
       */
      const duplicateKey = questionText
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[\s.?!:;,]+$/, "")
        .trim();

      if (questionMap.has(duplicateKey)) {
        /*
         * Keep the first copy, unless it has no usable
         * correct answer and this copy does.
         */
        const existing = questionMap.get(duplicateKey);

        if (existing.correctLetter || !correctLetter) {
          return;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
        }
      }

<<<<<<< HEAD
        // Random order across ALL specializations, then take 100.
        shuffleArray(currentQuestions);
        currentQuestions = currentQuestions.slice(0, MAX_QUESTIONS);

        // Randomize choices while keeping the original answer key.
        currentQuestions.forEach(question => {
            const pairs = question.choices
                .map((text, index) => ({
                    text,
                    originalLetter: ["A", "B", "C", "D"][index]
                }))
                .filter(item => item.text.trim() !== "");

            shuffleArray(pairs);

            question.randomizedChoices = pairs;
        });

        currentQuestionIndex = 0;
        studentAnswers = {};
        timerQuestionIndex = -1;
        questionTimeRemaining = QUESTION_TIME_SECONDS;
        isSubmittingExam = false;
        isTerminating = false;

        violationCount = 0;
        violationLog = [];
        lastViolationAt = 0;
        warningOpen = false;

        initSecurityFeatures();
        applyExamLockdown(true);

        const selector = document.getElementById("examSelector");
        if (selector) selector.style.display = "none";

        examInProgress = true;

        // Marks the exam as in progress so a refresh counts as cheating.
        localStorage.setItem(progressFlagKey(), String(Date.now()));

        renderExamInterface();
        startQuestionTimer();
    } catch (error) {
        console.error("Error loading exam:", error);

        examInProgress = false;

        showMessage(
            error.message || "An error occurred while loading the exam."
        );
    }
=======
      if (examTitle) {
        examTitleSet.add(examTitle);
      }

      questionMap.set(duplicateKey, {
        id: docSnapshot.id,

        ...data,

        question: questionText,

        choicesList: choicesList,

        correctLetter: correctLetter,

        sourceExamTitle: examTitle,
      });
    });

    currentQuestions = Array.from(questionMap.values());

    if (currentQuestions.length === 0) {
      renderNoExam();

      return;
    }

    /*
     * Combined exam title(s). Sorted so the same set
     * of administered exams always gives the same title
     * (needed for the "already completed" check).
     */
    selectedExamTitles = Array.from(examTitleSet).sort((a, b) =>
      a.localeCompare(b),
    );

    selectedExamTitle =
      selectedExamTitles.length > 0
        ? selectedExamTitles.join(" + ")
        : `${specialization} Examination`;

    /* Randomize, then apply the question limit. */
    shuffleArray(currentQuestions);

    currentQuestions = currentQuestions.slice(0, MAX_QUESTIONS);

    /*
     * Check if this student already completed
     * this combined exam.
     */
    const alreadyCompleted = await alreadyFinishedExam(
      selectedExamTitle,
      specialization,
    );

    if (alreadyCompleted) {
      renderAlreadyCompleted();

      return;
    }

    renderExam();
  } catch (error) {
    console.error("Error loading exam:", error);

    container.innerHTML = `
            <div class="no-exam">

                <h2>
                    Unable to Load Exam
                </h2>

                <p>
                    ${escapeHTML(error.message || "An error occurred.")}
                </p>

            </div>
        `;
  }
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

/* =========================================================
   LOCKDOWN (CSS: no select, no print, watermark)
========================================================= */

<<<<<<< HEAD
function applyExamLockdown(enable) {
    let style = document.getElementById("examLockdownStyle");
    let watermark = document.getElementById("examWatermark");

    if (!enable) {
        style?.remove();
        watermark?.remove();
        return;
    }

    if (!style) {
        style = document.createElement("style");
        style.id = "examLockdownStyle";
        style.textContent = `
            #examContainer, #examContainer * {
                -webkit-user-select:none !important;
                user-select:none !important;
                -webkit-touch-callout:none !important;
            }
            @media print { body { display:none !important; } }
        `;
        document.head.appendChild(style);
    }

    if (!watermark) {
        const label = encodeURIComponent(
            currentUser?.email || currentUser?.uid || "student"
        );

        const svg =
            `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='160'>` +
            `<text x='20' y='90' font-size='16' fill='rgba(0,0,0,0.07)' ` +
            `transform='rotate(-25 160 80)' font-family='Arial'>` +
            decodeURIComponent(label).replace(/[<>&'"]/g, "") +
            `</text></svg>`;

        watermark = document.createElement("div");
        watermark.id = "examWatermark";
        watermark.style.cssText = `
            position:fixed;inset:0;pointer-events:none;z-index:99999;
            background-image:url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}");
        `;
        document.body.appendChild(watermark);
    }
}

/* =========================================================
   SECURITY FEATURES — ANY VIOLATION TERMINATES THE EXAM
========================================================= */

function initSecurityFeatures() {
    if (securityListenersInitialized) return;

    securityListenersInitialized = true;

    const active = () =>
        examInProgress && !isSubmittingExam && !isTerminating;

    // Copy / cut / paste attempts = violation
    ["copy", "cut", "paste"].forEach(type => {
        document.addEventListener(type, event => {
            if (!active()) return;
            event.preventDefault();
            handleViolation(`Attempted to ${type} content`);
        });
    });

    // Right-click, selection, dragging: blocked silently
    ["contextmenu", "selectstart", "dragstart"].forEach(type => {
        document.addEventListener(type, event => {
            if (!active()) return;
            event.preventDefault();
        });
    });

    document.addEventListener("keydown", event => {
        if (!active()) return;

        const key = event.key.toLowerCase();

        const devtools =
            event.key === "F12" ||
            (event.ctrlKey && event.shiftKey &&
                ["i", "j", "c"].includes(key)) ||
            (event.metaKey && event.altKey &&
                ["i", "j", "c"].includes(key));

        const restricted =
            (event.ctrlKey || event.metaKey) &&
            ["u", "p", "s", "a", "c", "v", "x"].includes(key);

        // macOS screenshot shortcuts: Cmd+Shift+3/4/5
        const macShot =
            event.metaKey && event.shiftKey &&
            ["3", "4", "5"].includes(event.key);

        // Windows key / Snipping Tool (Win+Shift+S)
        const winSnip =
            event.shiftKey && event.metaKey && key === "s";

        if (event.key === "PrintScreen") {
            event.preventDefault();
            handleViolation("Pressed the PrintScreen key");
            return;
        }

        if (devtools) {
            event.preventDefault();
            handleViolation("Attempted to open developer tools");
            return;
        }

        if (macShot || winSnip) {
            event.preventDefault();
            handleViolation("Attempted to take a screenshot");
            return;
        }

        if (restricted) {
            event.preventDefault();
            handleViolation("Used a restricted keyboard shortcut");
        }
    });

    // PrintScreen often only fires on keyup in Windows browsers
    document.addEventListener("keyup", event => {
        if (!active()) return;

        if (event.key === "PrintScreen") {
            try { navigator.clipboard?.writeText(""); } catch (e) {}
            handleViolation("Pressed the PrintScreen key");
        }
    });

    // Switching tabs
    document.addEventListener("visibilitychange", () => {
        if (document.hidden && active()) {
            handleViolation("Switched to another tab");
        }
    });

    // Switching windows / apps / snipping tools
    window.addEventListener("blur", () => {
        if (active()) {
            handleViolation("Left the examination window");
        }
    });

    // Exiting fullscreen
    document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && active()) {
            handleViolation("Exited full-screen mode");
        }
    });

    // Closing/reloading the page (flag in localStorage handles next load)
    window.addEventListener("beforeunload", event => {
        if (active()) {
            event.preventDefault();
            event.returnValue = "";
        }
    });
}

/* =========================================================
   VIOLATION HANDLER (WARNINGS BEFORE TERMINATION)
========================================================= */

function handleViolation(reason) {
    if (!examInProgress || isSubmittingExam || isTerminating) return;

    const now = Date.now();

    // Ignore duplicate events caused by the same action
    if (warningOpen || now - lastViolationAt < VIOLATION_COOLDOWN_MS) return;

    lastViolationAt = now;
    violationCount++;
    violationLog.push(reason);

    updateWarningCounter();

    if (violationCount >= MAX_VIOLATIONS) {
        terminateExam(
            `Reached ${MAX_VIOLATIONS}/${MAX_VIOLATIONS} violations. ` +
            `Last violation: ${reason}`
        );
        return;
    }

    showViolationWarning(reason);
    logViolationWarning(reason);
}

// Lets the Admin see every warning on the Monitoring page.
function logViolationWarning(reason) {
    addDoc(collection(db, "activityLogs"), {
        user: currentUser?.displayName || currentUser?.email || "Student",
        userUid: currentUser?.uid || "",
        role: "Student",
        action: `Exam Violation Warning ${violationCount}/${MAX_VIOLATIONS}`,
        status: "Warning",
        reason,
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        examTitle: EXAM_TITLE,
        academicYear: activeAcademicYear
    }).catch(error => {
        console.error("Unable to save violation log:", error);
    });
}

function updateWarningCounter() {
    const el = document.getElementById("warningCounter");

    if (el) {
        el.textContent = `Warnings: ${violationCount}/${MAX_VIOLATIONS}`;
        el.style.color = violationCount > 0 ? "#a52e3c" : "#829197";
    }
}

function showViolationWarning(reason) {
    warningOpen = true;

    const remaining = MAX_VIOLATIONS - violationCount;

    const overlay = document.createElement("div");
    overlay.id = "violationOverlay";
    overlay.style.cssText = `
        position:fixed;inset:0;background:#f4f8f9;z-index:100002;
        display:flex;align-items:center;justify-content:center;
    `;

    overlay.innerHTML = `
        <div style="background:#fff;padding:30px;border-radius:14px;
            max-width:460px;width:90%;text-align:center;
            border:1px solid #f0c5c5;border-top:5px solid #c0392b;">
            <h2 style="margin:0 0 10px;color:#a52e3c;">
                Warning ${violationCount}/${MAX_VIOLATIONS}
            </h2>
            <p style="margin:0 0 10px;color:#334c55;line-height:1.5;">
                Violation detected: <strong>${escapeHTML(reason)}</strong>
=======
function renderExam() {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  let html = `
        <div class="active-exam-header">

            <h2>
                ${escapeHTML(selectedExamTitle)}
            </h2>

            <p>
                Specialization:

                <strong>
                    ${escapeHTML(selectedSpecialization)}
                </strong>
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
            </p>
            <p style="margin:0 0 22px;color:#667981;line-height:1.5;">
                You have <strong>${remaining}</strong> warning(s) left.
                If you reach ${MAX_VIOLATIONS}/${MAX_VIOLATIONS}, your exam
                will be terminated and your account deactivated.
                The timer is still running.
            </p>
            <button id="violationContinue" style="padding:12px 24px;
                border:0;border-radius:9px;background:#244b5a;color:#fff;
                font-weight:700;cursor:pointer;">
                I Understand, Continue
            </button>
        </div>
    `;

<<<<<<< HEAD
    document.body.appendChild(overlay);

    overlay.querySelector("#violationContinue").onclick = async () => {
        // Button click is a user gesture, so fullscreen can be restored.
        const root = document.documentElement;

        if (root.requestFullscreen && !document.fullscreenElement) {
            try {
                await root.requestFullscreen();
            } catch (e) {
                showToast("Please return to full-screen mode.");
            }
        }

        overlay.remove();
        warningOpen = false;
        lastViolationAt = Date.now();
    };
}

/* =========================================================
   TERMINATE EXAM + DEACTIVATE ACCOUNT
========================================================= */

async function terminateExam(reason) {
    if (isTerminating || isSubmittingExam || !examInProgress) return;

    isTerminating = true;
    examInProgress = false;

    clearInterval(examTimerInterval);
    localStorage.removeItem(progressFlagKey());
    applyExamLockdown(false);

    showMessage(
        "Your examination has been terminated due to a violation. " +
        "Your account has been deactivated. Please contact your Admin."
    );

    const studentName =
        currentUser?.displayName || currentUser?.email || "Student";

    // 1) Deactivate the account (most important step)
    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            active: false,
            deactivatedReason: "Cheating: " + reason,
            deactivatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Unable to deactivate account:", error);
    }

    // 2) Save the terminated result
    try {
        await addDoc(collection(db, "results"), {
            studentUid: currentUser.uid,
            studentName,
            studentEmail: currentUser.email || "",
            specialization: EXAM_SPECIALIZATION,
            examTitle: EXAM_TITLE,
            academicYear: activeAcademicYear,

            score: 0,
            totalItems: currentQuestions.length,
            answeredItems: Object.keys(studentAnswers).length,

            submissionType: "Terminated (Cheating)",
            terminationReason: reason,
            cheatingWarnings: violationCount,
            violationLog,

            date: new Date().toLocaleString(),
            submittedAt: serverTimestamp(),
            status: "Terminated"
        });
    } catch (error) {
        console.error("Unable to save terminated result:", error);
    }

    // 3) Activity log for the admin
    try {
        await addDoc(collection(db, "activityLogs"), {
            user: studentName,
            userUid: currentUser.uid,
            role: "Student",
            action: "Exam Terminated - Cheating Detected",
            status: "Violation",
            reason,
            time: new Date().toLocaleString(),
            timestamp: Date.now(),
            examTitle: EXAM_TITLE,
            academicYear: activeAcademicYear
        });
    } catch (error) {
        console.error("Unable to save activity log:", error);
    }

    if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch (e) {}
    }

    try { await signOut(auth); } catch (e) {}

    await appAlert(
        "Your examination was terminated.\n\nReason: " + reason +
        "\n\nYour account is now deactivated. Please contact the Admin " +
        "to reactivate it.",
        { title: "Exam Terminated", type: "error" }
    );

    window.location.replace("../login.html");
}

/* =========================================================
   ONE QUESTION AT A TIME
========================================================= */

function renderExamInterface() {
    const container = document.getElementById("examContainer");

    if (!container || !currentQuestions.length) return;

    const question = currentQuestions[currentQuestionIndex];
    const total = currentQuestions.length;

    const progress = ((currentQuestionIndex + 1) / total) * 100;
    const answeredCount = Object.keys(studentAnswers).length;
=======
  /* =====================================================
       EXAM QUESTIONS
    ===================================================== */
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

  const letters = ["A", "B", "C", "D"];

<<<<<<< HEAD
    let html = `
        <section style="
            background:#fff;padding:20px;border-radius:12px;
            margin-bottom:18px;border:1px solid #e1eaed;
            border-top:4px solid #8ec6d1;
        ">
            <h2 style="margin:0 0 7px;color:#244b5a;">
                ${escapeHTML(EXAM_TITLE)}
            </h2>

            <p style="margin:0;color:#667981;">
                Coverage: <strong>${escapeHTML(EXAM_SPECIALIZATION)}</strong>
            </p>

            <div style="display:flex;justify-content:space-between;
                gap:12px;align-items:center;margin-top:18px;">
                <span style="font-size:13px;color:#657982;">
                    Question ${currentQuestionIndex + 1} of ${total}
                </span>

                <strong id="examTimerDisplay" style="
                    padding:9px 13px;border-radius:8px;
                    background:#eaf5f7;color:#244b5a;">
                    00:${String(QUESTION_TIME_SECONDS).padStart(2, "0")}
                </strong>
=======
  currentQuestions.forEach((question, index) => {
    html += `
    <div class="exam-question-panel">

        <div class="question-number">
            Question ${index + 1}
            of ${currentQuestions.length}
        </div>

        <div class="question-text">
            ${escapeHTML(question.question)}
        </div>
`;

    question.choicesList.forEach((choice, choiceIndex) => {
      /* Skip empty choices but keep the letters aligned. */
      if (!choice.trim()) {
        return;
      }

      const letter = letters[choiceIndex];

      html += `
            <label class="answer-choice">

                <input
                    type="radio"
                    name="q${index}"
                    value="${letter}"
                >

                <span>
                    <strong>${letter}.</strong>
                    ${escapeHTML(choice)}
                </span>

            </label>
        `;
    });

    html += `
    </div>
`;
  });

  /* =====================================================
       INTEREST ASSESSMENT
    ===================================================== */

  html += `

    <div class="interest-section">

        <h2>
            Interest Assessment
        </h2>

        <p class="question-total">

            Answer the following questions based on your interests and preferences in Information Technology.

        </p>

`;

  interestQuestions.forEach((q, index) => {
    html += `

            <div class="interest-question-panel">

                <div class="question-number">

                    Interest Question ${index + 1} of ${interestQuestions.length}

                </div>


                <div class="question-text">

                    ${escapeHTML(q.question)}

                </div>

        `;

    q.choices.forEach((choice, choiceIndex) => {
      html += `

                    <label class="answer-choice">

                        <input
                            type="radio"
                            name="interest${index}"
                            value="${escapeHTML(choice)}"
                        >

                        <span>
                            ${letters[choiceIndex]}. ${escapeHTML(choice)}
                        </span>

                    </label>

                `;
    });

    html += `

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
            </div>

            <div style="height:7px;margin-top:12px;overflow:hidden;
                border-radius:20px;background:#e8eff1;">
                <div style="width:${progress}%;height:100%;
                    background:#8ec6d1;transition:width .2s;"></div>
            </div>

            <p style="margin:8px 0 0;color:#829197;font-size:12px;">
                ${answeredCount} answered &nbsp;•&nbsp;
                <span id="warningCounter"
                    style="color:${violationCount > 0 ? "#a52e3c" : "#829197"};">
                    Warnings: ${violationCount}/${MAX_VIOLATIONS}
                </span>
            </p>
        </section>

        <section style="
            background:#fff;padding:24px;border:1px solid #e1eaed;
            border-radius:12px;margin-bottom:18px;
        ">
            <h3 style="margin:0 0 22px;color:#263f49;
                font-size:18px;line-height:1.6;">
                ${escapeHTML(question.question)}
            </h3>

            <div style="display:grid;gap:12px;">
    `;

    question.randomizedChoices.forEach((choice, index) => {
        const isSelected =
            studentAnswers[currentQuestionIndex] === choice.originalLetter;

        html += `
            <label style="
                display:flex;align-items:center;gap:12px;padding:15px;
                border:1px solid ${isSelected ? "#8ec6d1" : "#dfe8eb"};
                border-radius:10px;
                background:${isSelected ? "#edf8fa" : "#fff"};
                cursor:pointer;
            ">
                <input type="radio" name="currentQuestionChoice"
                    value="${choice.originalLetter}"
                    ${isSelected ? "checked" : ""}
                    style="accent-color:#244b5a;width:17px;height:17px;">

                <span style="color:#334c55;line-height:1.5;">
                    <strong>${letters[index]}.</strong>
                    ${escapeHTML(choice.text)}
                </span>
            </label>
        `;
<<<<<<< HEAD
    });

    html += `
            </div>
        </section>
=======
  });

  html += `
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

        <div style="display:flex;justify-content:flex-end;
            gap:10px;margin-bottom:25px;">
    `;

    if (currentQuestionIndex < total - 1) {
        html += `
            <button type="button" id="nextQuestionButton" style="
                border:0;border-radius:9px;padding:13px 22px;
                background:#8ec6d1;color:#193b49;font-weight:700;
                cursor:pointer;">
                Next Question →
            </button>
        `;
    } else {
        html += `
            <button type="button" id="submitExamBtn" style="
                border:0;border-radius:9px;padding:13px 22px;
                background:#244b5a;color:white;font-weight:700;
                cursor:pointer;">
                Submit Exam
            </button>
        `;
    }

<<<<<<< HEAD
    html += "</div>";

    container.innerHTML = html;

    container.querySelectorAll(
        'input[name="currentQuestionChoice"]'
    ).forEach(input => {
        input.addEventListener("change", () => {
            studentAnswers[currentQuestionIndex] = input.value;
            renderExamInterface();
        });
    });

    document.getElementById("nextQuestionButton")
        ?.addEventListener("click", goToNextQuestion);

    document.getElementById("submitExamBtn")
        ?.addEventListener("click", confirmAndSubmitExam);

    updateTimerDisplay();
=======
  html += `

    <button
        id="submitExamBtn"
        class="submit-btn"
        onclick="submitExam()"
    >
        Submit Exam
    </button>

`;

  container.innerHTML = html;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
}

/* =========================================================
   NEXT QUESTION — NO PREVIOUS BUTTON
========================================================= */

<<<<<<< HEAD
function goToNextQuestion() {
    if (!examInProgress || isSubmittingExam) return;

    if (!Object.prototype.hasOwnProperty.call(
        studentAnswers,
        currentQuestionIndex
    )) {
        showToast("Please select an answer before continuing.");
        return;
    }

    if (currentQuestionIndex >= currentQuestions.length - 1) return;
=======
function renderAlreadyCompleted() {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="no-exam">
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

    clearInterval(examTimerInterval);

    currentQuestionIndex++;

<<<<<<< HEAD
    timerQuestionIndex = -1;
    questionTimeRemaining = QUESTION_TIME_SECONDS;

    renderExamInterface();
    startQuestionTimer();
}
window.goToNextQuestion = goToNextQuestion;
=======
                <strong>
                    ${escapeHTML(selectedExamTitle)}
                </strong>

                for the academic year

                <strong>
                    ${escapeHTML(activeAcademicYear)}
                </strong>.
            </p>

        </div>
    `;
}
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

/* =========================================================
   PER-QUESTION TIMER
========================================================= */

<<<<<<< HEAD
function startQuestionTimer() {
    clearInterval(examTimerInterval);

    if (!examInProgress || isSubmittingExam) return;

    if (timerQuestionIndex !== currentQuestionIndex) {
        timerQuestionIndex = currentQuestionIndex;
        questionTimeRemaining = QUESTION_TIME_SECONDS;
    }

    updateTimerDisplay();
=======
function renderNoExam() {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="no-exam">
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

    examTimerInterval = setInterval(() => {
        if (!examInProgress || isSubmittingExam) {
            clearInterval(examTimerInterval);
            return;
        }

        questionTimeRemaining--;

<<<<<<< HEAD
        updateTimerDisplay();

        if (questionTimeRemaining <= 0) {
            clearInterval(examTimerInterval);

            if (currentQuestionIndex < currentQuestions.length - 1) {
                currentQuestionIndex++;
                timerQuestionIndex = -1;
                questionTimeRemaining = QUESTION_TIME_SECONDS;

                renderExamInterface();
                startQuestionTimer();
            } else {
                // Auto-submit (no alert: it would blur the window)
                submitExam(true);
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const display = document.getElementById("examTimerDisplay");

    if (!display) return;

    const seconds = Math.max(0, questionTimeRemaining);

    display.textContent = `00:${String(seconds).padStart(2, "0")}`;

    if (seconds <= 10) {
        display.style.background = "#fff0f0";
        display.style.color = "#a52e3c";
    } else {
        display.style.background = "#eaf5f7";
        display.style.color = "#244b5a";
    }
}

=======
        </div>
    `;
}

/* =========================================================
   CHECK COMPLETED EXAM
========================================================= */

async function alreadyFinishedExam(examTitle, specialization) {
  if (!currentUser) {
    return false;
  }

  try {
    const q = query(
      collection(db, "results"),

      where("studentUid", "==", currentUser.uid),

      where("academicYear", "==", activeAcademicYear),
    );

    const snapshot = await getDocs(q);

    let completed = false;

    snapshot.forEach((docSnapshot) => {
      const result = docSnapshot.data();

      if (
        result.examTitle === examTitle &&
        result.specialization === specialization &&
        result.status === "Completed"
      ) {
        completed = true;
      }
    });

    return completed;
  } catch (error) {
    console.error("Error checking previous result:", error);

    return false;
  }
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
/* =========================================================
   SUBMIT CONFIRMATION
========================================================= */

<<<<<<< HEAD
function confirmAndSubmitExam() {
    if (!examInProgress || isSubmittingExam) return;

    const unanswered = currentQuestions.filter((_, index) =>
        !Object.prototype.hasOwnProperty.call(studentAnswers, index)
    ).length;

    const message = unanswered > 0
        ? `You have ${unanswered} unanswered question(s). Submit anyway?`
        : "Are you sure you want to submit your examination?";

    appConfirm(message, {
        title: "Submit Examination",
        confirmText: "Yes, Submit"
    }).then(ok => {
        if (ok) submitExam(false);
    });
}
window.confirmAndSubmitExam = confirmAndSubmitExam;

/* =========================================================
   SUBMIT EXAM AND GRADE
========================================================= */

async function submitExam(isAutomatic = false) {
    if (isSubmittingExam || isTerminating || !examInProgress) return;
=======
async function submitExam() {
  if (isSubmittingExam) {
    return;
  }

  if (!currentUser) {
    alert("Your session has expired. Please log in again.");

    return;
  }

  /* =====================================================
       VALIDATE EXAM QUESTIONS
    ===================================================== */

  for (let i = 0; i < currentQuestions.length; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);

    if (!selected) {
      alert(`Please answer Question ${i + 1}.`);

      return;
    }
  }

  /* =====================================================
       VALIDATE INTEREST QUESTIONS
    ===================================================== */

  for (let i = 0; i < interestQuestions.length; i++) {
    const selected = document.querySelector(
      `input[name="interest${i}"]:checked`,
    );

    if (!selected) {
      alert(`Please answer Interest Question ${i + 1}.`);

      return;
    }
  }

  const submitButton = document.getElementById("submitExamBtn");

  isSubmittingExam = true;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)

  if (submitButton) {
    submitButton.disabled = true;

<<<<<<< HEAD
    clearInterval(examTimerInterval);

    const nextButton = document.getElementById("nextQuestionButton");
    const submitButton = document.getElementById("submitExamBtn");

    if (nextButton) nextButton.disabled = true;
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
    }

    try {
        // Last safety check: if the exam was already completed (for
        // example in another tab), do NOT save a second result.
        if (await alreadyFinishedExam()) {
            examInProgress = false;
            localStorage.removeItem(progressFlagKey());
            applyExamLockdown(false);

            if (document.fullscreenElement) {
                try { await document.exitFullscreen(); } catch (e) {}
            }

            showAlreadyTaken();
            return;
        }

        let score = 0;

        // Per-specialization results, used by the recommendation page.
        const breakdownMap = {};

        currentQuestions.forEach((question, index) => {
            const answer = studentAnswers[index];
            const isCorrect =
                !!answer && answer === question.correctLetter;

            if (isCorrect) score++;

            const spec = question.specialization || "Unspecified";

            if (!breakdownMap[spec]) {
                breakdownMap[spec] = { correct: 0, total: 0 };
            }

            breakdownMap[spec].total++;
            if (isCorrect) breakdownMap[spec].correct++;
        });

        const specializationBreakdown = Object.entries(breakdownMap)
            .map(([specialization, value]) => ({
                specialization,
                correct: value.correct,
                total: value.total
            }));

        const interest = scoreInterestAnswers(interestAnswers || []);

        const resultData = {
            studentUid: currentUser.uid,
            studentName:
                currentUser.displayName || currentUser.email || "Student",
            studentEmail: currentUser.email || "",
            specialization: EXAM_SPECIALIZATION,
            examTitle: EXAM_TITLE,
            academicYear: activeAcademicYear,

            score,
            originalScore: score,
            specializationBreakdown,
            interestAnswers: interestAnswers || [],
            interestScores: interest.scores,
            interestTopAreas: interest.topAreas,
            cheatingWarnings: violationCount,
            violationLog,
            cheatingPenalty: 0,

            totalItems: currentQuestions.length,
            answeredItems: Object.keys(studentAnswers).length,

            submissionType: isAutomatic
                ? "Auto-Submitted (Time Expired)"
                : "Manual Submission",

            date: new Date().toLocaleString(),
            submittedAt: serverTimestamp(),
            status: "Completed"
        };

        const resultId = completedResultId();

        await setDoc(
            doc(db, "results", resultId),
            resultData
        );

        await addDoc(collection(db, "activityLogs"), {
            user: currentUser.displayName || currentUser.email || "Student",
            userUid: currentUser.uid,
            role: "Student",
            action: isAutomatic
                ? "Exam Auto-Submitted (Time Expired)"
                : "Finished Exam",
            status: "Success",
            time: new Date().toLocaleString(),
            timestamp: Date.now(),
            examTitle: EXAM_TITLE,
            academicYear: activeAcademicYear
        });

        // Exam is over: lift the lockdown before showing dialogs.
        examInProgress = false;
        localStorage.removeItem(progressFlagKey());
        applyExamLockdown(false);

        if (document.fullscreenElement) {
            try { await document.exitFullscreen(); } catch (e) {}
        }

        await appAlert(
            `Your exam was submitted successfully.\n\n` +
            `Score: ${score}/${currentQuestions.length}`,
            { title: "Exam Submitted", type: "success" }
        );

        // No separate result page: show the completed summary right here.
        await showAlreadyTaken();
    } catch (error) {
        console.error("Error submitting exam:", error);

        // The Firestore rules reject a second completed result.
        if (error?.code === "permission-denied") {
            try {
                if (await alreadyFinishedExam()) {
                    examInProgress = false;
                    localStorage.removeItem(progressFlagKey());
                    applyExamLockdown(false);

                    if (document.fullscreenElement) {
                        try { await document.exitFullscreen(); } catch (e) {}
                    }

                    showAlreadyTaken();
                    return;
                }
            } catch (checkError) {
                console.error("Check after denied save failed:", checkError);
            }
        }

        isSubmittingExam = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Exam";
        }

        showToast(
            "Unable to submit. Check your connection and try again."
        );
    }
}
=======
    submitButton.textContent = "Submitting...";
  }

  try {
    /* =================================================
           CALCULATE SCORE
        ================================================= */

    let originalScore = 0;

    currentQuestions.forEach((question, index) => {
      const selected = document.querySelector(
        `input[name="q${index}"]:checked`,
      );

      if (!selected) {
        return;
      }

      const answer = selected.value;

      if (question.correctLetter && answer === question.correctLetter) {
        originalScore++;
      }
    });

    /* =================================================
           CHEATING PENALTY
        ================================================= */

    const cheatingPenalty = warningCount >= 2 ? 2 : 0;

    const score = Math.max(0, originalScore - cheatingPenalty);

    /* =================================================
           INTEREST SCORES
        ================================================= */

    const interestScores = processInterestAnswers();

    /* =================================================
           STUDENT NAME
        ================================================= */

    let studentName = localStorage.getItem("currentStudentName");

    if (!studentName) {
      studentName = currentUser.email || "Student";
    }

    /* =================================================
           SAVE RESULT
        ================================================= */

    const resultData = {
      studentUid: currentUser.uid,

      studentName: studentName,

      studentEmail: currentUser.email || "",

      specialization: selectedSpecialization,

      examTitle: selectedExamTitle,

      examTitles: selectedExamTitles,

      academicYear: activeAcademicYear,

      score: score,

      originalScore: originalScore,

      cheatingWarnings: warningCount,

      cheatingPenalty: cheatingPenalty,

      totalItems: currentQuestions.length,

      interestScores: interestScores,

      date: new Date().toLocaleString(),

      status: "Completed",
    };

    const resultRef = await addDoc(collection(db, "results"), resultData);

    console.log("RESULT SAVED:", resultRef.id);

    /* =================================================
           ACTIVITY LOG
        ================================================= */

    await addDoc(collection(db, "activityLogs"), {
      user: studentName,

      role: "Student",

      action: "Finished Exam",

      status: "Success",

      time: new Date().toLocaleString(),

      timestamp: Date.now(),
    });

    /* =================================================
           SAVE LAST RESULT ID
        ================================================= */

    sessionStorage.setItem("lastSubmittedResultId", resultRef.id);

    /* =================================================
           REDIRECT
        ================================================= */

    alert("Exam submitted successfully!");

    window.location.replace("../student/result.html");
  } catch (error) {
    console.error("Error submitting exam:", error);

    alert("Unable to submit the examination.\n\n" + (error.message || ""));

    isSubmittingExam = false;

    if (submitButton) {
      submitButton.disabled = false;

      submitButton.textContent = "Submit Exam";
    }
  }
}

>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
window.submitExam = submitExam;

/* =========================================================
   CHECK PREVIOUS ATTEMPT
   A student who has a "Completed" result in the active
   academic year can NOT take the exam again.
   (Terminated attempts do NOT block a retake after the admin
    reactivates the account; only "Completed" does.)
========================================================= */

<<<<<<< HEAD
async function alreadyFinishedExam() {
    if (!currentUser || !activeAcademicYear) return false;

    const q = query(
        collection(db, "results"),
        where("studentUid", "==", currentUser.uid),
        where("academicYear", "==", activeAcademicYear)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.some(documentSnapshot =>
        documentSnapshot.data().status === "Completed"
    );
}

/* =========================================================
   LOGOUT
========================================================= */

function logout() {
    if (examInProgress) {
        showToast("Please submit your examination before logging out.");
        return;
    }

    document.getElementById("logout-overlay")?.classList.add("active");
}
window.logout = logout;

function closeLogoutModal() {
    document.getElementById("logout-overlay")?.classList.remove("active");
}
window.closeLogoutModal = closeLogoutModal;

function closeLogoutOutside(event) {
    if (event.target?.id === "logout-overlay") closeLogoutModal();
}
window.closeLogoutOutside = closeLogoutOutside;

async function performLogout() {
    if (examInProgress) {
        showToast("Please submit your examination before logging out.");
        return;
    }

    try {
        await signOut(auth);
        sessionStorage.clear();
        window.location.replace("../login.html");
    } catch (error) {
        console.error("Logout error:", error);
        await appAlert("Unable to log out.", { type: "error" });
    }
}
window.performLogout = performLogout;
=======
function processInterestAnswers() {
  const interestScores = {};

  interestQuestions.forEach((question, index) => {
    const selected = document.querySelector(
      `input[name="interest${index}"]:checked`,
    );

    if (!selected) {
      return;
    }

    const answer = selected.value;

    if (!interestScores[answer]) {
      interestScores[answer] = 0;
    }

    interestScores[answer]++;
  });

  return interestScores;
}

/* =========================================================
   SHUFFLE
========================================================= */

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [array[i], array[j]] = [array[j], array[i]];
  }
}

/* =========================================================
   ANTI-CHEATING
========================================================= */

document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentQuestions.length > 0 && !isSubmittingExam) {
    /* ONLY ALLOW 2 WARNINGS */

    if (warningCount >= 2) {
      return;
    }

    warningCount++;

    console.warn("Tab switch detected:", warningCount);

    const warningBox = document.getElementById("warningBox");

    if (warningBox) {
      warningBox.innerHTML = `
                    <p>
                        Warning: Leaving the examination page has been detected.
                        Warning ${warningCount} of 2.
                    </p>
                `;
    }

    /* FIRST WARNING */

    if (warningCount === 1) {
      alert("Warning 1 of 2: Please stay on the examination page.");
    }

    /* SECOND WARNING - EXAM RECEIVES -2 POINTS */

    if (warningCount === 2) {
      alert(
        "Warning 2 of 2: A 2-point deduction will be applied to your current specialization exam.",
      );

      if (currentUser) {
        const studentName =
          localStorage.getItem("currentStudentName") ||
          currentUser.email ||
          "Student";

        addDoc(collection(db, "activityLogs"), {
          user: studentName,

          role: "Student",

          action: "Cheating Attempt",

          status: "Warning",

          time: new Date().toLocaleString(),

          timestamp: Date.now(),
        }).catch((error) => {
          console.error("Unable to save cheating log:", error);
        });
      }
    }
  }
});

/* =========================================================
   LOGOUT MODAL
========================================================= */

function logout() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    console.error("Logout overlay not found.");

    return;
  }

  overlay.classList.add("active");
}

window.logout = logout;

/* =========================================================
   CLOSE LOGOUT MODAL
========================================================= */

function closeLogoutModal() {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.remove("active");
  }
}

window.closeLogoutModal = closeLogoutModal;

/* =========================================================
   CLOSE LOGOUT MODAL WHEN CLICKING OUTSIDE
========================================================= */

function closeLogoutOutside(event) {
  if (event.target && event.target.id === "logout-overlay") {
    closeLogoutModal();
  }
}

window.closeLogoutOutside = closeLogoutOutside;

/* =========================================================
   PERFORM LOGOUT
========================================================= */

async function performLogout() {
  try {
    await signOut(auth);

    localStorage.clear();

    sessionStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);

    alert("Unable to log out.");
  }
}

window.performLogout = performLogout;

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
   ESCAPE ATTRIBUTE
========================================================= */

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
