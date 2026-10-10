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
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentAdminUid = "";
let activeAcademicYear = "";

let allExams = [];

let editingQuestionId = null;
let openedExamKey = null;

/* Admin PDF upload variables */
let adminExtractedQuestions = [];
let adminExtractedAnswers = {};
let adminExamPDF = null;
let adminAnswerPDF = null;
let adminUploadBusy = false;

/* Timer used to auto-hide the upload notification */
let adminNotificationTimer = null;


/* =====================================================
   FACULTY NAME CACHE
===================================================== */

const facultyNameCache = {};


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =====================================================
   GET FACULTY NAME
===================================================== */

async function getFacultyName(facultyId) {

    if (!facultyId) {
        return "Unknown Faculty";
    }

    if (facultyNameCache[facultyId]) {
        return facultyNameCache[facultyId];
    }

    try {

        const facultyRef = doc(db, "users", facultyId);
        const facultySnap = await getDoc(facultyRef);

        if (!facultySnap.exists()) {
            facultyNameCache[facultyId] = "Unknown Faculty";
            return "Unknown Faculty";
        }

        const facultyData = facultySnap.data();

        const facultyName =
            facultyData.fullname ||
            facultyData.name ||
            facultyData.email ||
            "Unknown Faculty";

        facultyNameCache[facultyId] = facultyName;

        return facultyName;

    } catch (error) {

        console.error("Error loading faculty name:", error);

        return "Unknown Faculty";
    }
}


/* =====================================================
   AUTH
===================================================== */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        window.location.replace("../login.html");
        return;
    }

    currentAdminUid = user.uid;

    await loadAdminSpecializations();
    await loadActiveAcademicYear();

});


/* =====================================================
   ACTIVE ACADEMIC YEAR
===================================================== */

async function loadActiveAcademicYear() {

    try {

        const yearQuery = query(
            collection(db, "academicYears"),
            where("active", "==", true)
        );

        const snapshot = await getDocs(yearQuery);

        if (snapshot.empty) {

            activeAcademicYear = "";

            const yearElement =
                document.getElementById("activeAcademicYear");

            if (yearElement) {
                yearElement.textContent = "No active academic year";
            }

            const examList = document.getElementById("examList");

            if (examList) {
                examList.innerHTML = `
                    <div class="admin-empty">
                        <h2>No Active Academic Year</h2>
                        <p>Please set an active academic year first.</p>
                    </div>
                `;
            }

            return;
        }

        const yearData = snapshot.docs[0].data();

        activeAcademicYear =
            yearData.year ||
            yearData.name ||
            "";

        const yearElement =
            document.getElementById("activeAcademicYear");

        if (yearElement) {
            yearElement.textContent =
                activeAcademicYear || "Unknown";
        }

        await loadExams();

    } catch (error) {

        console.error("Error loading academic year:", error);

        const yearElement =
            document.getElementById("activeAcademicYear");

        if (yearElement) {
            yearElement.textContent = "Unable to load";
        }

        const examList = document.getElementById("examList");

        if (examList) {
            examList.innerHTML = `
                <div class="admin-empty">
                    <h2>Unable to Load Data</h2>
                    <p>Please try again.</p>
                </div>
            `;
        }
    }
}


/* =====================================================
   LOAD EXAMS
===================================================== */

async function loadExams() {

    try {

        const examQuery = query(
            collection(db, "questionBank"),
            where("academicYear", "==", activeAcademicYear)
        );

        const snapshot = await getDocs(examQuery);

        allExams = [];

        const examMap = {};

        snapshot.forEach((questionDoc) => {

            const data = questionDoc.data();

            const title =
                data.examTitle ||
                data.title ||
                "Untitled Exam";

            const specialization =
                data.specialization ||
                "No Specialization";

            const key = `${specialization}|||${title}`;

            if (!examMap[key]) {

                examMap[key] = {
                    key: key,
                    title: title,
                    specialization: specialization,

                    academicYear:
                        data.academicYear ||
                        activeAcademicYear,

                    type:
                        data.type ||
                        "Multiple Choice",

                    status:
                        data.status ||
                        "ready",

                    facultyId:
                        data.facultyId ||
                        data.facultyID ||
                        data.facultyUid ||
                        data.createdBy ||
                        "",

                    questions: []
                };
            }

            /* If the first question had no faculty ID, check every question. */
            if (!examMap[key].facultyId) {

                examMap[key].facultyId =
                    data.facultyId ||
                    data.facultyID ||
                    data.facultyUid ||
                    data.createdBy ||
                    "";
            }

            /* Support both object choices and PDF-uploaded array choices. */
            let normalizedChoices;

            if (Array.isArray(data.choices)) {

                normalizedChoices = {
                    A: data.choices[0] || "",
                    B: data.choices[1] || "",
                    C: data.choices[2] || "",
                    D: data.choices[3] || ""
                };

            } else {

                normalizedChoices =
                    data.choices || {
                        A: data.choiceA || "",
                        B: data.choiceB || "",
                        C: data.choiceC || "",
                        D: data.choiceD || ""
                    };
            }

            examMap[key].questions.push({

                id: questionDoc.id,

                question:
                    data.question || "",

                choices: normalizedChoices,

                correctAnswer:
                    data.correctAnswer || "",

                status:
                    data.status || "ready"

            });

        });

        /* Stable order so exam positions never shuffle after a reload. */
        allExams = Object.values(examMap).sort((a, b) =>
            a.specialization.localeCompare(b.specialization) ||
            a.title.localeCompare(b.title)
        );

        /* Mark an exam administered if any question is administered. */
        allExams.forEach((exam) => {

            if (
                exam.questions.some(
                    question => question.status === "administered"
                )
            ) {
                exam.status = "administered";
            } else {
                exam.status = "ready";
            }

        });

        await renderExamList();

    } catch (error) {

        console.error("Error loading exams:", error);

        const examList = document.getElementById("examList");

        if (examList) {
            examList.innerHTML = `
                <div class="admin-empty">
                    <h2>Unable to Load Exams</h2>
                    <p>Please try again.</p>
                </div>
            `;
        }
    }
}


/* =====================================================
   RENDER EXAM LIST
===================================================== */

async function renderExamList() {

    const examList = document.getElementById("examList");

    if (!examList) {
        return;
    }

    if (!allExams.length) {

        examList.innerHTML = `
            <div class="admin-empty">
                <h2>No Exams Available</h2>
                <p>
                    No examinations are available for the active academic year yet.
                </p>
            </div>
        `;

        return;
    }

    examList.innerHTML = "";

    for (const [examIndex, exam] of allExams.entries()) {

        const facultyName = await getFacultyName(exam.facultyId);

        const card = document.createElement("div");

        card.className = "admin-exam-card";

        const status =
            exam.status === "administered"
                ? "administered"
                : "ready";

        card.innerHTML = `

            <div class="exam-card-top">

                <div>

                    <h2 class="exam-title">
                        ${escapeHTML(exam.title)}
                    </h2>

                    <div class="exam-specialization">
                        ${escapeHTML(exam.specialization)}
                    </div>

                    <div class="exam-faculty">
                        Created by:
                        <strong>
                            ${escapeHTML(facultyName)}
                        </strong>
                    </div>

                </div>

                <span class="exam-status ${status}">
                    ${status === "administered" ? "Administered" : "Ready"}
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
                    <span>${exam.questions.length}</span>
                </div>

            </div>

            <button
                class="check-questions-btn"
                onclick="toggleQuestions(${examIndex})"
            >
            
                <span>Check Questions</span>
            </button>

            <div
                class="questions-panel"
                id="questions-${examIndex}"
                style="display:none;"
            ></div>

            <div class="admin-exam-actions">

                ${
                    status === "administered"
                    ? `
                        <button
                            class="stop-administer-btn"
                            onclick="stopAdministration(${examIndex})"
                        >
                            Stop Administration
                        </button>
                    `
                    : `
                        <button
                            class="administer-exam-btn"
                            onclick="administerExam(${examIndex})"
                        >
                            Administer Exam
                        </button>
                    `
                }

            </div>
        `;

        examList.appendChild(card);
    }
}


/* =====================================================
   TOGGLE QUESTIONS
===================================================== */

function toggleQuestions(examIndex) {

    const panel = document.getElementById(
        `questions-${examIndex}`
    );

    if (!panel) {
        return;
    }

    if (
        panel.style.display === "none" ||
        panel.style.display === ""
    ) {

        openedExamKey = allExams[examIndex]
            ? allExams[examIndex].key
            : null;

        renderQuestions(examIndex);

        panel.style.display = "block";

    } else {

        panel.style.display = "none";

        openedExamKey = null;
    }
}


/* =====================================================
   RESOLVE CORRECT LETTER
   Handles "A"-"D" and older data that stored the
   full answer text instead of a letter.
===================================================== */

function resolveCorrectLetter(question) {

    const raw = String(question.correctAnswer || "").trim();
    const upper = raw.toUpperCase();

    if (["A", "B", "C", "D"].includes(upper)) {
        return upper;
    }

    const choices = question.choices || {};

    for (const letter of ["A", "B", "C", "D"]) {

        if (
            raw &&
            choices[letter] &&
            String(choices[letter]).trim().toLowerCase() === raw.toLowerCase()
        ) {
            return letter;
        }
    }

    return "";
}


/* =====================================================
   RENDER QUESTIONS (now shows correct answers)
===================================================== */

function renderQuestions(examIndex) {

    const panel = document.getElementById(
        `questions-${examIndex}`
    );

    if (!panel) {
        return;
    }

    const exam = allExams[examIndex];

    if (
        !exam ||
        !exam.questions ||
        !exam.questions.length
    ) {

        panel.innerHTML = `
            <div class="no-questions">
                No questions available.
            </div>
        `;

        return;
    }

    panel.innerHTML = exam.questions
        .map((question, questionIndex) => {

            const choices = question.choices || {};
            const correctLetter = resolveCorrectLetter(question);
            const correctText = correctLetter
                ? (choices[correctLetter] || "")
                : "";

            return `

                <div
                    class="question-panel"
                    id="question-panel-${question.id}"
                >

                    <div class="question-panel-header">

                        <div class="question-number">
                            Question ${questionIndex + 1}
                        </div>

                        <div class="question-actions">

                            <button
                                class="edit-question-btn"
                                onclick="editQuestion('${question.id}', ${examIndex})"
                            >
                                Edit
                            </button>

                            <button
                                class="delete-question-btn"
                                onclick="deleteQuestion('${question.id}', ${examIndex})"
                            >
                                Delete
                            </button>

                        </div>

                    </div>

                    <div
                        class="student-question-box"
                        id="question-content-${question.id}"
                    >

                        <div class="question-text">
                            ${escapeHTML(question.question)}
                        </div>

                        <div class="choices-list">

                            ${renderChoice("A", choices.A, correctLetter === "A")}
                            ${renderChoice("B", choices.B, correctLetter === "B")}
                            ${renderChoice("C", choices.C, correctLetter === "C")}
                            ${renderChoice("D", choices.D, correctLetter === "D")}

                        </div>

                        <div class="correct-answer-line ${correctLetter ? "" : "missing"}">
                            ${
                                correctLetter
                                ? `✔ Correct Answer: <strong>${correctLetter}</strong>${
                                      correctText
                                      ? ` — ${escapeHTML(correctText)}`
                                      : ""
                                  }`
                                : "⚠ No correct answer set"
                            }
                        </div>

                    </div>

                </div>
            `;

        })
        .join("");
}


/* =====================================================
   RENDER CHOICE
===================================================== */

function renderChoice(letter, text, isCorrect = false) {

    return `
        <div class="student-choice ${isCorrect ? "correct-choice" : ""}">

            <div class="choice-circle">
                ${letter}
            </div>

            <div class="choice-text">
                ${escapeHTML(text || "")}
            </div>

            ${isCorrect ? `<span class="correct-badge">✔ Correct</span>` : ""}

        </div>
    `;
}


/* =====================================================
   ADMINISTER EXAM
===================================================== */

async function administerExam(examIndex) {

    const exam = allExams[examIndex];

    if (!exam) {
        return;
    }

    try {

        /*
         * Several exams can be administered at the same time,
         * across any specialization. Other administered exams
         * are left untouched. Only this exam's questions are
         * switched to "administered".
         */

        const questionsToUpdate = exam.questions.filter(
            question => question.status !== "administered"
        );

        if (questionsToUpdate.length === 0) {
            alert("This exam is already administered.");
            return;
        }

        /* Multiple batches to stay under Firestore's 500-write limit. */
        let batch = writeBatch(db);
        let operationCount = 0;

        for (const question of questionsToUpdate) {

            batch.update(
                doc(db, "questionBank", question.id),
                {
                    status: "administered",
                    administeredBy: currentAdminUid,
                    administeredAt: new Date()
                }
            );

            operationCount++;

            if (operationCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        alert(`"${exam.title}" has been administered successfully.`);

        await loadExams();

    } catch (error) {

        console.error("Error administering exam:", error);

        alert("Failed to administer exam.");
    }
}


/* =====================================================
   STOP ADMINISTRATION
===================================================== */

async function stopAdministration(examIndex) {

    const exam = allExams[examIndex];

    if (!exam) {
        return;
    }

    try {

        let batch = writeBatch(db);
        let operationCount = 0;

        for (const question of exam.questions) {

            batch.update(
                doc(db, "questionBank", question.id),
                {
                    status: "ready",
                    administeredBy: null,
                    administeredAt: null
                }
            );

            operationCount++;

            if (operationCount >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        alert("Exam administration has been stopped.");

        await loadExams();

    } catch (error) {

        console.error("Error stopping administration:", error);

        alert("Failed to stop exam administration.");
    }
}


/* =====================================================
   EDIT QUESTION
===================================================== */

function editQuestion(questionId, examIndex) {

    const exam = allExams[examIndex];

    if (!exam) {
        return;
    }

    const question = exam.questions.find(
        item => item.id === questionId
    );

    if (!question) {
        return;
    }

    const content = document.getElementById(
        `question-content-${questionId}`
    );

    if (!content) {
        return;
    }

    const choices = question.choices || {};
    const correctLetter = resolveCorrectLetter(question);

    content.innerHTML = `

        <div class="inline-edit-form">

            <div class="inline-edit-field">
                <label>Question</label>

                <textarea id="edit-question-${questionId}">${escapeHTML(
                    question.question
                )}</textarea>
            </div>

            <div class="inline-edit-field">
                <label>Choice A</label>

                <input
                    type="text"
                    id="edit-a-${questionId}"
                    value="${escapeHTML(choices.A || "")}"
                >
            </div>

            <div class="inline-edit-field">
                <label>Choice B</label>

                <input
                    type="text"
                    id="edit-b-${questionId}"
                    value="${escapeHTML(choices.B || "")}"
                >
            </div>

            <div class="inline-edit-field">
                <label>Choice C</label>

                <input
                    type="text"
                    id="edit-c-${questionId}"
                    value="${escapeHTML(choices.C || "")}"
                >
            </div>

            <div class="inline-edit-field">
                <label>Choice D</label>

                <input
                    type="text"
                    id="edit-d-${questionId}"
                    value="${escapeHTML(choices.D || "")}"
                >
            </div>

            <div class="inline-edit-field">

                <label>Correct Answer</label>

                <select id="edit-answer-${questionId}">

                    <option value="A" ${correctLetter === "A" ? "selected" : ""}>A</option>
                    <option value="B" ${correctLetter === "B" ? "selected" : ""}>B</option>
                    <option value="C" ${correctLetter === "C" ? "selected" : ""}>C</option>
                    <option value="D" ${correctLetter === "D" ? "selected" : ""}>D</option>

                </select>

            </div>

            <div class="inline-edit-actions">

                <button
                    class="cancel-inline-edit-btn"
                    onclick="cancelEditQuestion('${questionId}', ${examIndex})"
                >
                    Cancel
                </button>

                <button
                    class="save-inline-edit-btn"
                    onclick="saveQuestion('${questionId}', ${examIndex})"
                >
                    Save Changes
                </button>

            </div>

        </div>
    `;
}


/* =====================================================
   CANCEL EDIT
===================================================== */

function cancelEditQuestion(questionId, examIndex) {

    renderQuestions(examIndex);
}


/* =====================================================
   SAVE QUESTION
===================================================== */

async function saveQuestion(questionId, examIndex) {

    try {

        const questionInput = document.getElementById(
            `edit-question-${questionId}`
        );

        const aInput = document.getElementById(
            `edit-a-${questionId}`
        );

        const bInput = document.getElementById(
            `edit-b-${questionId}`
        );

        const cInput = document.getElementById(
            `edit-c-${questionId}`
        );

        const dInput = document.getElementById(
            `edit-d-${questionId}`
        );

        const answerInput = document.getElementById(
            `edit-answer-${questionId}`
        );

        if (
            !questionInput ||
            !aInput ||
            !bInput ||
            !cInput ||
            !dInput ||
            !answerInput
        ) {
            alert("Unable to find the question edit fields.");
            return;
        }

        const question = questionInput.value.trim();

        if (!question) {
            alert("Question cannot be empty.");
            return;
        }

        const examKey = allExams[examIndex]
            ? allExams[examIndex].key
            : null;

        await updateDoc(
            doc(db, "questionBank", questionId),
            {
                question: question,

                choices: {
                    A: aInput.value.trim(),
                    B: bInput.value.trim(),
                    C: cInput.value.trim(),
                    D: dInput.value.trim()
                },

                correctAnswer: answerInput.value
            }
        );

        alert("Question updated successfully.");

        await loadExams();

        reopenExamPanel(examKey);

    } catch (error) {

        console.error("Error updating question:", error);

        alert("Failed to update question.");
    }
}


/* =====================================================
   DELETE QUESTION
===================================================== */

/*
 * Reopen an exam's question panel after a reload, finding the
 * exam by its stable key instead of its (shifting) list position.
 */
function reopenExamPanel(examKey) {

    if (!examKey) {
        return;
    }

    const newIndex = allExams.findIndex(exam => exam.key === examKey);

    if (newIndex === -1) {
        return;   /* exam no longer exists (e.g. last question deleted) */
    }

    const panel = document.getElementById(`questions-${newIndex}`);

    if (!panel) {
        return;
    }

    renderQuestions(newIndex);

    panel.style.display = "block";

    openedExamKey = examKey;
}


async function deleteQuestion(questionId, examIndex) {

    const exam = allExams[examIndex];

    if (!exam) {
        return;
    }

    const questionIndex = exam.questions.findIndex(
        item => item.id === questionId
    );

    if (questionIndex === -1) {
        return;
    }

    const question = exam.questions[questionIndex];
    const examKey = exam.key;

    const preview = question.question.length > 80
        ? question.question.slice(0, 80) + "..."
        : question.question;

    const confirmed = confirm(
        `Delete Question ${questionIndex + 1} from "${exam.title}"?\n\n"${preview}"`
    );

    if (!confirmed) {
        return;
    }

    try {

        await deleteDoc(
            doc(db, "questionBank", questionId)
        );

        alert("Question deleted successfully.");

        await loadExams();

        reopenExamPanel(examKey);

    } catch (error) {

        console.error("Error deleting question:", error);

        alert("Failed to delete question.");
    }
}


/* =====================================================
   ADMIN PDF UPLOAD: NOTIFICATIONS (auto-hide)
===================================================== */

function showAdminUploadMessage(message, type = "info") {

    const notification = document.getElementById("uiNotification");

    if (notification) {

        const colors = {
            success: "#218838",
            error: "#dc3545",
            warning: "#b7791f",
            info: "#2457a7"
        };

        /* How long each type stays on screen (ms). */
        const durations = {
            success: 4000,
            info: 4000,
            warning: 7000,
            error: 7000
        };

        /* Cancel any pending hide so a new message isn't cut short. */
        if (adminNotificationTimer) {
            clearTimeout(adminNotificationTimer);
            adminNotificationTimer = null;
        }

        notification.textContent = message;
        notification.style.color = colors[type] || colors.info;
        notification.style.display = "block";

        adminNotificationTimer = setTimeout(() => {

            notification.style.display = "none";
            notification.textContent = "";

            adminNotificationTimer = null;

        }, durations[type] || 4000);
    }

    console.log(`[Admin PDF Upload - ${type}] ${message}`);
}


/* =====================================================
   ADMIN PDF UPLOAD: SPECIALIZATIONS
===================================================== */

async function loadAdminSpecializations() {

    const select = document.getElementById(
        "adminSpecializationSelect"
    );

    if (!select) {
        return;
    }

    const previousValue = select.value;

    try {

        const specializationSnapshot = await getDocs(
            collection(db, "specializations")
        );

        const names = new Set();

        specializationSnapshot.forEach((specializationDoc) => {

            const data = specializationDoc.data();

            const name =
                data.name ||
                data.specialization ||
                data.title;

            if (name && String(name).trim()) {
                names.add(String(name).trim());
            }
        });

        /* If empty, fall back to questionBank specializations. */
        if (names.size === 0) {

            const questionSnapshot = await getDocs(
                collection(db, "questionBank")
            );

            questionSnapshot.forEach((questionDoc) => {

                const data = questionDoc.data();

                if (
                    data.specialization &&
                    String(data.specialization).trim()
                ) {
                    names.add(String(data.specialization).trim());
                }
            });
        }

        const sortedNames = [...names].sort(
            (a, b) => a.localeCompare(b)
        );

        select.innerHTML = `
            <option value="">Select Specialization</option>
            ${
                sortedNames.map(name => `
                    <option value="${escapeHTML(name)}">
                        ${escapeHTML(name)}
                    </option>
                `).join("")
            }
        `;

        if (sortedNames.includes(previousValue)) {
            select.value = previousValue;
        }

        updateAdminUploadFieldsVisibility();

        if (sortedNames.length === 0) {
            showAdminUploadMessage(
                "No specializations found. Add a specialization first.",
                "warning"
            );
        }

    } catch (error) {

        console.error("Error loading specializations:", error);

        showAdminUploadMessage(
            "Unable to load specializations. Check your Firestore configuration.",
            "error"
        );
    }
}


/* =====================================================
   ADMIN PDF UPLOAD: PDF TEXT EXTRACTION
===================================================== */

async function extractAdminPDFText(file) {

    if (!file) {
        throw new Error("Please select a PDF file.");
    }

    if (
        !file.name.toLowerCase().endsWith(".pdf") &&
        file.type !== "application/pdf"
    ) {
        throw new Error("Only PDF files are supported.");
    }

    if (typeof pdfjsLib === "undefined") {
        throw new Error(
            "PDF.js is not loaded. Add the PDF.js script to your HTML."
        );
    }

    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(buffer)
    }).promise;

    const allLines = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {

        const page = await pdf.getPage(pageNumber);

        const textContent = await page.getTextContent();

        const lineMap = new Map();

        textContent.items.forEach((item) => {

            if (!item.str || !item.str.trim()) {
                return;
            }

            const y = Math.round(item.transform[5]);

            if (!lineMap.has(y)) {
                lineMap.set(y, []);
            }

            lineMap.get(y).push({
                x: item.transform[4],
                text: item.str.trim()
            });
        });

        /* Sort lines top to bottom and text left to right. */
        const sortedY = [...lineMap.keys()].sort((a, b) => b - a);

        sortedY.forEach((y) => {

            const items = lineMap.get(y).sort(
                (a, b) => a.x - b.x
            );

            const line = items
                .map(item => item.text)
                .join(" ")
                .replace(/\s+/g, " ")
                .trim();

            if (line) {
                allLines.push(line);
            }
        });

        allLines.push("");
    }

    return allLines.join("\n").trim();
}


/* =====================================================
   ADMIN PDF UPLOAD: EXTRACT QUESTIONS
   Expected format:
   1. Question text
   A. First choice
   B. Second choice
   C. Third choice
   D. Fourth choice
===================================================== */

function extractAdminQuestions(text) {

    const normalizedText = text
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ");

    /* Question numbers at the start of a line, e.g. "1. " or "2) ". */
    const questionStartRegex = /^\s*(\d{1,3})[.)]\s+/gm;

    const starts = [];

    let match;

    while ((match = questionStartRegex.exec(normalizedText)) !== null) {

        starts.push({
            number: Number(match[1]),
            start: match.index,
            contentStart: questionStartRegex.lastIndex
        });
    }

    const questions = [];

    for (let i = 0; i < starts.length; i++) {

        const current = starts[i];

        const end = i + 1 < starts.length
            ? starts[i + 1].start
            : normalizedText.length;

        const chunk = normalizedText
            .slice(current.contentStart, end)
            .replace(/\s+/g, " ")
            .trim();

        /* Choice markers: A. / A) / B. / B) ... */
        const optionRegex = /(?:^|\s)([A-D])[.)]\s+/gi;

        const optionMatches = [];

        let optionMatch;

        while ((optionMatch = optionRegex.exec(chunk)) !== null) {

            optionMatches.push({
                letter: optionMatch[1].toUpperCase(),
                markerStart: optionMatch.index,
                contentStart: optionRegex.lastIndex
            });
        }

        if (optionMatches.length < 4) {
            continue;
        }

        const firstOptionStart = optionMatches[0].markerStart;

        const questionText = chunk
            .slice(0, firstOptionStart)
            .trim()
            .replace(/^[\s:.-]+/, "");

        const options = {};

        for (let j = 0; j < optionMatches.length; j++) {

            const option = optionMatches[j];

            const optionEnd = j + 1 < optionMatches.length
                ? optionMatches[j + 1].markerStart
                : chunk.length;

            const optionText = chunk
                .slice(option.contentStart, optionEnd)
                .trim()
                .replace(/^[\s:.-]+/, "")
                .replace(/[\s]+/g, " ");

            /* If a letter repeats, keep its first occurrence. */
            if (!options[option.letter]) {
                options[option.letter] = optionText;
            }
        }

        if (
            questionText &&
            options.A &&
            options.B &&
            options.C &&
            options.D
        ) {

            questions.push({
                number: current.number,
                question: questionText,
                A: options.A,
                B: options.B,
                C: options.C,
                D: options.D
            });
        }
    }

    return questions;
}


/* =====================================================
   ADMIN PDF UPLOAD: EXTRACT ANSWER KEY
   Supported examples:
   1. A
   2. C
   3) B
   4 - D
   5: A
===================================================== */

function extractAdminAnswers(text) {

    const answers = {};

    const normalizedText = text
        .replace(/\r/g, "\n")
        .replace(/\u00a0/g, " ");

    const answerRegex =
        /(?:^|[\s,;])(\d{1,3})\s*[.)\-:]?\s*([A-D])(?=$|[\s,;:.])/gim;

    let match;

    while ((match = answerRegex.exec(normalizedText)) !== null) {

        const questionNumber = Number(match[1]);
        const answerLetter = match[2].toUpperCase();

        if (questionNumber > 0) {
            answers[questionNumber] = answerLetter;
        }
    }

    return answers;
}


/* =====================================================
   ADMIN PDF UPLOAD: HANDLE SELECTED PDF
===================================================== */

async function readAdminPDF(file, kind) {

    const statusId = kind === "exam"
        ? "adminUploadStatus"
        : "adminAnswerStatus";

    const statusElement = document.getElementById(statusId);

    if (kind === "exam") {
        adminExamPDF = file || null;
        adminExtractedQuestions = [];
    } else {
        adminAnswerPDF = file || null;
        adminExtractedAnswers = {};
    }

    if (!file) {
        if (statusElement) {
            statusElement.textContent = "No file selected.";
        }
        return;
    }

    if (statusElement) {
        statusElement.textContent = `Reading ${file.name}...`;
    }

    try {

        const text = await extractAdminPDFText(file);

        if (!text.trim()) {
            throw new Error(
                "No selectable text was found. This PDF may be scanned or image-only."
            );
        }

        if (kind === "exam") {

            adminExtractedQuestions = extractAdminQuestions(text);

            if (adminExtractedQuestions.length === 0) {

                throw new Error(
                    "No multiple-choice questions were detected. Use numbered questions followed by A, B, C, and D choices."
                );
            }

            if (statusElement) {
                statusElement.textContent =
                    `${file.name} — ${adminExtractedQuestions.length} questions detected.`;
            }

        } else {

            adminExtractedAnswers = extractAdminAnswers(text);

            const answerCount = Object.keys(
                adminExtractedAnswers
            ).length;

            if (answerCount === 0) {

                throw new Error(
                    "No answer-key entries were detected. Use entries such as 1. A, 2. B, 3. C."
                );
            }

            if (statusElement) {
                statusElement.textContent =
                    `${file.name} — ${answerCount} answers detected.`;
            }
        }

        showAdminUploadMessage(
            kind === "exam"
                ? "Exam PDF processed successfully."
                : "Answer-key PDF processed successfully.",
            "success"
        );

    } catch (error) {

        console.error("PDF processing error:", error);

        if (statusElement) {
            statusElement.textContent = error.message;
        }

        showAdminUploadMessage(error.message, "error");
    }
}


/* =====================================================
   ADMIN PDF UPLOAD: DROP AREA SETUP
===================================================== */

function setupAdminPDFDropArea(areaId, inputId, kind) {

    const area = document.getElementById(areaId);
    const input = document.getElementById(inputId);

    if (!area || !input) {
        return;
    }

    area.addEventListener("click", (event) => {

        if (event.target === input) {
            return;
        }

        input.click();
    });

    input.addEventListener("change", async () => {

        const file = input.files && input.files[0];

        if (file) {
            await readAdminPDF(file, kind);
        }
    });

    area.addEventListener("dragover", (event) => {

        event.preventDefault();

        area.classList.add("drag-over");
    });

    area.addEventListener("dragleave", () => {

        area.classList.remove("drag-over");
    });

    area.addEventListener("drop", async (event) => {

        event.preventDefault();

        area.classList.remove("drag-over");

        const file = event.dataTransfer &&
            event.dataTransfer.files &&
            event.dataTransfer.files[0];

        if (!file) {
            return;
        }

        try {

            const transfer = new DataTransfer();

            transfer.items.add(file);

            input.files = transfer.files;

        } catch (error) {

            console.warn(
                "Unable to populate PDF input with dropped file:",
                error
            );
        }

        await readAdminPDF(file, kind);
    });
}


/* =====================================================
   ADMIN PDF UPLOAD: SUBMIT EXAM
===================================================== */

async function submitAdminPDFExam() {

    if (adminUploadBusy) {
        return;
    }

    const titleInput = document.getElementById(
        "adminExamTitle"
    );

    const specializationSelect = document.getElementById(
        "adminSpecializationSelect"
    );

    const submitButton = document.getElementById(
        "adminSubmitExamBtn"
    );

    if (!titleInput || !specializationSelect) {

        showAdminUploadMessage(
            "The exam upload form is missing required HTML elements.",
            "error"
        );

        return;
    }

    const title = titleInput.value.trim();
    const specialization = specializationSelect.value.trim();

    if (!activeAcademicYear) {

        showAdminUploadMessage(
            "Set an active academic year before uploading an exam.",
            "error"
        );

        return;
    }

    if (!title) {

        showAdminUploadMessage(
            "Enter an exam title.",
            "error"
        );

        titleInput.focus();

        return;
    }

    if (!specialization) {

        showAdminUploadMessage(
            "Select a specialization.",
            "error"
        );

        specializationSelect.focus();

        return;
    }

    if (!adminExamPDF || adminExtractedQuestions.length === 0) {

        showAdminUploadMessage(
            "Upload a valid exam PDF first.",
            "error"
        );

        return;
    }

    if (!adminAnswerPDF || Object.keys(adminExtractedAnswers).length === 0) {

        showAdminUploadMessage(
            "Upload a valid answer-key PDF first.",
            "error"
        );

        return;
    }

    /* Every question number must have an answer. */
    const missingAnswers = adminExtractedQuestions
        .filter(question => {
            const answer = adminExtractedAnswers[question.number];

            return !answer || !["A", "B", "C", "D"].includes(answer);
        })
        .map(question => question.number);

    if (missingAnswers.length > 0) {

        showAdminUploadMessage(
            `Missing answer-key entries for question number(s): ${missingAnswers.join(", ")}.`,
            "error"
        );

        return;
    }

    /* Duplicate question numbers would break the answer mapping. */
    const questionNumbers = adminExtractedQuestions.map(
        question => question.number
    );

    if (new Set(questionNumbers).size !== questionNumbers.length) {

        showAdminUploadMessage(
            "Duplicate question numbers were detected. Please check the exam PDF.",
            "error"
        );

        return;
    }

    const unmatchedAnswerNumbers = Object.keys(adminExtractedAnswers)
        .map(Number)
        .filter(number => !questionNumbers.includes(number));

    if (unmatchedAnswerNumbers.length > 0) {

        showAdminUploadMessage(
            `The answer key contains question number(s) not found in the exam: ${unmatchedAnswerNumbers.join(", ")}.`,
            "error"
        );

        return;
    }

    adminUploadBusy = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Saving Exam...";
    }

    try {

        let batch = writeBatch(db);
        let operationCount = 0;

        for (const question of adminExtractedQuestions) {

            const answer =
                adminExtractedAnswers[question.number];

            const questionRef = doc(
                collection(db, "questionBank")
            );

            batch.set(questionRef, {

                title: title,

                examTitle: title,

                specialization: specialization,

                academicYear: activeAcademicYear,

                question: question.question,

                choices: [
                    question.A,
                    question.B,
                    question.C,
                    question.D
                ],

                correctAnswer: answer,

                createdBy: currentAdminUid,

                facultyId: currentAdminUid,

                createdByRole: "ADMIN",

                type: "pdf",

                status: "ready",

                administeredBy: null,

                administeredAt: null,

                createdAt: serverTimestamp()

            });

            operationCount++;

            if (operationCount >= 450) {

                await batch.commit();

                batch = writeBatch(db);

                operationCount = 0;
            }
        }

        if (operationCount > 0) {
            await batch.commit();
        }

        /* This message now disappears automatically after 4 seconds. */
        showAdminUploadMessage(
            `Exam "${title}" saved successfully with ${adminExtractedQuestions.length} questions. It is ready for administration.`,
            "success"
        );

        titleInput.value = "";

        specializationSelect.value = "";

        updateAdminUploadFieldsVisibility();

        adminExamPDF = null;
        adminAnswerPDF = null;

        adminExtractedQuestions = [];
        adminExtractedAnswers = {};

        const examInput = document.getElementById(
            "adminFileInput"
        );

        const answerInput = document.getElementById(
            "adminAnswerFileInput"
        );

        if (examInput) {
            examInput.value = "";
        }

        if (answerInput) {
            answerInput.value = "";
        }

        const examStatus = document.getElementById(
            "adminUploadStatus"
        );

        const answerStatus = document.getElementById(
            "adminAnswerStatus"
        );

        if (examStatus) {
            examStatus.textContent = "No exam PDF selected.";
        }

        if (answerStatus) {
            answerStatus.textContent = "No answer-key PDF selected.";
        }

        await loadExams();

    } catch (error) {

        console.error("Error saving Admin-created exam:", error);

        showAdminUploadMessage(
            "Failed to save the exam. Check your internet connection and Firestore permissions.",
            "error"
        );

    } finally {

        adminUploadBusy = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Upload and Create Exam";
        }
    }
}


/* =====================================================
   ADMIN PDF UPLOAD: SHOW UPLOADER AFTER SPECIALIZATION
===================================================== */

function updateAdminUploadFieldsVisibility() {

    const select = document.getElementById(
        "adminSpecializationSelect"
    );

    const fields = document.getElementById(
        "adminUploadFields"
    );

    if (!select || !fields) {
        return;
    }

    fields.hidden = !select.value;
}


/* =====================================================
   ADMIN PDF UPLOAD: INITIALIZE
===================================================== */

function setupAdminPDFUpload() {

    const specializationSelect = document.getElementById(
        "adminSpecializationSelect"
    );

    if (specializationSelect) {

        specializationSelect.addEventListener(
            "change",
            updateAdminUploadFieldsVisibility
        );
    }

    updateAdminUploadFieldsVisibility();

    setupAdminPDFDropArea(
        "adminDropArea",
        "adminFileInput",
        "exam"
    );

    setupAdminPDFDropArea(
        "adminAnswerDropArea",
        "adminAnswerFileInput",
        "answers"
    );

    const submitButton = document.getElementById(
        "adminSubmitExamBtn"
    );

    if (submitButton) {

        submitButton.addEventListener(
            "click",
            submitAdminPDFExam
        );
    }

    if (typeof pdfjsLib !== "undefined") {

        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
    }
}


/* =====================================================
   LOGOUT
===================================================== */

async function logout() {

    try {

        await signOut(auth);

        localStorage.clear();

        window.location.replace("../login.html");

    } catch (error) {

        console.error("Logout error:", error);
    }
}


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.toggleQuestions = toggleQuestions;

window.administerExam = administerExam;

window.stopAdministration = stopAdministration;

window.editQuestion = editQuestion;

window.cancelEditQuestion = cancelEditQuestion;

window.saveQuestion = saveQuestion;

window.deleteQuestion = deleteQuestion;

window.logout = logout;


/* =====================================================
   INITIALIZE ADMIN PDF UPLOAD
===================================================== */

setupAdminPDFUpload();