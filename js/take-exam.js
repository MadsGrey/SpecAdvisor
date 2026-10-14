import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

/* =========================================================
   AUTHENTICATION
========================================================= */

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
    window.location.replace("../Login.html");

    return;
  }

  currentUser = user;

  console.log("Take Exam Auth:", user.email);

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

/* =========================================================
   LOAD ACTIVE ACADEMIC YEAR
========================================================= */

async function loadActiveAcademicYear() {
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
}

/* =========================================================
   EXAM SCHEDULE (is an exam open right now?)
========================================================= */

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

/* =========================================================
   START EXAM
========================================================= */

async function startSelectedExam() {
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

/* =========================================================
   INTEREST CHECK STEP
========================================================= */

async function loadExam(specialization) {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="no-exam">
            <h2>Loading Examination...</h2>
            <p>Please wait while the questions are prepared.</p>
        </div>
    `;

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
        }
      }

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
}

/* =========================================================
   LOCKDOWN (CSS: no select, no print, watermark)
========================================================= */

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

  /* =====================================================
       EXAM QUESTIONS
    ===================================================== */

  const letters = ["A", "B", "C", "D"];

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
  });

  html += `

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
}

/* =========================================================
   NEXT QUESTION — NO PREVIOUS BUTTON
========================================================= */

function renderAlreadyCompleted() {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="no-exam">

    clearInterval(examTimerInterval);

    currentQuestionIndex++;

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

/* =========================================================
   PER-QUESTION TIMER
========================================================= */

function renderNoExam() {
  const container = document.getElementById("examContainer");

  if (!container) {
    return;
  }

  container.innerHTML = `
        <div class="no-exam">

    examTimerInterval = setInterval(() => {
        if (!examInProgress || isSubmittingExam) {
            clearInterval(examTimerInterval);
            return;
        }

        questionTimeRemaining--;

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

/* =========================================================
   SUBMIT CONFIRMATION
========================================================= */

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

  if (submitButton) {
    submitButton.disabled = true;

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

window.submitExam = submitExam;

/* =========================================================
   CHECK PREVIOUS ATTEMPT
   A student who has a "Completed" result in the active
   academic year can NOT take the exam again.
   (Terminated attempts do NOT block a retake after the admin
    reactivates the account; only "Completed" does.)
========================================================= */

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

    window.location.replace("../Login.html");
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
}
