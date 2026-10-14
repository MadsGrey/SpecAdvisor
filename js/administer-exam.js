import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    writeBatch,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    deleteField,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
    appAlert,
    appConfirm
} from "./ui-dialog.js";

/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentAdminUid = "";
let activeAcademicYear = "";
let activeAcademicYearId = "";

let allExams = [];
let adminExamPDF = null;
let adminAnswerPDF = null;
let adminUploadBusy = false;

// Questions currently open in edit mode, stored as "examIndex:questionIndex"
const editingQuestions = new Set();

const facultyNameCache = {};

/* =====================================================
   HELPERS
===================================================== */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getLocalDateTimeValue(value) {
    if (!value) return "";

    let date;

    if (typeof value.toDate === "function") {
        date = value.toDate();
    } else {
        date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "";

    const pad = n => String(n).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function showNotification(message, type = "info") {
    const element = document.getElementById("uiNotification");

    if (!element) {
        appAlert(message, {
            type: type === "error"
                ? "error"
                : type === "success"
                    ? "success"
                    : "info"
        });
        return;
    }

    element.textContent = message;
    element.className = `admin-upload-notification show ${type}`;

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function getQuestionChoices(data) {
    if (Array.isArray(data.choices)) {
        return {
            A: data.choices[0] || "",
            B: data.choices[1] || "",
            C: data.choices[2] || "",
            D: data.choices[3] || ""
        };
    }

    return {
        A: data.choices?.A ?? data.choiceA ?? "",
        B: data.choices?.B ?? data.choiceB ?? "",
        C: data.choices?.C ?? data.choiceC ?? "",
        D: data.choices?.D ?? data.choiceD ?? ""
    };
}

/*
   Questions can be stored in three shapes (array, object, or
   choiceA..choiceD fields). Editing keeps whichever shape the
   question already uses so other pages keep working.
*/
function detectChoiceFormat(data) {
    if (Array.isArray(data.choices)) return "array";

    if (data.choices && typeof data.choices === "object") return "object";

    if (data.choiceA !== undefined || data.choiceB !== undefined) return "flat";

    return "object";
}

function buildChoicePayload(format, choices) {
    if (format === "array") {
        return { choices: [choices.A, choices.B, choices.C, choices.D] };
    }

    if (format === "flat") {
        return {
            choiceA: choices.A,
            choiceB: choices.B,
            choiceC: choices.C,
            choiceD: choices.D
        };
    }

    return {
        choices: {
            A: choices.A,
            B: choices.B,
            C: choices.C,
            D: choices.D
        }
    };
}

function resolveCorrectLetter(question) {
    const answer = String(question.correctAnswer || "")
        .trim()
        .toUpperCase();

    if (["A", "B", "C", "D"].includes(answer)) {
        return answer;
    }

    const choices = question.choices || {};

    for (const letter of ["A", "B", "C", "D"]) {
        if (
            String(choices[letter] || "").trim().toLowerCase() ===
            answer.toLowerCase()
        ) {
            return letter;
        }
    }

    return "";
}

function getTimestampMilliseconds(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const time = new Date(value).getTime();

    return Number.isNaN(time) ? 0 : time;
}

/* =====================================================
   AUTHENTICATION
===================================================== */

onAuthStateChanged(auth, async user => {
    if (!user) {
        window.location.replace("../Login.html");
        return;
    }

    currentAdminUid = user.uid;

    try {
        const userSnapshot = await getDoc(
            doc(db, "users", currentAdminUid)
        );

        if (!userSnapshot.exists()) {
            await appAlert(
                "Your user profile could not be found.",
                { type: "error" }
            );
            await signOut(auth);
            window.location.replace("../login.html");
            return;
        }

        const userData = userSnapshot.data();

        if (String(userData.role || "").toLowerCase() !== "admin") {
            await appAlert(
                "This page is for administrators only.",
                { title: "Access Denied", type: "error" }
            );
            window.location.replace("../login.html");
            return;
        }

        await loadAdminSpecializations();
        await loadActiveAcademicYear();

    } catch (error) {
        console.error("Admin authentication error:", error);

        showNotification(
            "Unable to verify your admin account. Check your connection and Firestore permissions.",
            "error"
        );
    }
});

/* =====================================================
   ACTIVE ACADEMIC YEAR
===================================================== */

async function loadActiveAcademicYear() {
    const yearElement = document.getElementById("activeAcademicYear");

    try {
        const yearQuery = query(
            collection(db, "academicYears"),
            where("active", "==", true)
        );

        const snapshot = await getDocs(yearQuery);

        if (snapshot.empty) {
            activeAcademicYear = "";
            activeAcademicYearId = "";
            allExams = [];

            if (yearElement) {
                yearElement.textContent = "No active academic year";
            }

            const list = document.getElementById("examList");

            if (list) {
                list.innerHTML = `
                    <div class="admin-empty">
                        <h2>No Active Academic Year</h2>
                        <p>Activate an academic year before managing exams.</p>
                    </div>
                `;
            }

            return;
        }

        const activeDocument = snapshot.docs[0];
        const data = activeDocument.data();

        activeAcademicYearId = activeDocument.id;
        activeAcademicYear = String(data.year || data.name || "");

        if (yearElement) {
            yearElement.textContent = activeAcademicYear || "Unknown";
        }

        if (!activeAcademicYear) {
            allExams = [];

            const list = document.getElementById("examList");

            if (list) {
                list.innerHTML = `
                    <div class="admin-empty">
                        <h2>Academic Year Not Configured</h2>
                        <p>The active academic year has no year or name value.</p>
                    </div>
                `;
            }

            return;
        }

        await loadExams();

    } catch (error) {
        console.error("Error loading academic year:", error);

        if (yearElement) {
            yearElement.textContent = "Unable to load";
        }

        showNotification(
            "Could not load the active academic year.",
            "error"
        );
    }
}

/* =====================================================
   FACULTY / CREATOR NAME
===================================================== */

async function getFacultyName(facultyId) {
    if (!facultyId) return "Unknown Faculty";

    if (facultyNameCache[facultyId]) {
        return facultyNameCache[facultyId];
    }

    try {
        const snapshot = await getDoc(
            doc(db, "users", facultyId)
        );

        if (!snapshot.exists()) {
            return "Unknown Faculty";
        }

        const data = snapshot.data();

        const name =
            data.fullname ||
            data.name ||
            data.email ||
            "Unknown Faculty";

        facultyNameCache[facultyId] = name;

        return name;

    } catch (error) {
        console.error("Error loading faculty:", error);
        return "Unknown Faculty";
    }
}

/* =====================================================
   LOAD AND GROUP EXAMS
   NEWEST EXAMS FIRST
===================================================== */

async function loadExams() {
    const examList = document.getElementById("examList");

    if (!activeAcademicYear) return;

    editingQuestions.clear();

    if (examList) {
        examList.innerHTML = `
            <div class="admin-empty">
                <h2>Loading Exams...</h2>
                <p>Please wait.</p>
            </div>
        `;
    }

    try {
        const examQuery = query(
            collection(db, "questionBank"),
            where("academicYear", "==", activeAcademicYear),
            orderBy("createdAt", "desc")
        );

        let snapshot;

        try {
            snapshot = await getDocs(examQuery);
        } catch (indexError) {
            console.warn(
                "Ordered exam query failed. Trying without ordering:",
                indexError
            );

            const fallbackQuery = query(
                collection(db, "questionBank"),
                where("academicYear", "==", activeAcademicYear)
            );

            snapshot = await getDocs(fallbackQuery);
        }

        const examMap = new Map();

        snapshot.forEach(questionDoc => {
            const data = questionDoc.data();

            const title = String(
                data.examTitle || data.title || "Untitled Exam"
            ).trim();

            const specialization = String(
                data.specialization || "No Specialization"
            ).trim();

            const key = `${specialization}|||${title}`;

            if (!examMap.has(key)) {
                examMap.set(key, {
                    key,
                    title,
                    specialization,
                    academicYear:
                        data.academicYear || activeAcademicYear,

                    facultyId:
                        data.facultyId ||
                        data.facultyID ||
                        data.createdBy ||
                        "",

                    status: "ready",
                    scheduledStartAt: data.scheduledStartAt || null,
                    scheduledEndAt: data.scheduledEndAt || null,
                    maxAttempts: Number(data.maxAttempts) || 1,

                    allowBackNavigation:
                        data.allowBackNavigation ?? false,

                    randomizeQuestions:
                        data.randomizeQuestions ?? true,

                    randomizeChoices:
                        data.randomizeChoices ?? true,

                    tabSwitchPolicy:
                        data.tabSwitchPolicy || "warn",

                    autoSubmitOnExpiry:
                        data.autoSubmitOnExpiry ?? true,

                    type: data.type || "Multiple Choice",
                    createdAt: data.createdAt || null,
                    questions: [],
                    questionIds: []
                });
            }

            const exam = examMap.get(key);

            exam.questions.push({
                id: questionDoc.id,
                question: data.question || "",
                choices: getQuestionChoices(data),
                choiceFormat: detectChoiceFormat(data),
                correctAnswer: data.correctAnswer || "",
                status: data.status || "ready"
            });

            exam.questionIds.push(questionDoc.id);

            if (data.status === "administered") {
                exam.status = "administered";
            }

            if (data.scheduledStartAt) {
                exam.scheduledStartAt = data.scheduledStartAt;
            }

            if (data.scheduledEndAt) {
                exam.scheduledEndAt = data.scheduledEndAt;
            }

            if (
                data.createdAt &&
                (
                    !exam.createdAt ||
                    getTimestampMilliseconds(data.createdAt) >
                    getTimestampMilliseconds(exam.createdAt)
                )
            ) {
                exam.createdAt = data.createdAt;
            }
        });

        allExams = [...examMap.values()].sort((a, b) => {
            return (
                getTimestampMilliseconds(b.createdAt) -
                getTimestampMilliseconds(a.createdAt)
            );
        });

        await renderExamList();

        // Exams whose end date/time already passed are stopped now.
        await autoStopExpiredExams();

    } catch (error) {
        console.error("Error loading exams:", error);

        if (examList) {
            examList.innerHTML = `
                <div class="admin-empty">
                    <h2>Unable to Load Exams</h2>
                    <p>Check your Firestore rules and connection.</p>
                </div>
            `;
        }

        showNotification(
            "Unable to load exams for the active academic year.",
            "error"
        );
    }
}

/* =====================================================
   RENDER EXAMS BY SPECIALIZATION
===================================================== */

async function renderExamList() {
    const examList = document.getElementById("examList");

    if (!examList) return;

    if (!allExams.length) {
        examList.innerHTML = `
            <div class="admin-empty">
                <h2>No Exams Available</h2>
                <p>No exams have been created for this academic year.</p>
            </div>
        `;
        return;
    }

    const columnsMap = new Map();

    for (const exam of allExams) {
        const specialization = exam.specialization || "General";

        if (!columnsMap.has(specialization)) {
            columnsMap.set(specialization, []);
        }

        columnsMap.get(specialization).push(exam);
    }

    examList.innerHTML = "";

    const container = document.createElement("div");
    container.className = "admin-columns-container";

    for (const [specialization, exams] of columnsMap.entries()) {
        const columnDiv = document.createElement("div");
        columnDiv.className = "admin-category-column";

        const headerDiv = document.createElement("div");
        headerDiv.className = "admin-category-header";

        // Full name on hover, in case a long name is shortened.
        headerDiv.title = specialization;

        headerDiv.innerHTML = `
            <span>* ${escapeHTML(specialization)}</span>
            <span class="admin-category-count">${exams.length}</span>
        `;

        columnDiv.appendChild(headerDiv);

        const listDiv = document.createElement("div");
        listDiv.className = "admin-category-exams-list";

        for (const exam of exams) {
            const globalIndex = allExams.indexOf(exam);
            const facultyName = await getFacultyName(exam.facultyId);
            const administered = exam.status === "administered";

            const card = document.createElement("div");
            card.className = "admin-exam-card";

            card.innerHTML = `
                <div class="exam-card-top">
                    <div>
                        <h2 class="exam-title">
                            ${escapeHTML(exam.title)}
                        </h2>

                        <div class="exam-faculty">
                            Created by:
                            <strong>${escapeHTML(facultyName)}</strong>
                        </div>
                    </div>

                    <span class="exam-status ${administered ? "administered" : "ready"}">
                        ${administered ? "Administered" : "Ready"}
                    </span>
                </div>

                <div class="exam-meta">
                    <div>
                        <strong>Academic Year</strong>
                        <span>${escapeHTML(exam.academicYear)}</span>
                    </div>

                    <div>
                        <strong>Type</strong>
                        <span>${escapeHTML(exam.type)}</span>
                    </div>

                    <div>
                        <strong>Questions</strong>
                        <span id="question-count-${globalIndex}">${exam.questions.length}</span>
                    </div>
                </div>

                <section class="admin-rule-settings">
                    <h4>📅 Availability</h4>

                    <div class="admin-rule-grid">
                        <div>
                            <label for="adminStartAt-${globalIndex}">
                                Start
                            </label>

                            <input
                                type="datetime-local"
                                id="adminStartAt-${globalIndex}"
                                value="${escapeHTML(getLocalDateTimeValue(exam.scheduledStartAt))}"
                            >
                        </div>

                        <div>
                            <label for="adminEndAt-${globalIndex}">
                                End
                            </label>

                            <input
                                type="datetime-local"
                                id="adminEndAt-${globalIndex}"
                                value="${escapeHTML(getLocalDateTimeValue(exam.scheduledEndAt))}"
                            >
                        </div>

                    </div>

                    <p style="margin:10px 0 0;font-size:11px;
                        color:#5f6368;line-height:1.4;">
                        Students can only start the exam between these
                        dates. Each question is timed at 30 seconds in the
                        exam itself.
                    </p>
                </section>

                <button
                    type="button"
                    class="check-questions-btn"
                    onclick="toggleQuestions(${globalIndex})">
                    Check Questions
                </button>

                <div
                    class="questions-panel"
                    id="questions-${globalIndex}"
                    style="display:none;">
                </div>

                <div class="admin-exam-actions">
                    ${
                        administered
                            ? `
                                <button
                                    type="button"
                                    class="stop-administer-btn"
                                    onclick="stopAdministration(${globalIndex})">
                                    Stop Administration
                                </button>
                            `
                            : `
                                <button
                                    type="button"
                                    class="administer-exam-btn"
                                    onclick="administerExam(${globalIndex})">
                                    Administer Exam
                                </button>
                            `
                    }
                </div>
            `;

            listDiv.appendChild(card);
        }

        columnDiv.appendChild(listDiv);
        container.appendChild(columnDiv);
    }

    examList.appendChild(container);
}

/* =====================================================
   ADMINISTER EXAM
===================================================== */

async function administerExam(examIndex) {
    const exam = allExams[examIndex];

    if (!exam) return;

    if (!exam.questions.length) {
        await appAlert(
            "This exam has no questions.",
            { type: "warning" }
        );
        return;
    }

    const startInput = document.getElementById(
        `adminStartAt-${examIndex}`
    );

    const endInput = document.getElementById(
        `adminEndAt-${examIndex}`
    );

    const startValue = startInput?.value;
    const endValue = endInput?.value;

    if (!startValue || !endValue) {
        await appAlert(
            "Please select both the start and end date/time.",
            { type: "warning" }
        );
        return;
    }

    const startDate = new Date(startValue);
    const endDate = new Date(endValue);

    if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
    ) {
        await appAlert(
            "Please enter valid scheduling dates.",
            { type: "warning" }
        );
        return;
    }

    if (endDate <= startDate) {
        await appAlert(
            "The end date/time must be later than the start date/time.",
            { type: "warning" }
        );
        return;
    }

    const confirmed = await appConfirm(
        `Administer "${exam.title}" for ${exam.specialization}?\n\n` +
        `Opens: ${startDate.toLocaleString()}\n` +
        `Closes: ${endDate.toLocaleString()}`,
        {
            title: "Administer Exam",
            confirmText: "Administer",
            type: "question"
        }
    );

    if (!confirmed) return;

    try {
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const questionId of exam.questionIds) {
            batch.update(
                doc(db, "questionBank", questionId),
                {
                    status: "administered",
                    scheduledStartAt: startDate,
                    scheduledEndAt: endDate,
                    maxAttempts: 1,
                    allowBackNavigation: false,
                    randomizeQuestions: true,
                    randomizeChoices: true,
                    tabSwitchPolicy: "warn",
                    autoSubmitOnExpiry: true,
                    administeredBy: currentAdminUid,
                    administeredAt: serverTimestamp(),
                    autoStoppedAt: deleteField()
                }
            );

            operationCount++;

            if (operationCount === 450) {
                await batch.commit();

                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        showNotification(
            `"${exam.title}" was administered successfully.`,
            "success"
        );

        await loadExams();

    } catch (error) {
        console.error("Error administering exam:", error);

        showNotification(
            "Failed to administer the exam. Check Firestore permissions.",
            "error"
        );
    }
}

/* =====================================================
   STOP ADMINISTRATION
===================================================== */

async function stopAdministration(examIndex) {
    const exam = allExams[examIndex];

    if (!exam) return;

    const confirmed = await appConfirm(
        `Stop administration of "${exam.title}"?\n\n` +
        "Students will no longer be allowed to start this exam.",
        {
            title: "Stop Administration",
            confirmText: "Stop",
            type: "warning",
            danger: true
        }
    );

    if (!confirmed) return;

    try {
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const questionId of exam.questionIds) {
            batch.update(
                doc(db, "questionBank", questionId),
                {
                    status: "ready",
                    scheduledStartAt: deleteField(),
                    scheduledEndAt: deleteField(),
                    administeredBy: deleteField(),
                    administeredAt: deleteField(),
                    durationMinutes: deleteField(),
                    secondsPerQuestion: deleteField(),
                    allowBackNavigation: false,
                    randomizeQuestions: true,
                    randomizeChoices: true,
                    tabSwitchPolicy: "warn",
                    autoSubmitOnExpiry: true
                }
            );

            operationCount++;

            if (operationCount === 450) {
                await batch.commit();

                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        showNotification(
            "Exam administration has been stopped.",
            "success"
        );

        await loadExams();

    } catch (error) {
        console.error("Error stopping exam:", error);

        showNotification(
            "Failed to stop exam administration.",
            "error"
        );
    }
}

/* =====================================================
   AUTOMATIC STOP WHEN THE END DATE/TIME IS REACHED
   An administered exam whose end date/time has passed is
   switched back to "ready" (same as pressing Stop
   Administration). The schedule dates are kept so you can
   still see when it ran.
===================================================== */

let autoStopRunning = false;

async function autoStopExpiredExams() {
    if (autoStopRunning || !allExams.length) return;

    const now = Date.now();

    const expired = allExams.filter(exam => {
        if (exam.status !== "administered") return false;

        const endMs = getTimestampMilliseconds(exam.scheduledEndAt);

        return endMs > 0 && endMs <= now;
    });

    if (!expired.length) return;

    autoStopRunning = true;

    try {
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const exam of expired) {
            for (const questionId of exam.questionIds) {
                batch.update(
                    doc(db, "questionBank", questionId),
                    {
                        status: "ready",
                        autoStoppedAt: serverTimestamp()
                    }
                );

                operationCount++;

                if (operationCount === 450) {
                    await batch.commit();

                    batch = writeBatch(db);
                    operationCount = 0;
                }
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        const names = expired
            .map(exam => `"${exam.title}"`)
            .join(", ");

        showNotification(
            `${names} reached its end date/time and was stopped automatically.`,
            "info"
        );

        await loadExams();

    } catch (error) {
        console.error("Error stopping expired exams:", error);

    } finally {
        autoStopRunning = false;
    }
}

/* =====================================================
   QUESTION PREVIEW + EDITING + DELETING
===================================================== */

function editKey(examIndex, questionIndex) {
    return `${examIndex}:${questionIndex}`;
}

function toggleQuestions(examIndex) {
    const panel = document.getElementById(
        `questions-${examIndex}`
    );

    if (!panel) return;

    if (
        panel.style.display === "none" ||
        !panel.style.display
    ) {
        renderQuestions(examIndex);
        panel.style.display = "block";
    } else {
        panel.style.display = "none";
    }
}

function renderQuestions(examIndex) {
    const panel = document.getElementById(
        `questions-${examIndex}`
    );

    const exam = allExams[examIndex];

    if (!panel || !exam) return;

    if (!exam.questions.length) {
        panel.innerHTML = `
            <div class="no-questions">
                No questions available.
            </div>
        `;
        return;
    }

    const letters = ["A", "B", "C", "D"];

    panel.innerHTML = exam.questions.map((question, index) => {
        const choices = question.choices || {};
        const correctLetter = resolveCorrectLetter(question);
        const isEditing = editingQuestions.has(editKey(examIndex, index));

        /* ---------- EDIT MODE ---------- */

        if (isEditing) {
            return `
                <div class="question-panel" style="border-color:#8ec6d1;">
                    <div class="question-panel-header">
                        <div class="question-number">
                            Question ${index + 1} (editing)
                        </div>
                    </div>

                    <label style="display:block;font-size:12px;
                        color:#5f6368;margin-bottom:4px;">
                        Question
                    </label>

                    <textarea
                        id="editQuestionText-${examIndex}-${index}"
                        rows="3"
                        style="width:100%;box-sizing:border-box;padding:10px;
                            border:1px solid #dadce0;border-radius:8px;
                            font-family:inherit;font-size:14px;"
                    >${escapeHTML(question.question)}</textarea>

                    <label style="display:block;font-size:12px;
                        color:#5f6368;margin:12px 0 6px;">
                        Choices (select the correct answer)
                    </label>

                    <div style="display:grid;gap:8px;">
                        ${letters.map(letter => `
                            <div style="display:flex;align-items:center;gap:8px;">
                                <input
                                    type="radio"
                                    name="editCorrect-${examIndex}-${index}"
                                    value="${letter}"
                                    ${correctLetter === letter ? "checked" : ""}
                                    title="Mark ${letter} as the correct answer"
                                    style="accent-color:#137333;width:17px;height:17px;"
                                >

                                <strong style="width:18px;">${letter}</strong>

                                <input
                                    type="text"
                                    id="editChoice-${letter}-${examIndex}-${index}"
                                    value="${escapeHTML(choices[letter])}"
                                    style="flex:1;padding:8px 10px;
                                        border:1px solid #dadce0;
                                        border-radius:8px;font-size:13px;
                                        box-sizing:border-box;"
                                >
                            </div>
                        `).join("")}
                    </div>

                    <div style="display:flex;gap:8px;margin-top:14px;">
                        <button
                            type="button"
                            onclick="cancelQuestionEdit(${examIndex}, ${index})"
                            style="flex:1;padding:9px;border:1px solid #dadce0;
                                border-radius:8px;background:#fff;
                                font-weight:600;cursor:pointer;">
                            Cancel
                        </button>

                        <button
                            type="button"
                            id="saveEditBtn-${examIndex}-${index}"
                            onclick="saveQuestionEdit(${examIndex}, ${index})"
                            style="flex:1;padding:9px;border:0;
                                border-radius:8px;background:#137333;
                                color:#fff;font-weight:700;cursor:pointer;">
                            Save Changes
                        </button>
                    </div>
                </div>
            `;
        }

        /* ---------- VIEW MODE ---------- */

        return `
            <div class="question-panel">
                <div class="question-panel-header">
                    <div class="question-number">
                        Question ${index + 1}
                    </div>

                    <div style="display:flex;gap:6px;">
                        <button
                            type="button"
                            onclick="startQuestionEdit(${examIndex}, ${index})"
                            style="border:1px solid #dadce0;border-radius:8px;
                                background:#fff;padding:5px 12px;font-size:12px;
                                font-weight:600;cursor:pointer;">
                             Edit
                        </button>

                        <button
                            type="button"
                            onclick="deleteQuestion(${examIndex}, ${index})"
                            style="border:1px solid #f1c4c0;border-radius:8px;
                                background:#fff5f4;color:#b31412;
                                padding:5px 12px;font-size:12px;
                                font-weight:600;cursor:pointer;">
                             Delete
                        </button>
                    </div>
                </div>

                <div class="student-question-box">
                    <div class="question-text">
                        ${escapeHTML(question.question)}
                    </div>

                    <div class="choices-list">
                        ${letters.map(letter => `
                            <div
                                class="student-choice ${
                                    correctLetter === letter
                                        ? "correct-choice"
                                        : ""
                                }">

                                <div class="choice-circle">
                                    ${letter}
                                </div>

                                <div class="choice-text">
                                    ${escapeHTML(choices[letter])}
                                </div>
                            </div>
                        `).join("")}
                    </div>

                    <p class="admin-answer-key">
                        Correct answer:
                        <strong>
                            ${escapeHTML(correctLetter || "Not identified")}
                        </strong>
                    </p>
                </div>
            </div>
        `;
    }).join("");
}

function startQuestionEdit(examIndex, questionIndex) {
    editingQuestions.add(editKey(examIndex, questionIndex));
    renderQuestions(examIndex);
}

function cancelQuestionEdit(examIndex, questionIndex) {
    editingQuestions.delete(editKey(examIndex, questionIndex));
    renderQuestions(examIndex);
}

async function saveQuestionEdit(examIndex, questionIndex) {
    const exam = allExams[examIndex];
    const question = exam?.questions[questionIndex];

    if (!exam || !question) return;

    const letters = ["A", "B", "C", "D"];

    const text = document.getElementById(
        `editQuestionText-${examIndex}-${questionIndex}`
    )?.value.trim() || "";

    const choices = {};

    for (const letter of letters) {
        choices[letter] = document.getElementById(
            `editChoice-${letter}-${examIndex}-${questionIndex}`
        )?.value.trim() || "";
    }

    const selected = document.querySelector(
        `input[name="editCorrect-${examIndex}-${questionIndex}"]:checked`
    )?.value || "";

    /* ---------- validation ---------- */

    if (!text) {
        await appAlert(
            "The question text cannot be empty.",
            { type: "warning" }
        );
        return;
    }

    if (letters.some(letter => !choices[letter])) {
        await appAlert(
            "All four choices (A to D) must be filled in.",
            { type: "warning" }
        );
        return;
    }

    const lowered = letters.map(letter => choices[letter].toLowerCase());

    if (new Set(lowered).size !== lowered.length) {
        await appAlert(
            "Two or more choices are identical. Each choice must be different.",
            { type: "warning" }
        );
        return;
    }

    if (!selected) {
        await appAlert(
            "Select which choice is the correct answer.",
            { type: "warning" }
        );
        return;
    }

    /* ---------- extra care for a live exam ---------- */

    if (exam.status === "administered") {
        const proceed = await appConfirm(
            "This exam is currently administered.\n\n" +
            "Your changes apply to students who take the exam from now on. " +
            "Results that were already submitted are not regraded.\n\n" +
            "Save the changes?",
            {
                title: "Edit Administered Question",
                confirmText: "Save Changes",
                type: "warning"
            }
        );

        if (!proceed) return;
    }

    const saveButton = document.getElementById(
        `saveEditBtn-${examIndex}-${questionIndex}`
    );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    // Keep the stored answer style: letter ("B") or the answer text.
    const answerWasLetter =
        !question.correctAnswer ||
        /^[A-D]$/i.test(String(question.correctAnswer).trim());

    const correctAnswer = answerWasLetter
        ? selected
        : choices[selected];

    try {
        await updateDoc(
            doc(db, "questionBank", question.id),
            {
                question: text,
                ...buildChoicePayload(question.choiceFormat, choices),
                correctAnswer,
                lastEditedBy: currentAdminUid,
                lastEditedAt: serverTimestamp()
            }
        );

        question.question = text;
        question.choices = choices;
        question.correctAnswer = correctAnswer;

        editingQuestions.delete(editKey(examIndex, questionIndex));
        renderQuestions(examIndex);

        showNotification(
            `Question ${questionIndex + 1} was updated.`,
            "success"
        );

    } catch (error) {
        console.error("Error saving question:", error);

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
        }

        await appAlert(
            "Unable to save the question. Check your connection and Firestore permissions.",
            { type: "error" }
        );
    }
}

/* =====================================================
   DELETE A QUESTION
===================================================== */

async function deleteQuestion(examIndex, questionIndex) {
    const exam = allExams[examIndex];
    const question = exam?.questions[questionIndex];

    if (!exam || !question) return;

    const fullText = String(question.question || "").trim();

    const preview = fullText.length > 120
        ? fullText.slice(0, 120) + "…"
        : fullText;

    const isLastQuestion = exam.questions.length === 1;

    let message =
        `Delete question ${questionIndex + 1}?\n\n` +
        `"${preview}"\n\n` +
        "This cannot be undone.";

    if (exam.status === "administered") {
        message +=
            "\n\nThis exam is currently administered. Students who " +
            "take the exam from now on will no longer get this " +
            "question. Results that were already submitted are not " +
            "changed.";
    }

    if (isLastQuestion) {
        message +=
            "\n\nThis is the last question, so the whole exam will " +
            "be removed from the list.";
    }

    const confirmed = await appConfirm(message, {
        title: "Delete Question",
        confirmText: "Delete",
        type: "warning",
        danger: true
    });

    if (!confirmed) return;

    try {
        await deleteDoc(
            doc(db, "questionBank", question.id)
        );

        exam.questions.splice(questionIndex, 1);

        exam.questionIds = exam.questionIds.filter(
            id => id !== question.id
        );

        // Edit mode is tracked by position, and the positions have
        // just moved, so close any open editors of this exam.
        for (const key of [...editingQuestions]) {
            if (key.startsWith(`${examIndex}:`)) {
                editingQuestions.delete(key);
            }
        }

        showNotification(
            "The question was deleted.",
            "success"
        );

        // No questions left: the exam no longer exists.
        if (exam.questions.length === 0) {
            await loadExams();
            return;
        }

        renderQuestions(examIndex);

        const countElement = document.getElementById(
            `question-count-${examIndex}`
        );

        if (countElement) {
            countElement.textContent = String(exam.questions.length);
        }

    } catch (error) {
        console.error("Error deleting question:", error);

        await appAlert(
            "Unable to delete the question. Check your connection and Firestore permissions.",
            { type: "error" }
        );
    }
}

/* =====================================================
   SPECIALIZATIONS
===================================================== */

async function loadAdminSpecializations() {
    const select = document.getElementById(
        "adminSpecializationSelect"
    );

    if (!select) return;

    try {
        const snapshot = await getDocs(
            collection(db, "specializations")
        );

        const names = new Set();

        snapshot.forEach(specializationDoc => {
            const data = specializationDoc.data();

            if (data.name) {
                names.add(String(data.name).trim());
            }
        });

        select.innerHTML = `
            <option value="">Select Specialization</option>
            ${
                [...names]
                    .sort((a, b) => a.localeCompare(b))
                    .map(name => `
                        <option value="${escapeHTML(name)}">
                            ${escapeHTML(name)}
                        </option>
                    `)
                    .join("")
            }
        `;

    } catch (error) {
        console.error("Error loading specializations:", error);

        select.innerHTML = `
            <option value="">Unable to load specializations</option>
        `;

        showNotification(
            "Unable to load specializations from Firestore.",
            "error"
        );
    }
}

/* =====================================================
   PDF TEXT EXTRACTION
===================================================== */

async function extractPDFText(file) {
    if (!window.pdfjsLib) {
        throw new Error(
            "PDF.js is unavailable. Check the PDF.js script in your HTML."
        );
    }

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer)
    }).promise;

    const pages = [];

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        let lastY = null;
        let lineText = "";
        const lineTexts = [];

        for (const item of content.items) {
            const currentY = item.transform[5];

            if (
                lastY !== null &&
                Math.abs(currentY - lastY) > 5
            ) {
                if (lineText.trim()) {
                    lineTexts.push(lineText.trim());
                }

                lineText = "";
            }

            lineText += (lineText ? " " : "") + item.str;
            lastY = currentY;
        }

        if (lineText.trim()) {
            lineTexts.push(lineText.trim());
        }

        pages.push(lineTexts.join("\n"));
    }

    return pages.join("\n");
}

/* =====================================================
   EXAM QUESTION PARSER
   EXPECTED FORMAT:
   1. Question text
   A. Choice A
   B. Choice B
   C. Choice C
   D. Choice D
===================================================== */

function parseExamQuestions(text) {
    const lines = String(text || "")
        .replace(/\r/g, "\n")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const questions = [];

    let currentQ = null;
    let currentChoices = {
        A: "",
        B: "",
        C: "",
        D: ""
    };

    let activeChoice = null;

    function saveCurrentQuestion() {
        if (!currentQ || !currentQ.text.trim()) return;

        const hasChoices = ["A", "B", "C", "D"].some(
            letter => currentChoices[letter].trim()
        );

        if (!hasChoices) return;

        questions.push({
            questionNumber: currentQ.num,
            question: currentQ.text.trim(),
            choices: {
                A: currentChoices.A.trim(),
                B: currentChoices.B.trim(),
                C: currentChoices.C.trim(),
                D: currentChoices.D.trim()
            }
        });
    }

    for (const line of lines) {
        const questionMatch = line.match(
            /^(\d{1,3})[.)]\s*(.*)$/
        );

        if (questionMatch) {
            saveCurrentQuestion();

            currentQ = {
                num: Number(questionMatch[1]),
                text: questionMatch[2]
            };

            currentChoices = {
                A: "",
                B: "",
                C: "",
                D: ""
            };

            activeChoice = null;
            continue;
        }

        const choiceMatch = line.match(
            /^([A-D])[.)]\s*(.*)$/i
        );

        if (choiceMatch && currentQ) {
            const letter = choiceMatch[1].toUpperCase();

            activeChoice = letter;
            currentChoices[letter] = choiceMatch[2];

            continue;
        }

        if (currentQ) {
            if (activeChoice) {
                currentChoices[activeChoice] +=
                    (currentChoices[activeChoice] ? " " : "") + line;
            } else {
                currentQ.text +=
                    (currentQ.text ? " " : "") + line;
            }
        }
    }

    saveCurrentQuestion();

    return questions;
}

/* =====================================================
   ANSWER KEY PARSER
   EXPECTED FORMAT:
   1. A
   2. C
   3. B
===================================================== */

function parseAnswerKey(text) {
    const answers = {};

    const lines = String(text || "")
        .replace(/\r/g, "\n")
        .split("\n");

    for (const line of lines) {
        const match = line.match(
            /^\s*(\d{1,3})\s*[.):\-]\s*([A-D])\b/i
        );

        if (match) {
            answers[Number(match[1])] = match[2].toUpperCase();
        }
    }

    if (!Object.keys(answers).length) {
        const regex =
            /(?:^|\s)(\d{1,3})\s*[.):\-]\s*([A-D])\b/gi;

        let match;

        while (
            (match = regex.exec(String(text || ""))) !== null
        ) {
            answers[Number(match[1])] = match[2].toUpperCase();
        }
    }

    return answers;
}

/* =====================================================
   PDF UPLOAD UI HANDLERS
===================================================== */

function setupFilePicker({
    dropAreaId,
    inputId,
    statusId,
    onFile
}) {
    const dropArea = document.getElementById(dropAreaId);
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);

    if (!dropArea || !input) return;

    dropArea.addEventListener("click", event => {
        if (event.target.closest("input, button, label")) {
            return;
        }

        input.click();
    });

    input.addEventListener("change", () => {
        const file = input.files?.[0];

        if (!file) return;

        const isPDF =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPDF) {
            if (status) {
                status.textContent = "Please select a PDF file.";
                status.className = "admin-file-status error";
            }

            input.value = "";
            onFile(null);
            return;
        }

        onFile(file);

        if (status) {
            status.textContent = `Selected: ${file.name}`;
            status.className = "admin-file-status success";
        }
    });

    dropArea.addEventListener("dragover", event => {
        event.preventDefault();
        dropArea.classList.add("drag-over");
    });

    dropArea.addEventListener("dragleave", event => {
        if (!dropArea.contains(event.relatedTarget)) {
            dropArea.classList.remove("drag-over");
        }
    });

    dropArea.addEventListener("drop", event => {
        event.preventDefault();
        dropArea.classList.remove("drag-over");

        const file = event.dataTransfer?.files?.[0];

        if (!file) return;

        const isPDF =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPDF) {
            if (status) {
                status.textContent = "Please drop a PDF file.";
                status.className = "admin-file-status error";
            }

            onFile(null);
            input.value = "";
            return;
        }

        onFile(file);

        // Allow the submit handler to use the selected File object
        // even when the file was supplied by drag and drop.
        try {
            const transfer = new DataTransfer();
            transfer.items.add(file);
            input.files = transfer.files;
        } catch (error) {
            console.warn("Could not update file input from drop:", error);
        }

        if (status) {
            status.textContent = `Selected: ${file.name}`;
            status.className = "admin-file-status success";
        }
    });
}

function setupAdminPDFUpload() {
    const specializationSelect = document.getElementById(
        "adminSpecializationSelect"
    );

    const uploadFields = document.getElementById(
        "adminUploadFields"
    );

    specializationSelect?.addEventListener("change", () => {
        if (uploadFields) {
            uploadFields.hidden = !specializationSelect.value;
        }
    });

    setupFilePicker({
        dropAreaId: "adminDropArea",
        inputId: "adminFileInput",
        statusId: "adminUploadStatus",

        onFile: file => {
            adminExamPDF = file;
        }
    });

    setupFilePicker({
        dropAreaId: "adminAnswerDropArea",
        inputId: "adminAnswerFileInput",
        statusId: "adminAnswerStatus",

        onFile: file => {
            adminAnswerPDF = file;
        }
    });

    document.getElementById("adminSubmitExamBtn")
        ?.addEventListener("click", submitAdminExam);
}

/* =====================================================
   SUBMIT ADMIN-CREATED EXAM
===================================================== */

async function submitAdminExam() {
    if (adminUploadBusy) return;

    const titleInput =
        document.getElementById("adminExamTitle") ||
        document.getElementById("examTitleInput");

    const title = titleInput?.value.trim();

    const specialization = document.getElementById(
        "adminSpecializationSelect"
    )?.value;

    if (!title) {
        showNotification("Enter an exam title.", "error");
        return;
    }

    if (!specialization) {
        showNotification("Select a specialization.", "error");
        return;
    }

    if (!activeAcademicYear) {
        showNotification(
            "There is no active academic year.",
            "error"
        );
        return;
    }

    if (!adminExamPDF || !adminAnswerPDF) {
        showNotification(
            "Upload both the examination PDF and answer key PDF.",
            "error"
        );
        return;
    }

    const button = document.getElementById("adminSubmitExamBtn");

    adminUploadBusy = true;

    if (button) {
        button.disabled = true;
        button.textContent = "Reading PDFs...";
    }

    try {
        const [examText, answerText] = await Promise.all([
            extractPDFText(adminExamPDF),
            extractPDFText(adminAnswerPDF)
        ]);

        const parsedQuestions = parseExamQuestions(examText);
        const answerKey = parseAnswerKey(answerText);

        if (!parsedQuestions.length) {
            throw new Error(
                "No numbered A–D multiple-choice questions were detected. Check your PDF format."
            );
        }

        const missingAnswers = parsedQuestions.filter(
            question => !answerKey[question.questionNumber]
        );

        if (missingAnswers.length) {
            throw new Error(
                `Missing answer key for question(s): ${
                    missingAnswers
                        .map(question => question.questionNumber)
                        .join(", ")
                }.`
            );
        }

        const incompleteQuestions = parsedQuestions.filter(
            question =>
                !question.choices.A ||
                !question.choices.B ||
                !question.choices.C ||
                !question.choices.D
        );

        if (incompleteQuestions.length) {
            throw new Error(
                `Question(s) ${incompleteQuestions
                    .map(question => question.questionNumber)
                    .join(", ")} are missing one or more choices.`
            );
        }

        const confirmed = await appConfirm(
            `Save "${title}"?\n\n` +
            `Specialization: ${specialization}\n` +
            `Questions detected: ${parsedQuestions.length}\n\n` +
            "The exam will remain unavailable to students until you administer it.",
            {
                title: "Save Exam",
                confirmText: "Save Exam",
                type: "question"
            }
        );

        if (!confirmed) return;

        let batch = writeBatch(db);
        let operationCount = 0;
        let savedCount = 0;

        for (const question of parsedQuestions) {
            const questionRef = doc(
                collection(db, "questionBank")
            );

            batch.set(questionRef, {
                examTitle: title,
                title,
                specialization,

                academicYear: activeAcademicYear,
                academicYearId: activeAcademicYearId,

                question: question.question,
                choices: question.choices,
                correctAnswer: answerKey[question.questionNumber],

                type: "Multiple Choice",
                status: "ready",

                facultyId: currentAdminUid,
                createdBy: currentAdminUid,
                createdByRole: "admin",
                createdAt: serverTimestamp(),

                allowBackNavigation: false,
                randomizeQuestions: true,
                randomizeChoices: true,
                maxAttempts: 1,
                tabSwitchPolicy: "warn",
                autoSubmitOnExpiry: true
            });

            operationCount++;
            savedCount++;

            if (operationCount === 450) {
                await batch.commit();

                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        adminExamPDF = null;
        adminAnswerPDF = null;

        if (titleInput) {
            titleInput.value = "";
        }

        const fileInput = document.getElementById("adminFileInput");
        const answerFileInput = document.getElementById(
            "adminAnswerFileInput"
        );

        if (fileInput) fileInput.value = "";
        if (answerFileInput) answerFileInput.value = "";

        const uploadStatus = document.getElementById(
            "adminUploadStatus"
        );

        const answerStatus = document.getElementById(
            "adminAnswerStatus"
        );

        if (uploadStatus) {
            uploadStatus.textContent = "";
            uploadStatus.className = "admin-file-status";
        }

        if (answerStatus) {
            answerStatus.textContent = "";
            answerStatus.className = "admin-file-status";
        }

        showNotification(
            `Exam saved successfully. ${savedCount} questions were added. Administer the exam to make it available.`,
            "success"
        );

        await loadExams();

    } catch (error) {
        console.error("Error submitting admin exam:", error);

        showNotification(
            error.message || "Unable to save the exam.",
            "error"
        );

    } finally {
        adminUploadBusy = false;

        if (button) {
            button.disabled = false;
            button.textContent = "Submit Exam";
        }
    }
}

/* =====================================================
   LOGOUT
===================================================== */

async function logout() {
    try {
        await signOut(auth);
        window.location.replace("../login.html");

    } catch (error) {
        console.error("Logout error:", error);

        await appAlert(
            "Unable to log out. Please try again.",
            { type: "error" }
        );
    }
}

/* =====================================================
   GLOBAL FUNCTIONS FOR HTML BUTTONS
===================================================== */

window.toggleQuestions = toggleQuestions;
window.startQuestionEdit = startQuestionEdit;
window.cancelQuestionEdit = cancelQuestionEdit;
window.saveQuestionEdit = saveQuestionEdit;
window.deleteQuestion = deleteQuestion;
window.administerExam = administerExam;
window.stopAdministration = stopAdministration;
window.logout = logout;

/* =====================================================
   INITIALIZE PDF UPLOAD HANDLERS
===================================================== */

setupAdminPDFUpload();

/* =====================================================
   KEEP CHECKING WHILE THE PAGE IS OPEN
===================================================== */

setInterval(autoStopExpiredExams, 30000);

document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        autoStopExpiredExams();
    }
});
