
import { auth, db } from "./firebase-config.js";
import { appAlert, appConfirm } from "./ui-dialog.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentFacultyUid = "";
let assignedSpecialization = "";
let activeAcademicYear = "";

let manualQuestionsArray = [];
let extractedQuestions = [];
let extractedAnswers = [];
let questionBankData = [];

let isSaving = false;
let pdfLibraryReady = false;

// ============================================================
// HELPERS
// ============================================================

function getElement(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function normalizeText(value) {
    return String(value ?? "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function getExamGroupKey(data) {
    return [
        data.title || "",
        data.specialization || "",
        data.academicYear || "",
        data.createdBy || ""
    ].join("||");
}

// ============================================================
// PAGE NOTIFICATIONS
// Keeps the existing inline notification UI.
// Uses ui-dialog if the notification element is missing.
// ============================================================

function showUIMessage(message, type = "info") {
    const box = getElement("uiNotification");

    if (!box) {
        const plainMessage = String(message)
            .replace(/<[^>]*>/g, "");

        const dialogType = {
            success: "success",
            warning: "warning",
            danger: "error",
            error: "error",
            info: "info"
        }[type] || "info";

        void appAlert(plainMessage, {
            type: dialogType
        });

        return;
    }

    const allowedTypes = [
        "success",
        "warning",
        "danger",
        "info"
    ];

    const selectedType = allowedTypes.includes(type)
        ? type
        : "info";

    box.className = "alert-box";
    box.classList.add(`alert-${selectedType}`);

    // This function is used with trusted, developer-authored HTML.
    // Dynamic values inserted into its messages are escaped.
    box.innerHTML = message;
    box.style.display = "block";

    box.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function hideUIMessage() {
    const box = getElement("uiNotification");

    if (box) {
        box.style.display = "none";
        box.innerHTML = "";
    }
}

function setButtonLoading(
    buttonId,
    loading,
    loadingText = "Saving..."
) {
    const button = getElement(buttonId);

    if (!button) return;

    if (loading) {
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.textContent = loadingText;
        button.disabled = true;
    } else {
        button.textContent =
            button.dataset.originalText || button.textContent;

        delete button.dataset.originalText;
        button.disabled = false;
    }
}

// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("../login.html");
        return;
    }

    currentFacultyUid = user.uid;

    try {
        await loadFacultySpecialization(user.uid);
        await loadActiveAcademicYear();
        await loadExistingExams();

        setupSpecializationToggle();
        setupQuestionPDFUpload();
        setupAnswerPDFUpload();
        renderManualQuestionsList();

        checkPDFLibrary();
    } catch (error) {
        console.error("Page initialization error:", error);

        showUIMessage(
            "<strong>Error:</strong> The page could not finish loading. Refresh and try again.",
            "danger"
        );
    }
});

// Reload if the browser restores a cached page.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        window.location.reload();
    }
});

// ============================================================
// FACULTY SPECIALIZATION
// ============================================================

async function loadFacultySpecialization(uid) {
    const dropdown = getElement("specializationSelect");

    if (!dropdown) return;

    dropdown.disabled = true;
    dropdown.innerHTML =
        '<option value="">Loading specialization...</option>';

    try {
        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            dropdown.innerHTML =
                '<option value="">No faculty profile found</option>';

            showUIMessage(
                "<strong>Error:</strong> Faculty profile document not found.",
                "danger"
            );

            return;
        }

        const data = userSnap.data();
        const role = normalizeText(data.role);

        if (role !== "faculty") {
            dropdown.innerHTML =
                '<option value="">Faculty account required</option>';

            await appAlert(
                "This page is for faculty accounts only.",
                {
                    title: "Access denied",
                    type: "error"
                }
            );

            window.location.replace("../login.html");
            return;
        }

        assignedSpecialization = String(
            data.specialization || ""
        ).trim();

        dropdown.innerHTML =
            '<option value="">Select Specialization</option>';

        if (!assignedSpecialization) {
            dropdown.disabled = true;

            showUIMessage(
                "<strong>Notice:</strong> No specialization is assigned to your faculty profile. Please contact your Program Chair.",
                "warning"
            );

            return;
        }

        const option = document.createElement("option");
        option.value = assignedSpecialization;
        option.textContent = assignedSpecialization;

        dropdown.appendChild(option);
        dropdown.value = assignedSpecialization;
        dropdown.disabled = false;

        const section = getElement("examCreationSection");

        if (section) {
            section.style.display = "block";
        }

        hideUIMessage();
    } catch (error) {
        console.error("Faculty specialization error:", error);

        showUIMessage(
            "<strong>Error:</strong> Failed to load your faculty specialization. Check your Firestore permissions.",
            "danger"
        );
    }
}

// ============================================================
// SPECIALIZATION SELECT
// ============================================================

function setupSpecializationToggle() {
    const dropdown = getElement("specializationSelect");
    const section = getElement("examCreationSection");

    if (!dropdown || !section) return;

    dropdown.addEventListener("change", () => {
        if (
            dropdown.value &&
            dropdown.value !== assignedSpecialization
        ) {
            dropdown.value = assignedSpecialization;
        }

        section.style.display = dropdown.value
            ? "block"
            : "none";

        hideUIMessage();
    });
}

// ============================================================
// ACTIVE ACADEMIC YEAR
// ============================================================

async function loadActiveAcademicYear() {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, "academicYears"),
                where("active", "==", true)
            )
        );

        activeAcademicYear = "";

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();

            activeAcademicYear = String(
                data.year || data.name || ""
            ).trim();
        }

        if (!activeAcademicYear) {
            showUIMessage(
                "<strong>Notice:</strong> No active academic year was found. Ask the Administrator to activate an academic year before creating an exam.",
                "warning"
            );
        }
    } catch (error) {
        console.error("Academic year error:", error);

        showUIMessage(
            "<strong>Error:</strong> Failed to load the active academic year.",
            "danger"
        );
    }
}

// ============================================================
// VALIDATE EXAM DETAILS
// ============================================================

function validateExamDetails() {
    const title = getElement("examTitle")?.value.trim() || "";

    const specialization =
        getElement("specializationSelect")?.value.trim() || "";

    if (!title) {
        showUIMessage(
            "<strong>Warning:</strong> Please enter an exam title.",
            "warning"
        );
        return null;
    }

    if (!specialization) {
        showUIMessage(
            "<strong>Warning:</strong> Please select your specialization.",
            "warning"
        );
        return null;
    }

    if (specialization !== assignedSpecialization) {
        showUIMessage(
            "<strong>Access denied:</strong> You can only create exams for your assigned specialization.",
            "danger"
        );
        return null;
    }

    if (!activeAcademicYear) {
        showUIMessage(
            "<strong>Warning:</strong> No active academic year was found.",
            "warning"
        );
        return null;
    }

    if (!currentFacultyUid) {
        showUIMessage(
            "<strong>Error:</strong> Your faculty session has expired. Please log in again.",
            "danger"
        );
        return null;
    }

    return {
        title,
        specialization,
        academicYear: activeAcademicYear
    };
}

// ============================================================
// MANUAL QUESTION ENTRY
// ============================================================

function addManualQuestion() {
    if (isSaving) return;

    const details = validateExamDetails();
    if (!details) return;

    const question =
        getElement("manualQuestion")?.value.trim() || "";

    const A = getElement("choiceA")?.value.trim() || "";
    const B = getElement("choiceB")?.value.trim() || "";
    const C = getElement("choiceC")?.value.trim() || "";
    const D = getElement("choiceD")?.value.trim() || "";

    const correctAnswer =
        getElement("correctAnswer")?.value || "";

    if (!question || !A || !B || !C || !D || !correctAnswer) {
        showUIMessage(
            "<strong>Warning:</strong> Complete the question, all four choices, and the correct answer.",
            "warning"
        );
        return;
    }

    const choices = [A, B, C, D];

    if (new Set(choices.map(normalizeText)).size !== 4) {
        showUIMessage(
            "<strong>Warning:</strong> Each answer choice must be different.",
            "warning"
        );
        return;
    }

    manualQuestionsArray.push({
        question,
        A,
        B,
        C,
        D,
        correctAnswer
    });

    renderManualQuestionsList();

    [
        "manualQuestion",
        "choiceA",
        "choiceB",
        "choiceC",
        "choiceD",
        "correctAnswer"
    ].forEach((id) => {
        const field = getElement(id);
        if (field) field.value = "";
    });

    showUIMessage(
        "<strong>Success:</strong> Question added to the unsaved exam list.",
        "success"
    );
}

function renderManualQuestionsList() {
    const list = getElement("manualQuestionsList");
    const count = getElement("manualCount");
    const saveButton = getElement("saveManualExamBtn");

    if (count) {
        count.textContent = manualQuestionsArray.length;
    }

    if (saveButton) {
        saveButton.style.display = manualQuestionsArray.length
            ? "inline-block"
            : "none";
    }

    if (!list) return;

    list.innerHTML = "";

    manualQuestionsArray.forEach((item, index) => {
        const li = document.createElement("li");

        const questionTitle = document.createElement("strong");
        questionTitle.textContent =
            `Q${index + 1}: ${item.question}`;

        const choices = document.createElement("p");
        choices.textContent =
            `A: ${item.A} | B: ${item.B} | C: ${item.C} | D: ${item.D}`;

        const answer = document.createElement("p");
        answer.textContent =
            `Correct Answer: ${item.correctAnswer}`;

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "submit-btn";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", async () => {
            const confirmed = await appConfirm(
                `Remove question ${index + 1} from the unsaved exam?`,
                {
                    title: "Remove Question",
                    confirmText: "Remove",
                    cancelText: "Keep",
                    danger: true
                }
            );

            if (!confirmed) return;

            manualQuestionsArray.splice(index, 1);
            renderManualQuestionsList();
        });

        li.append(
            questionTitle,
            choices,
            answer,
            removeButton
        );

        list.appendChild(li);
    });
}

// ============================================================
// SAVE MANUAL EXAM
// ============================================================

async function saveManualQuestionsToFirestore() {
    if (isSaving) return;

    const details = validateExamDetails();
    if (!details) return;

    if (manualQuestionsArray.length === 0) {
        showUIMessage(
            "<strong>Warning:</strong> Add at least one question before saving.",
            "warning"
        );
        return;
    }

    const confirmed = await appConfirm(
        `Save "${details.title}" with ${manualQuestionsArray.length} manual questions?\n\nThe questions will be saved as pending administration.`,
        {
            title: "Save Manual Exam",
            confirmText: "Save Exam",
            cancelText: "Cancel"
        }
    );

    if (!confirmed) return;

    isSaving = true;
    setButtonLoading(
        "saveManualExamBtn",
        true,
        "Saving Questions..."
    );

    try {
        await saveQuestionsInBatches(
            manualQuestionsArray.map((item) => ({
                title: details.title,
                specialization: details.specialization,
                academicYear: details.academicYear,
                question: item.question,
                choices: [item.A, item.B, item.C, item.D],
                correctAnswer: item.correctAnswer,
                createdBy: currentFacultyUid,
                type: "manual",
                status: "ready_for_admin",
                createdAt: serverTimestamp()
            }))
        );

        manualQuestionsArray = [];
        renderManualQuestionsList();

        if (getElement("examTitle")) {
            getElement("examTitle").value = "";
        }

        showUIMessage(
            "<strong>Success!</strong> Manual questions were saved and are awaiting Program Chair/Admin administration.",
            "success"
        );

        await loadExistingExams();
    } catch (error) {
        console.error("Saving manual exam failed:", error);

        await appAlert(
            "The manual exam could not be saved. Check Firestore permissions and try again.",
            {
                title: "Save Failed",
                type: "error"
            }
        );
    } finally {
        isSaving = false;
        setButtonLoading("saveManualExamBtn", false);
    }
}

// ============================================================
// FIRESTORE BATCH SAVING
// ============================================================

async function saveQuestionsInBatches(questionDocuments) {
    const collectionRef = collection(db, "questionBank");
    const chunkSize = 450;

    for (
        let start = 0;
        start < questionDocuments.length;
        start += chunkSize
    ) {
        const batch = writeBatch(db);

        const chunk = questionDocuments.slice(
            start,
            start + chunkSize
        );

        chunk.forEach((questionData) => {
            const newRef = doc(collectionRef);
            batch.set(newRef, questionData);
        });

        await batch.commit();
    }
}

// ============================================================
// PDF LIBRARY CHECK
// ============================================================

function checkPDFLibrary() {
    pdfLibraryReady = typeof window.pdfjsLib !== "undefined";

    if (!pdfLibraryReady) {
        console.error(
            "PDF.js was not found. Check ../js/pdf.js."
        );
    }
}

// ============================================================
// PDF DROP AREA SETUP
// ============================================================

function setupDropArea(dropAreaId, inputId, onFileSelected) {
    const dropArea = getElement(dropAreaId);
    const fileInput = getElement(inputId);

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener("click", () => {
        fileInput.click();
    });

    dropArea.addEventListener("dragover", (event) => {
        event.preventDefault();
        dropArea.classList.add("dragover");
    });

    dropArea.addEventListener("dragleave", () => {
        dropArea.classList.remove("dragover");
    });

    dropArea.addEventListener("drop", (event) => {
        event.preventDefault();
        dropArea.classList.remove("dragover");

        const file = event.dataTransfer?.files?.[0];

        if (file) {
            onFileSelected(file);
        }
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];

        if (file) {
            onFileSelected(file);
        }
    });
}

function setupQuestionPDFUpload() {
    setupDropArea("dropArea", "fileInput", readPDF);
}

function setupAnswerPDFUpload() {
    setupDropArea(
        "answerDropArea",
        "answerFileInput",
        readAnswerPDF
    );
}

// ============================================================
// READ PDF TEXT
// ============================================================

async function extractPDFText(file) {
    if (!file) {
        throw new Error("No file was selected.");
    }

    if (
        file.type !== "application/pdf" &&
        !file.name.toLowerCase().endsWith(".pdf")
    ) {
        throw new Error("Please select a PDF file.");
    }

    checkPDFLibrary();

    if (!pdfLibraryReady) {
        throw new Error(
            "PDF.js did not load. Check your ../js/pdf.js file."
        );
    }

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer)
    }).promise;

    let text = "";

    for (
        let pageNumber = 1;
        pageNumber <= pdf.numPages;
        pageNumber++
    ) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        text += content.items
            .map((item) => item.str || "")
            .join(" ") + "\n";
    }

    return text;
}

// ============================================================
// READ QUESTION PDF
// ============================================================

async function readPDF(file) {
    const status = getElement("uploadStatus");

    if (status) {
        status.textContent = "Scanning PDF...";
    }

    try {
        const text = await extractPDFText(file);

        extractQuestions(text);

        if (status) {
            status.textContent =
                `${extractedQuestions.length} questions detected`;
        }
    } catch (error) {
        console.error("Question PDF error:", error);

        if (status) {
            status.textContent = "Failed to read PDF.";
        }

        await appAlert(error.message, {
            title: "Unable to Read Exam PDF",
            type: "error"
        });
    }
}

// ============================================================
// EXTRACT MULTIPLE-CHOICE QUESTIONS
// Expected format:
// 1. Question text A. Choice A B. Choice B C. Choice C D. Choice D
// ============================================================

function extractQuestions(text) {
    extractedQuestions = [];

    const normalized = String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ");

    const blocks = normalized
        .split(/(?=\b\d+\s*[\.\)]\s+)/g)
        .map((block) => block.trim())
        .filter(Boolean);

    for (const originalBlock of blocks) {
        const block = originalBlock.replace(
            /^\d+\s*[\.\)]\s*/,
            ""
        );

        const optionMatches = [
            ...block.matchAll(
                /(?:^|\s)([A-D])\s*[\.\)]\s+/gi
            )
        ];

        if (optionMatches.length < 4) continue;

        const firstOption = optionMatches[0];

        const questionStart = block
            .substring(0, firstOption.index)
            .trim();

        const choices = [];

        for (let i = 0; i < optionMatches.length; i++) {
            const current = optionMatches[i];

            const start =
                current.index + current[0].length;

            const end = i + 1 < optionMatches.length
                ? optionMatches[i + 1].index
                : block.length;

            choices.push(
                block.substring(start, end).trim()
            );
        }

        if (
            questionStart &&
            choices.length >= 4 &&
            choices.slice(0, 4).every(Boolean)
        ) {
            extractedQuestions.push({
                question: questionStart,
                A: choices[0],
                B: choices[1],
                C: choices[2],
                D: choices[3]
            });
        }
    }

    if (extractedQuestions.length === 0) {
        showUIMessage(
            "<strong>Warning:</strong> No multiple-choice questions were detected. Use a text-based PDF with numbered questions and A–D choices.",
            "warning"
        );
        return;
    }

    showUIMessage(
        `<strong>Success:</strong> ${extractedQuestions.length} questions detected from the PDF. Review the PDF format and answer key before submitting.`,
        "success"
    );
}

// ============================================================
// READ ANSWER KEY PDF
// Supported format: 1. A  2. C  3. B
// ============================================================

async function readAnswerPDF(file) {
    const status = getElement("answerStatus");

    if (status) {
        status.textContent = "Scanning answer key...";
    }

    try {
        const text = await extractPDFText(file);

        extractAnswers(text);

        if (status) {
            status.textContent =
                `${extractedAnswers.length} answers detected`;
        }
    } catch (error) {
        console.error("Answer key PDF error:", error);

        if (status) {
            status.textContent = "Failed to read answer key.";
        }

        await appAlert(error.message, {
            title: "Unable to Read Answer Key",
            type: "error"
        });
    }
}

function extractAnswers(text) {
    extractedAnswers = [];

    const normalized = String(text || "")
        .replace(/\r/g, "\n")
        .toUpperCase();

    const numberedMatches = [
        ...normalized.matchAll(
            /(?:^|\s)(\d+)\s*[\.\)]\s*([A-D])\b/g
        )
    ];

    if (numberedMatches.length > 0) {
        const answerMap = new Map();

        numberedMatches.forEach((match) => {
            answerMap.set(Number(match[1]), match[2]);
        });

        const questionNumbers = [...answerMap.keys()].sort(
            (a, b) => a - b
        );

        const continuous = questionNumbers.every(
            (number, index) => number === index + 1
        );

        if (!continuous) {
            showUIMessage(
                "<strong>Warning:</strong> The answer key numbering is not continuous. Check that answers start at 1 and do not skip question numbers.",
                "warning"
            );
            return;
        }

        extractedAnswers = questionNumbers.map(
            (number) => answerMap.get(number)
        );
    } else {
        const matches = normalized.match(/\b[A-D]\b/g);

        if (matches) {
            extractedAnswers = matches;
        }
    }

    if (extractedAnswers.length === 0) {
        showUIMessage(
            "<strong>Warning:</strong> No answer key entries were detected. Use a numbered answer key such as 1. A, 2. C, 3. B.",
            "warning"
        );
        return;
    }

    showUIMessage(
        `<strong>Success:</strong> ${extractedAnswers.length} answer entries detected.`,
        "success"
    );
}

// ============================================================
// SUBMIT PDF QUESTIONS
// ============================================================

async function submitQuestions() {
    if (isSaving) return;

    const details = validateExamDetails();
    if (!details) return;

    if (extractedQuestions.length === 0) {
        showUIMessage(
            "<strong>Warning:</strong> Upload a question PDF first.",
            "warning"
        );
        return;
    }

    if (extractedAnswers.length === 0) {
        showUIMessage(
            "<strong>Warning:</strong> Upload an answer key PDF first.",
            "warning"
        );
        return;
    }

    if (extractedAnswers.length !== extractedQuestions.length) {
        await appAlert(
            `Detected questions: ${extractedQuestions.length}\nDetected answers: ${extractedAnswers.length}\n\nCheck both PDF files and upload them again.`,
            {
                title: "Question and Answer Count Mismatch",
                type: "warning"
            }
        );
        return;
    }

    const confirmed = await appConfirm(
        `Submit "${details.title}"?\n\nSpecialization: ${details.specialization}\nAcademic Year: ${details.academicYear}\nQuestions: ${extractedQuestions.length}\n\nThe exam will await Program Chair/Admin administration.`,
        {
            title: "Submit PDF Exam",
            confirmText: "Submit Exam",
            cancelText: "Review"
        }
    );

    if (!confirmed) return;

    isSaving = true;
    setButtonLoading(
        "submitPdfBtn",
        true,
        "Saving PDF Questions..."
    );

    try {
        const documents = extractedQuestions.map(
            (question, index) => ({
                title: details.title,
                specialization: details.specialization,
                academicYear: details.academicYear,
                question: question.question,
                choices: [
                    question.A,
                    question.B,
                    question.C,
                    question.D
                ],
                correctAnswer: extractedAnswers[index],
                createdBy: currentFacultyUid,
                type: "pdf",
                status: "ready_for_admin",
                createdAt: serverTimestamp()
            })
        );

        await saveQuestionsInBatches(documents);

        extractedQuestions = [];
        extractedAnswers = [];

        if (getElement("examTitle")) {
            getElement("examTitle").value = "";
        }

        if (getElement("uploadStatus")) {
            getElement("uploadStatus").textContent =
                "No exam file uploaded yet";
        }

        if (getElement("answerStatus")) {
            getElement("answerStatus").textContent =
                "No answer key uploaded yet";
        }

        if (getElement("fileInput")) {
            getElement("fileInput").value = "";
        }

        if (getElement("answerFileInput")) {
            getElement("answerFileInput").value = "";
        }

        if (getElement("examCreationSection")) {
            getElement("examCreationSection").style.display = "none";
        }

        if (getElement("specializationSelect")) {
            getElement("specializationSelect").value =
                assignedSpecialization;
        }

        showUIMessage(
            `<strong>Success!</strong> ${documents.length} PDF questions were saved and are awaiting Program Chair/Admin administration.`,
            "success"
        );

        await loadExistingExams();
    } catch (error) {
        console.error("Submit PDF questions error:", error);

        await appAlert(
            "The PDF questions could not be saved. Check Firestore permissions and try again.",
            {
                title: "Submission Failed",
                type: "error"
            }
        );
    } finally {
        isSaving = false;
        setButtonLoading("submitPdfBtn", false);
    }
}

// ============================================================
// LOAD EXISTING EXAMS CREATED BY THIS FACULTY
// ============================================================

async function loadExistingExams() {
    const container = getElement("existingExams");

    if (!container || !currentFacultyUid) return;

    container.innerHTML = "<p>Loading exams...</p>";

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "questionBank"),
                where("createdBy", "==", currentFacultyUid)
            )
        );

        questionBankData = snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data()
        }));

        renderExistingExams();
    } catch (error) {
        console.error("Load existing exams error:", error);

        container.innerHTML =
            "<p>Failed to load existing exams. Check Firestore permissions.</p>";
    }
}

// ============================================================
// RENDER EXISTING EXAMS
// ============================================================

function renderExistingExams() {
    const container = getElement("existingExams");

    if (!container) return;

    container.innerHTML = "";

    const grouped = new Map();

    questionBankData.forEach((data) => {
        if (!data.title || !data.specialization) return;

        const key = getExamGroupKey(data);

        if (!grouped.has(key)) {
            grouped.set(key, {
                title: data.title,
                specialization: data.specialization,
                academicYear: data.academicYear || "No Year",
                type: data.type || "manual",
                status: data.status || "ready_for_admin",
                count: 0
            });
        }

        const exam = grouped.get(key);
        exam.count += 1;

        if (data.status) {
            exam.status = data.status;
        }
    });

    if (grouped.size === 0) {
        container.innerHTML = "<p>No exams created yet.</p>";
        return;
    }

    const bySpecialization = new Map();

    for (const exam of grouped.values()) {
        if (!bySpecialization.has(exam.specialization)) {
            bySpecialization.set(exam.specialization, []);
        }

        bySpecialization.get(exam.specialization).push(exam);
    }

    for (const [specialization, exams] of bySpecialization.entries()) {
        const details = document.createElement("details");
        details.className = "exam-specialization";

        const summary = document.createElement("summary");
        summary.textContent = specialization;
        details.appendChild(summary);

        exams.forEach((exam) => {
            const item = document.createElement("div");
            item.className = "exam-item";

            const title = document.createElement("strong");
            title.textContent = exam.title;

            const metadata = document.createElement("p");
            metadata.textContent =
                `Academic Year: ${exam.academicYear}`;

            const type = document.createElement("p");
            type.textContent =
                `Type: ${exam.type === "pdf" ? "PDF Upload" : "Manual Questions"}`;

            const count = document.createElement("p");
            count.textContent = `Questions: ${exam.count}`;

            const status = document.createElement("p");
            status.textContent =
                `Status: ${formatStatus(exam.status)}`;

            item.append(title, metadata, type, count, status);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "submit-btn";
            deleteButton.textContent = "Delete Exam";

            deleteButton.addEventListener("click", () => {
                void deleteExam(
                    exam.title,
                    exam.specialization,
                    exam.academicYear
                );
            });

            item.appendChild(deleteButton);
            details.appendChild(item);
        });

        container.appendChild(details);
    }
}

function formatStatus(status) {
    const labels = {
        ready_for_admin: "Awaiting Admin Administration",
        active: "Active",
        administered: "Administered",
        inactive: "Inactive",
        archived: "Archived"
    };

    return labels[status] || String(status || "Unknown");
}

// ============================================================
// DELETE EXAM — CUSTOM UI CONFIRMATION
// ============================================================

async function deleteExam(title, specialization, academicYear) {
    if (isSaving) return;

    const confirmed = await appConfirm(
        `Delete "${title}"?\n\nSpecialization: ${specialization}\nAcademic Year: ${academicYear}\n\nThis permanently deletes the matching question documents created by your account.`,
        {
            title: "Delete Exam",
            confirmText: "Delete Exam",
            cancelText: "Keep Exam",
            danger: true
        }
    );

    if (!confirmed) return;

    try {
        const snapshot = await getDocs(
            query(
                collection(db, "questionBank"),
                where("title", "==", title),
                where("specialization", "==", specialization),
                where("academicYear", "==", academicYear),
                where("createdBy", "==", currentFacultyUid)
            )
        );

        if (snapshot.empty) {
            await appAlert(
                "No matching exam questions were found.",
                {
                    title: "Exam Not Found",
                    type: "warning"
                }
            );
            return;
        }

        const docs = snapshot.docs;
        const chunkSize = 450;

        for (let start = 0; start < docs.length; start += chunkSize) {
            const batch = writeBatch(db);

            docs.slice(start, start + chunkSize).forEach((item) => {
                batch.delete(doc(db, "questionBank", item.id));
            });

            await batch.commit();
        }

        await appAlert(
            "The exam questions were deleted successfully.",
            {
                title: "Exam Deleted",
                type: "success"
            }
        );

        await loadExistingExams();
    } catch (error) {
        console.error("Delete exam error:", error);

        await appAlert(
            "Failed to delete this exam. Check Firestore permissions and try again.",
            {
                title: "Delete Failed",
                type: "error"
            }
        );
    }
}

// ============================================================
// SIDEBAR AND PAGE NAVIGATION
// ============================================================

function toggleSidebar() {
    getElement("sidebar")?.classList.toggle("active");
}

function goPage(url) {
    if (!url) return;

    window.location.href = url;
}

// ============================================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK ATTRIBUTES
// ============================================================

window.addManualQuestion = addManualQuestion;
window.saveManualExam = saveManualQuestionsToFirestore;
window.submitQuestions = submitQuestions;
window.toggleSidebar = toggleSidebar;
window.deleteExam = deleteExam;
window.goPage = goPage;
