import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


/* =========================================================
   GLOBAL VARIABLES
========================================================= */

let currentUser = null;
let currentQuestions = [];
let selectedSpecialization = "";
let selectedExamTitle = "";
let selectedExamTitles = [];
let warningCount = 0;
let activeAcademicYear = "";
let isSubmittingExam = false;

/* Maximum number of questions a student receives. */
const MAX_QUESTIONS = 100;


/* =========================================================
   INTEREST ASSESSMENT
========================================================= */

const interestQuestions = [
    {
        question: "Which IT activity do you enjoy the most?",
        choices: [
            "Programming applications",
            "Designing websites",
            "Fixing computers",
            "Analyzing data"
        ]
    },

    {
        question: "What excites you the most in IT?",
        choices: [
            "Building systems",
            "Creating UI/UX designs",
            "Networking and hardware",
            "Cybersecurity"
        ]
    },

    {
        question: "Which school task do you prefer?",
        choices: [
            "Coding projects",
            "Design presentations",
            "Troubleshooting",
            "Research and analytics"
        ]
    },

    {
        question: "What would you rather do?",
        choices: [
            "Develop software",
            "Edit graphics/videos",
            "Configure networks",
            "Protect systems"
        ]
    },

    {
        question: "Which IT skill do you want to improve?",
        choices: [
            "Programming",
            "Web Design",
            "Hardware Servicing",
            "Security"
        ]
    }
];


/* =========================================================
   AUTH
========================================================= */

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
            "Take Exam Auth:",
            user.email
        );

        try {

            await loadActiveAcademicYear();
            await loadSpecializations();

        }
        catch (error) {

            console.error(
                "Take Exam initialization error:",
                error
            );

        }

    }
);


/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.getElementById("sidebar");

    if (sidebar) {

        sidebar.classList.toggle("active");

    }

}

window.toggleSidebar =
    toggleSidebar;


/* =========================================================
   NAVIGATION
========================================================= */

function goPage(url) {

    document.body.style.opacity = "0";

    setTimeout(
        () => {

            window.location.href = url;

        },
        300
    );

}

window.goPage =
    goPage;


/* =========================================================
   QUESTION NORMALIZING HELPERS
========================================================= */

/*
 * Questions are stored in two formats:
 *
 *   - PDF uploads (Admin): choices = ["...", "...", "...", "..."]
 *   - Faculty-created:     choices = { A: "...", B: "...", ... }
 *                          or choiceA / choiceB / choiceC / choiceD
 *
 * Convert all of them into a plain array of 4 strings
 * so every administered exam renders the same way.
 */

function normalizeChoices(data) {

    if (Array.isArray(data.choices)) {

        return [
            data.choices[0] || "",
            data.choices[1] || "",
            data.choices[2] || "",
            data.choices[3] || ""
        ].map(choice => String(choice));
    }

    if (data.choices && typeof data.choices === "object") {

        return [
            data.choices.A || "",
            data.choices.B || "",
            data.choices.C || "",
            data.choices.D || ""
        ].map(choice => String(choice));
    }

    return [
        data.choiceA || "",
        data.choiceB || "",
        data.choiceC || "",
        data.choiceD || ""
    ].map(choice => String(choice));
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

    return String(
        data.examTitle ||
        data.title ||
        ""
    ).trim();
}


/* =========================================================
   LOAD ACTIVE ACADEMIC YEAR
========================================================= */

async function loadActiveAcademicYear() {

    const yearElement =
        document.getElementById(
            "activeAcademicYear"
        );

    try {

        const q =
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
            );

        const snapshot =
            await getDocs(q);

        activeAcademicYear = "";

        if (!snapshot.empty) {

            const yearData = snapshot.docs[0].data();

            activeAcademicYear =
                yearData.year ||
                yearData.name ||
                "";

        }

        if (yearElement) {

            yearElement.textContent =
                activeAcademicYear ||
                "No active academic year";

        }

    }
    catch (error) {

        console.error(
            "Error loading academic year:",
            error
        );

        if (yearElement) {

            yearElement.textContent =
                "Unable to load";

        }

    }

}


/* =========================================================
   LOAD ADMIN-APPROVED SPECIALIZATIONS
========================================================= */

async function loadSpecializations() {

    const dropdown =
        document.getElementById(
            "specializationSelect"
        );

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

        const q =
            query(
                collection(
                    db,
                    "questionBank"
                ),
                where(
                    "academicYear",
                    "==",
                    activeAcademicYear
                )
            );

        const snapshot =
            await getDocs(q);

        const specializations =
            new Set();

        snapshot.forEach(
            (docSnapshot) => {

                const data =
                    docSnapshot.data();

                if (
                    data.status === "administered" &&
                    data.specialization
                ) {

                    specializations.add(
                        String(
                            data.specialization
                        ).trim()
                    );

                }

            }
        );

        dropdown.innerHTML = `
            <option value="">
                Select Specialization
            </option>
        `;

        Array.from(
            specializations
        )
        .sort()
        .forEach(
            (specialization) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    specialization;

                option.textContent =
                    specialization;

                dropdown.appendChild(
                    option
                );

            }
        );

        if (
            specializations.size === 0
        ) {

            dropdown.innerHTML = `
                <option value="">
                    No approved exam available
                </option>
            `;

        }

    }
    catch (error) {

        console.error(
            "Error loading specializations:",
            error
        );

        dropdown.innerHTML = `
            <option value="">
                Unable to load specializations
            </option>
        `;

    }

}


/* =========================================================
   START SELECTED EXAM
========================================================= */

async function startSelectedExam() {

    if (isSubmittingExam) {
        return;
    }

    const dropdown =
        document.getElementById(
            "specializationSelect"
        );

    if (!dropdown) {
        return;
    }

    const specialization =
        dropdown.value;

    if (!specialization) {

        alert(
            "Please select a specialization first."
        );

        return;
    }

    selectedSpecialization =
        specialization;

    await loadExam(
        specialization
    );

}

window.startSelectedExam =
    startSelectedExam;


/* =========================================================
   LOAD ADMIN-APPROVED EXAM
   Combines the questions of EVERY administered exam
   inside the chosen specialization.
========================================================= */

async function loadExam(
    specialization
) {

    const container =
        document.getElementById(
            "examContainer"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="no-exam">
            <h2>
                Loading Exam...
            </h2>

            <p>
                Please wait while the examination is loaded.
            </p>
        </div>
    `;

    try {

        const q =
            query(
                collection(
                    db,
                    "questionBank"
                ),
                where(
                    "academicYear",
                    "==",
                    activeAcademicYear
                )
            );

        const snapshot =
            await getDocs(q);

        const questionMap =
            new Map();

        const examTitleSet =
            new Set();

        snapshot.forEach(
            (docSnapshot) => {

                const data =
                    docSnapshot.data();

                /* Only administered questions. */
                if (
                    data.status !== "administered"
                ) {
                    return;
                }

                /* Only this specialization. */
                if (
                    String(
                        data.specialization || ""
                    ).trim() !==
                    String(
                        specialization
                    ).trim()
                ) {
                    return;
                }

                const questionText =
                    String(
                        data.question || ""
                    ).trim();

                if (!questionText) {
                    return;
                }

                const choicesList =
                    normalizeChoices(data);

                const correctLetter =
                    resolveCorrectLetter(
                        data,
                        choicesList
                    );

                const examTitle =
                    getExamTitleFromData(data);

                /*
                 * Remove duplicate questions. If the same question
                 * appears in more than one administered exam, the
                 * student only gets it once. Case, extra spaces and
                 * trailing punctuation are ignored when comparing.
                 */
                const duplicateKey =
                    questionText
                        .toLowerCase()
                        .replace(/\s+/g, " ")
                        .replace(/[\s.?!:;,]+$/, "")
                        .trim();

                if (
                    questionMap.has(
                        duplicateKey
                    )
                ) {

                    /*
                     * Keep the first copy, unless it has no usable
                     * correct answer and this copy does.
                     */
                    const existing =
                        questionMap.get(duplicateKey);

                    if (
                        existing.correctLetter ||
                        !correctLetter
                    ) {
                        return;
                    }
                }

                if (examTitle) {
                    examTitleSet.add(examTitle);
                }

                questionMap.set(
                    duplicateKey,
                    {
                        id:
                            docSnapshot.id,

                        ...data,

                        question:
                            questionText,

                        choicesList:
                            choicesList,

                        correctLetter:
                            correctLetter,

                        sourceExamTitle:
                            examTitle
                    }
                );

            }
        );

        currentQuestions =
            Array.from(
                questionMap.values()
            );

        if (
            currentQuestions.length === 0
        ) {

            renderNoExam();

            return;
        }

        /*
         * Combined exam title(s). Sorted so the same set
         * of administered exams always gives the same title
         * (needed for the "already completed" check).
         */
        selectedExamTitles =
            Array.from(examTitleSet).sort(
                (a, b) => a.localeCompare(b)
            );

        selectedExamTitle =
            selectedExamTitles.length > 0
                ? selectedExamTitles.join(" + ")
                : `${specialization} Examination`;

        /* Randomize, then apply the question limit. */
        shuffleArray(
            currentQuestions
        );

        currentQuestions =
            currentQuestions.slice(
                0,
                MAX_QUESTIONS
            );

        /*
         * Check if this student already completed
         * this combined exam.
         */
        const alreadyCompleted =
            await alreadyFinishedExam(
                selectedExamTitle,
                specialization
            );

        if (alreadyCompleted) {

            renderAlreadyCompleted();

            return;
        }

        renderExam();

    }
    catch (error) {

        console.error(
            "Error loading exam:",
            error
        );

        container.innerHTML = `
            <div class="no-exam">

                <h2>
                    Unable to Load Exam
                </h2>

                <p>
                    ${escapeHTML(
                        error.message ||
                        "An error occurred."
                    )}
                </p>

            </div>
        `;

    }

}


/* =========================================================
   RENDER EXAM
========================================================= */

function renderExam() {

    const container =
        document.getElementById(
            "examContainer"
        );

    if (!container) {
        return;
    }

    let html = `
        <div class="active-exam-header">

            <h2>
                ${escapeHTML(
                    selectedExamTitle
                )}
            </h2>

            <p>
                Specialization:

                <strong>
                    ${escapeHTML(
                        selectedSpecialization
                    )}
                </strong>
            </p>

            <p>
                Total Questions:

                <strong>
                    ${currentQuestions.length}
                </strong>
            </p>

        </div>
    `;


    /* =====================================================
       EXAM QUESTIONS
    ===================================================== */

    const letters = ["A", "B", "C", "D"];

    currentQuestions.forEach(
        (question, index) => {

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

            question.choicesList.forEach(
                (choice, choiceIndex) => {

                    /* Skip empty choices but keep the letters aligned. */
                    if (!choice.trim()) {
                        return;
                    }

                    const letter =
                        letters[choiceIndex];

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
                }
            );

            html += `
    </div>
`;

        }
    );


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

    interestQuestions.forEach(
        (q, index) => {

            html += `

            <div class="interest-question-panel">

                <div class="question-number">

                    Interest Question ${index + 1} of ${interestQuestions.length}

                </div>


                <div class="question-text">

                    ${escapeHTML(q.question)}

                </div>

        `;

            q.choices.forEach(
                (choice, choiceIndex) => {

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

                }
            );

            html += `

            </div>

        `;

        }
    );

    html += `

    </div>

`;

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
   ALREADY COMPLETED
========================================================= */

function renderAlreadyCompleted() {

    const container =
        document.getElementById(
            "examContainer"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="no-exam">

            <h2>
                Exam Already Completed
            </h2>

            <p>
                You have already completed

                <strong>
                    ${escapeHTML(
                        selectedExamTitle
                    )}
                </strong>

                for the academic year

                <strong>
                    ${escapeHTML(
                        activeAcademicYear
                    )}
                </strong>.
            </p>

        </div>
    `;

}


/* =========================================================
   NO EXAM
========================================================= */

function renderNoExam() {

    const container =
        document.getElementById(
            "examContainer"
        );

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="no-exam">

            <h2>
                No Exam Available
            </h2>

            <p>
                There is no Admin-approved examination available for this specialization yet.
            </p>

        </div>
    `;

}


/* =========================================================
   CHECK COMPLETED EXAM
========================================================= */

async function alreadyFinishedExam(
    examTitle,
    specialization
) {

    if (!currentUser) {
        return false;
    }

    try {

        const q =
            query(
                collection(
                    db,
                    "results"
                ),

                where(
                    "studentUid",
                    "==",
                    currentUser.uid
                ),

                where(
                    "academicYear",
                    "==",
                    activeAcademicYear
                )
            );

        const snapshot =
            await getDocs(q);

        let completed = false;

        snapshot.forEach(
            (docSnapshot) => {

                const result =
                    docSnapshot.data();

                if (
                    result.examTitle ===
                        examTitle &&

                    result.specialization ===
                        specialization &&

                    result.status ===
                        "Completed"
                ) {

                    completed = true;

                }

            }
        );

        return completed;

    }
    catch (error) {

        console.error(
            "Error checking previous result:",
            error
        );

        return false;

    }

}


/* =========================================================
   SUBMIT EXAM
========================================================= */

async function submitExam() {

    if (isSubmittingExam) {
        return;
    }

    if (!currentUser) {

        alert(
            "Your session has expired. Please log in again."
        );

        return;
    }


    /* =====================================================
       VALIDATE EXAM QUESTIONS
    ===================================================== */

    for (
        let i = 0;
        i < currentQuestions.length;
        i++
    ) {

        const selected =
            document.querySelector(
                `input[name="q${i}"]:checked`
            );

        if (!selected) {

            alert(
                `Please answer Question ${i + 1}.`
            );

            return;
        }

    }


    /* =====================================================
       VALIDATE INTEREST QUESTIONS
    ===================================================== */

    for (
        let i = 0;
        i < interestQuestions.length;
        i++
    ) {

        const selected =
            document.querySelector(
                `input[name="interest${i}"]:checked`
            );

        if (!selected) {

            alert(
                `Please answer Interest Question ${i + 1}.`
            );

            return;
        }

    }


    const submitButton =
        document.getElementById(
            "submitExamBtn"
        );

    isSubmittingExam = true;

    if (submitButton) {

        submitButton.disabled =
            true;

        submitButton.textContent =
            "Submitting...";

    }


    try {


        /* =================================================
           CALCULATE SCORE
        ================================================= */

        let originalScore = 0;

        currentQuestions.forEach(
            (question, index) => {

                const selected =
                    document.querySelector(
                        `input[name="q${index}"]:checked`
                    );

                if (!selected) {
                    return;
                }

                const answer =
                    selected.value;

                if (
                    question.correctLetter &&
                    answer ===
                    question.correctLetter
                ) {

                    originalScore++;

                }

            }
        );


        /* =================================================
           CHEATING PENALTY
        ================================================= */

        const cheatingPenalty =
            warningCount >= 2
                ? 2
                : 0;

        const score =
            Math.max(
                0,
                originalScore -
                cheatingPenalty
            );


        /* =================================================
           INTEREST SCORES
        ================================================= */

        const interestScores =
            processInterestAnswers();


        /* =================================================
           STUDENT NAME
        ================================================= */

        let studentName =
            localStorage.getItem(
                "currentStudentName"
            );

        if (!studentName) {

            studentName =
                currentUser.email ||
                "Student";

        }


        /* =================================================
           SAVE RESULT
        ================================================= */

        const resultData = {

            studentUid:
                currentUser.uid,

            studentName:
                studentName,

            studentEmail:
                currentUser.email || "",

            specialization:
                selectedSpecialization,

            examTitle:
                selectedExamTitle,

            examTitles:
                selectedExamTitles,

            academicYear:
                activeAcademicYear,

            score:
                score,

            originalScore:
                originalScore,

            cheatingWarnings:
                warningCount,

            cheatingPenalty:
                cheatingPenalty,

            totalItems:
                currentQuestions.length,

            interestScores:
                interestScores,

            date:
                new Date().toLocaleString(),

            status:
                "Completed"

        };


        const resultRef =
            await addDoc(
                collection(
                    db,
                    "results"
                ),
                resultData
            );


        console.log(
            "RESULT SAVED:",
            resultRef.id
        );


        /* =================================================
           ACTIVITY LOG
        ================================================= */

        await addDoc(
            collection(
                db,
                "activityLogs"
            ),
            {

                user:
                    studentName,

                role:
                    "Student",

                action:
                    "Finished Exam",

                status:
                    "Success",

                time:
                    new Date().toLocaleString(),

                timestamp:
                    Date.now()

            }
        );


        /* =================================================
           SAVE LAST RESULT ID
        ================================================= */

        sessionStorage.setItem(
            "lastSubmittedResultId",
            resultRef.id
        );


        /* =================================================
           REDIRECT
        ================================================= */

        alert(
            "Exam submitted successfully!"
        );

        window.location.replace(
            "../student/result.html"
        );

    }
    catch (error) {

        console.error(
            "Error submitting exam:",
            error
        );

        alert(
            "Unable to submit the examination.\n\n" +
            (error.message || "")
        );

        isSubmittingExam = false;

        if (submitButton) {

            submitButton.disabled =
                false;

            submitButton.textContent =
                "Submit Exam";

        }

    }

}

window.submitExam =
    submitExam;


/* =========================================================
   PROCESS INTEREST ANSWERS
========================================================= */

function processInterestAnswers() {

    const interestScores = {};

    interestQuestions.forEach(
        (question, index) => {

            const selected =
                document.querySelector(
                    `input[name="interest${index}"]:checked`
                );

            if (!selected) {
                return;
            }

            const answer =
                selected.value;

            if (!interestScores[answer]) {

                interestScores[answer] =
                    0;

            }

            interestScores[answer]++;

        }
    );

    return interestScores;

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffleArray(array) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );

        [
            array[i],
            array[j]
        ] = [
            array[j],
            array[i]
        ];

    }

}

/* =========================================================
   ANTI-CHEATING
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden &&
            currentQuestions.length > 0 &&
            !isSubmittingExam
        ) {

            /* ONLY ALLOW 2 WARNINGS */

            if (warningCount >= 2) {
                return;
            }

            warningCount++;

            console.warn(
                "Tab switch detected:",
                warningCount
            );

            const warningBox =
                document.getElementById(
                    "warningBox"
                );

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

                alert(
                    "Warning 1 of 2: Please stay on the examination page."
                );
            }

            /* SECOND WARNING - EXAM RECEIVES -2 POINTS */

            if (warningCount === 2) {

                alert(
                    "Warning 2 of 2: A 2-point deduction will be applied to your current specialization exam."
                );

                if (currentUser) {

                    const studentName =
                        localStorage.getItem(
                            "currentStudentName"
                        ) ||
                        currentUser.email ||
                        "Student";

                    addDoc(
                        collection(
                            db,
                            "activityLogs"
                        ),
                        {
                            user:
                                studentName,

                            role:
                                "Student",

                            action:
                                "Cheating Attempt",

                            status:
                                "Warning",

                            time:
                                new Date().toLocaleString(),

                            timestamp:
                                Date.now()
                        }
                    )
                    .catch(
                        (error) => {

                            console.error(
                                "Unable to save cheating log:",
                                error
                            );

                        }
                    );
                }
            }
        }
    }
);

/* =========================================================
   LOGOUT MODAL
========================================================= */

function logout() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );

    if (!overlay) {

        console.error(
            "Logout overlay not found."
        );

        return;
    }

    overlay.classList.add(
        "active"
    );

}

window.logout =
    logout;


/* =========================================================
   CLOSE LOGOUT MODAL
========================================================= */

function closeLogoutModal() {

    const overlay =
        document.getElementById(
            "logout-overlay"
        );

    if (overlay) {

        overlay.classList.remove(
            "active"
        );

    }

}

window.closeLogoutModal =
    closeLogoutModal;


/* =========================================================
   CLOSE LOGOUT MODAL WHEN CLICKING OUTSIDE
========================================================= */

function closeLogoutOutside(event) {

    if (
        event.target &&
        event.target.id ===
            "logout-overlay"
    ) {

        closeLogoutModal();

    }

}

window.closeLogoutOutside =
    closeLogoutOutside;


/* =========================================================
   PERFORM LOGOUT
========================================================= */

async function performLogout() {

    try {

        await signOut(auth);

        localStorage.clear();

        sessionStorage.clear();

        window.location.replace(
            "../login.html"
        );

    }
    catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Unable to log out."
        );

    }

}

window.performLogout =
    performLogout;


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   ESCAPE ATTRIBUTE
========================================================= */

function escapeAttribute(value) {

    return String(value ?? "")
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        )
        .replace(
            /\r/g,
            ""
        )
        .replace(
            /\n/g,
            " "
        );

}