// ============================================================
// FACULTY - CREATE EXAMS
// ============================================================

import {
    auth,
    db
} from "./firebase-config.js";

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

let currentFacultyUid = null;

let assignedSpecialization = "";

let activeAcademicYear = "";

let manualQuestionsArray = [];

let extractedQuestions = [];

let extractedAnswers = [];

let questionBankData = [];

let specializationsLoaded = false;


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// UI MESSAGE
// ============================================================

function showUIMessage(
    message,
    type = "info"
) {

    const box =
        document.getElementById(
            "uiNotification"
        );

    if (!box) {

        alert(
            message.replace(
                /<[^>]*>/g,
                ""
            )
        );

        return;
    }


    box.className =
        "alert-box";


    if (type === "success") {

        box.classList.add(
            "alert-success"
        );

    }

    else if (type === "warning") {

        box.classList.add(
            "alert-warning"
        );

    }

    else if (type === "danger") {

        box.classList.add(
            "alert-danger"
        );

    }

    else {

        box.classList.add(
            "alert-info"
        );

    }


    box.innerHTML =
        message;

    box.style.display =
        "block";


    box.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

}


// ============================================================
// HIDE MESSAGE
// ============================================================

function hideUIMessage() {

    const box =
        document.getElementById(
            "uiNotification"
        );

    if (box) {

        box.style.display =
            "none";

    }

}


// ============================================================
// AUTHENTICATION
// ============================================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.replace(
                "../login.html"
            );

            return;
        }


        currentFacultyUid =
            user.uid;


        await loadFacultySpecialization(
            user.uid
        );


        await loadActiveAcademicYear();


        await loadExistingExams();

    }
);


// ============================================================
// PAGE CACHE FIX
// ============================================================

window.addEventListener(
    "pageshow",
    (event) => {

        if (event.persisted) {

            window.location.reload();

        }

    }
);


// ============================================================
// LOAD FACULTY SPECIALIZATION
// ============================================================

async function loadFacultySpecialization(
    uid
) {

    if (specializationsLoaded) {
        return;
    }


    try {

        const userRef =
            doc(
                db,
                "users",
                uid
            );


        const userSnap =
            await getDoc(userRef);


        const dropdown =
            document.getElementById(
                "specializationSelect"
            );


        if (!dropdown) {
            return;
        }


        dropdown.innerHTML = `
            <option value="">
                Select Specialization
            </option>
        `;


        if (!userSnap.exists()) {

            dropdown.disabled =
                true;


            showUIMessage(
                "<strong>Error:</strong> Faculty profile document not found.",
                "danger"
            );

            return;
        }


        const data =
            userSnap.data();


        assignedSpecialization =
            data.specialization ||
            "";


        if (
            assignedSpecialization === ""
        ) {

            dropdown.disabled =
                true;


            showUIMessage(
                "<strong>Notice:</strong> No specialization is assigned to your faculty profile. Please contact your Program Chair.",
                "warning"
            );

            return;
        }


        dropdown.disabled =
            false;


        dropdown.innerHTML += `
            <option value="${escapeHTML(
                assignedSpecialization
            )}">
                ${escapeHTML(
                    assignedSpecialization
                )}
            </option>
        `;


        specializationsLoaded =
            true;


        hideUIMessage();

    }

    catch (error) {

        console.error(
            "Error loading faculty specialization:",
            error
        );


        showUIMessage(
            "<strong>Error:</strong> Failed to load specialization profile.",
            "danger"
        );

    }

}


// ============================================================
// SPECIALIZATION TOGGLE
// ============================================================

function setupSpecializationToggle() {

    const dropdown =
        document.getElementById(
            "specializationSelect"
        );


    const section =
        document.getElementById(
            "examCreationSection"
        );


    if (
        !dropdown ||
        !section
    ) {
        return;
    }


    section.style.display =
        "none";


    dropdown.addEventListener(
        "change",
        () => {

            if (
                dropdown.value !== ""
            ) {

                section.style.display =
                    "block";

                hideUIMessage();

            }

            else {

                section.style.display =
                    "none";

            }

        }
    );

}


// ============================================================
// LOAD ACTIVE ACADEMIC YEAR
// ============================================================

async function loadActiveAcademicYear() {

    try {

        const snapshot =
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


        activeAcademicYear =
            "";


        if (
            !snapshot.empty
        ) {

            const data =
                snapshot.docs[0].data();


            activeAcademicYear =
                data.year ||
                "";

        }


        if (
            activeAcademicYear === ""
        ) {

            showUIMessage(
                "<strong>Notice:</strong> No Active Academic Year found. Please ask the Administrator to set one.",
                "warning"
            );

        }

    }

    catch (error) {

        console.error(
            "Academic Year Error:",
            error
        );


        showUIMessage(
            "<strong>Error:</strong> Failed to load the active academic year.",
            "danger"
        );

    }

}


// ============================================================
// ADD MANUAL QUESTION
// ============================================================

function addManualQuestion() {

    const specialization =
        document.getElementById(
            "specializationSelect"
        ).value;


    const question =
        document.getElementById(
            "manualQuestion"
        ).value.trim();


    const A =
        document.getElementById(
            "choiceA"
        ).value.trim();


    const B =
        document.getElementById(
            "choiceB"
        ).value.trim();


    const C =
        document.getElementById(
            "choiceC"
        ).value.trim();


    const D =
        document.getElementById(
            "choiceD"
        ).value.trim();


    const correctAnswer =
        document.getElementById(
            "correctAnswer"
        ).value;


    if (
        specialization === ""
    ) {

        showUIMessage(
            "<strong>Warning:</strong> Please select a specialization first.",
            "warning"
        );

        return;
    }


    if (
        question === "" ||
        A === "" ||
        B === "" ||
        C === "" ||
        D === "" ||
        correctAnswer === ""
    ) {

        showUIMessage(
            "<strong>Warning:</strong> Please fill in all fields for the manual question.",
            "warning"
        );

        return;
    }


    if (
        activeAcademicYear === ""
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No Active Academic Year found.",
            "warning"
        );

        return;
    }


    manualQuestionsArray.push({

        question:
            question,

        A:
            A,

        B:
            B,

        C:
            C,

        D:
            D,

        correctAnswer:
            correctAnswer

    });


    renderManualQuestionsList();


    document.getElementById(
        "manualQuestion"
    ).value = "";


    document.getElementById(
        "choiceA"
    ).value = "";


    document.getElementById(
        "choiceB"
    ).value = "";


    document.getElementById(
        "choiceC"
    ).value = "";


    document.getElementById(
        "choiceD"
    ).value = "";


    document.getElementById(
        "correctAnswer"
    ).value = "";


    showUIMessage(
        "<strong>Success:</strong> Question added to the exam.",
        "success"
    );

}


// ============================================================
// RENDER MANUAL QUESTIONS
// ============================================================

function renderManualQuestionsList() {

    const list =
        document.getElementById(
            "manualQuestionsList"
        );


    const count =
        document.getElementById(
            "manualCount"
        );


    const saveButton =
        document.getElementById(
            "saveManualExamBtn"
        );


    if (count) {

        count.textContent =
            manualQuestionsArray.length;

    }


    if (!list) {
        return;
    }


    list.innerHTML =
        "";


    manualQuestionsArray.forEach(
        (item, index) => {

            const li =
                document.createElement(
                    "li"
                );


            li.innerHTML = `
                <strong>
                    Q${index + 1}:
                    ${escapeHTML(
                        item.question
                    )}
                </strong>

                <br>

                A:
                ${escapeHTML(item.A)}
                |

                B:
                ${escapeHTML(item.B)}
                |

                C:
                ${escapeHTML(item.C)}
                |

                D:
                ${escapeHTML(item.D)}

                <br>

                <em>
                    Correct Answer:
                    ${escapeHTML(
                        item.correctAnswer
                    )}
                </em>
            `;


            list.appendChild(li);

        }
    );


    if (saveButton) {

        saveButton.style.display =
            manualQuestionsArray.length > 0
                ? "inline-block"
                : "none";

    }

}


// ============================================================
// SAVE MANUAL EXAM
// ============================================================

async function saveManualQuestionsToFirestore() {

    const title =
        document.getElementById(
            "examTitle"
        ).value.trim();


    const specialization =
        document.getElementById(
            "specializationSelect"
        ).value;


    if (!title) {

        showUIMessage(
            "<strong>Warning:</strong> Please enter an Exam Title.",
            "warning"
        );

        return;
    }


    if (!specialization) {

        showUIMessage(
            "<strong>Warning:</strong> Please select a Specialization.",
            "warning"
        );

        return;
    }


    if (
        manualQuestionsArray.length === 0
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No manual questions to save.",
            "warning"
        );

        return;
    }


    if (
        activeAcademicYear === ""
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No Active Academic Year found.",
            "warning"
        );

        return;
    }


    try {

        const questionCollection =
            collection(
                db,
                "questionBank"
            );


        const chunkSize =
            450;


        for (
            let start = 0;
            start < manualQuestionsArray.length;
            start += chunkSize
        ) {

            const batch =
                writeBatch(db);


            const chunk =
                manualQuestionsArray.slice(
                    start,
                    start + chunkSize
                );


            chunk.forEach(
                (question) => {

                    const ref =
                        doc(
                            questionCollection
                        );


                    batch.set(
                        ref,
                        {

                            title:
                                title,

                            specialization:
                                specialization,

                            academicYear:
                                activeAcademicYear,

                            question:
                                question.question,

                            choices: [

                                question.A,
                                question.B,
                                question.C,
                                question.D

                            ],

                            correctAnswer:
                                question.correctAnswer,

                            createdBy:
                                currentFacultyUid,

                            type:
                                "manual",

                            status:
                                "ready_for_admin",

                            createdAt:
                                serverTimestamp()

                        }
                    );

                }
            );


            await batch.commit();

        }


        showUIMessage(
            "<strong>Success!</strong> Manual Exam created successfully and is ready for Program Chair administration.",
            "success"
        );


        manualQuestionsArray =
            [];


        renderManualQuestionsList();


        document.getElementById(
            "examTitle"
        ).value = "";


        await loadExistingExams();

    }

    catch (error) {

        console.error(
            "Error saving manual exam:",
            error
        );


        showUIMessage(
            "<strong>Error:</strong> Failed to save the manual exam. Please try again.",
            "danger"
        );

    }

}


// ============================================================
// QUESTION PDF UPLOAD
// ============================================================

function setupQuestionPDFUpload() {

    const dropArea =
        document.getElementById(
            "dropArea"
        );


    const fileInput =
        document.getElementById(
            "fileInput"
        );


    if (
        !dropArea ||
        !fileInput
    ) {
        return;
    }


    dropArea.addEventListener(
        "click",
        () => {

            fileInput.click();

        }
    );


    dropArea.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();

            dropArea.classList.add(
                "dragover"
            );

        }
    );


    dropArea.addEventListener(
        "dragleave",
        () => {

            dropArea.classList.remove(
                "dragover"
            );

        }
    );


    dropArea.addEventListener(
        "drop",
        (event) => {

            event.preventDefault();

            dropArea.classList.remove(
                "dragover"
            );


            const file =
                event.dataTransfer.files[0];


            readPDF(file);

        }
    );


    fileInput.addEventListener(
        "change",
        () => {

            readPDF(
                fileInput.files[0]
            );

        }
    );

}


// ============================================================
// READ PDF
// ============================================================

async function readPDF(file) {

    if (!file) {
        return;
    }


    if (
        file.type !== "application/pdf" &&
        !file.name
            .toLowerCase()
            .endsWith(".pdf")
    ) {

        showUIMessage(
            "<strong>Warning:</strong> Please upload a PDF file.",
            "warning"
        );

        return;
    }


    const status =
        document.getElementById(
            "uploadStatus"
        );


    if (status) {

        status.innerText =
            "Scanning PDF...";

    }


    try {

        const reader =
            new FileReader();


        reader.onload =
            async function () {

                try {

                    const typedArray =
                        new Uint8Array(
                            this.result
                        );


                    const pdf =
                        await pdfjsLib
                            .getDocument(
                                typedArray
                            )
                            .promise;


                    let text =
                        "";


                    for (
                        let i = 1;
                        i <= pdf.numPages;
                        i++
                    ) {

                        const page =
                            await pdf.getPage(
                                i
                            );


                        const content =
                            await page.getTextContent();


                        const strings =
                            content.items.map(
                                item =>
                                    item.str
                            );


                        text +=
                            strings.join(
                                " "
                            ) + " ";

                    }


                    extractQuestions(text);

                }

                catch (error) {

                    console.error(
                        "PDF Reading Error:",
                        error
                    );


                    if (status) {

                        status.innerText =
                            "Failed to read PDF.";

                    }


                    showUIMessage(
                        "<strong>Error:</strong> Failed to read the exam PDF.",
                        "danger"
                    );

                }

            };


        reader.readAsArrayBuffer(
            file
        );

    }

    catch (error) {

        console.error(
            "PDF Error:",
            error
        );

    }

}


// ============================================================
// EXTRACT QUESTIONS
// ============================================================

function extractQuestions(text) {

    extractedQuestions =
        [];


    const blocks =
        text
            .split(
                /\s+(?=\d+\s*[\.\)])/g
            )
            .map(
                block =>
                    block.trim()
            )
            .filter(
                block =>
                    block.length > 10
            );


    blocks.forEach(
        block => {

            block =
                block.replace(
                    /^\d+\s*[\.\)]\s*/,
                    ""
                );


            const optionMatches =
                [
                    ...block.matchAll(
                        /\s+([A-D])\s*[\.\)]\s+/gi
                    )
                ];


            if (
                optionMatches.length < 4
            ) {
                return;
            }


            const questionEnd =
                optionMatches[0].index;


            const question =
                block
                    .substring(
                        0,
                        questionEnd
                    )
                    .trim();


            const choices =
                [];


            for (
                let i = 0;
                i < optionMatches.length;
                i++
            ) {

                const current =
                    optionMatches[i];


                const start =
                    current.index +
                    current[0].length;


                const end =
                    i + 1 <
                    optionMatches.length
                        ? optionMatches[
                            i + 1
                        ].index
                        : block.length;


                choices.push(
                    block
                        .substring(
                            start,
                            end
                        )
                        .trim()
                );

            }


            if (
                question &&
                choices.length >= 4
            ) {

                extractedQuestions.push({

                    question:
                        question,

                    A:
                        choices[0],

                    B:
                        choices[1],

                    C:
                        choices[2],

                    D:
                        choices[3]

                });

            }

        }
    );


    const status =
        document.getElementById(
            "uploadStatus"
        );


    if (status) {

        status.innerText =
            extractedQuestions.length +
            " questions detected successfully";

    }


    if (
        extractedQuestions.length === 0
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No multiple-choice questions were detected. Please check the PDF format.",
            "warning"
        );

    }

    else {

        showUIMessage(
            "<strong>Success:</strong> " +
            extractedQuestions.length +
            " questions detected from the PDF.",
            "success"
        );

    }

}


// ============================================================
// ANSWER PDF UPLOAD
// ============================================================

function setupAnswerPDFUpload() {

    const dropArea =
        document.getElementById(
            "answerDropArea"
        );


    const fileInput =
        document.getElementById(
            "answerFileInput"
        );


    if (
        !dropArea ||
        !fileInput
    ) {
        return;
    }


    dropArea.addEventListener(
        "click",
        () => {

            fileInput.click();

        }
    );


    dropArea.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();

            dropArea.classList.add(
                "dragover"
            );

        }
    );


    dropArea.addEventListener(
        "dragleave",
        () => {

            dropArea.classList.remove(
                "dragover"
            );

        }
    );


    dropArea.addEventListener(
        "drop",
        (event) => {

            event.preventDefault();

            dropArea.classList.remove(
                "dragover"
            );


            const file =
                event.dataTransfer.files[0];


            readAnswerPDF(file);

        }
    );


    fileInput.addEventListener(
        "change",
        () => {

            readAnswerPDF(
                fileInput.files[0]
            );

        }
    );

}


// ============================================================
// READ ANSWER PDF
// ============================================================

async function readAnswerPDF(file) {

    if (!file) {
        return;
    }


    const status =
        document.getElementById(
            "answerStatus"
        );


    if (status) {

        status.innerText =
            "Scanning Answer Key...";

    }


    try {

        const reader =
            new FileReader();


        reader.onload =
            async function () {

                try {

                    const typedArray =
                        new Uint8Array(
                            this.result
                        );


                    const pdf =
                        await pdfjsLib
                            .getDocument(
                                typedArray
                            )
                            .promise;


                    let text =
                        "";


                    for (
                        let i = 1;
                        i <= pdf.numPages;
                        i++
                    ) {

                        const page =
                            await pdf.getPage(
                                i
                            );


                        const content =
                            await page.getTextContent();


                        const strings =
                            content.items.map(
                                item =>
                                    item.str
                            );


                        text +=
                            strings.join(
                                " "
                            ) + " ";

                    }


                    extractAnswers(text);

                }

                catch (error) {

                    console.error(
                        "Answer PDF Error:",
                        error
                    );


                    if (status) {

                        status.innerText =
                            "Failed to read answer key.";

                    }


                    showUIMessage(
                        "<strong>Error:</strong> Failed to read the answer key PDF.",
                        "danger"
                    );

                }

            };


        reader.readAsArrayBuffer(
            file
        );

    }

    catch (error) {

        console.error(
            "Answer Reading Error:",
            error
        );

    }

}


// ============================================================
// EXTRACT ANSWERS
// ============================================================

function extractAnswers(text) {

    extractedAnswers =
        [];


    const numbered =
        [
            ...text.matchAll(
                /\b\d+\s*[\.\)]\s*([A-D])\b/gi
            )
        ];


    if (
        numbered.length > 0
    ) {

        extractedAnswers =
            numbered.map(
                match =>
                    match[1]
                        .toUpperCase()
            );

    }

    else {

        const matches =
            text.match(
                /\b[A-D]\b/gi
            );


        if (matches) {

            extractedAnswers =
                matches.map(
                    answer =>
                        answer
                            .trim()
                            .toUpperCase()
                );

        }

    }


    const status =
        document.getElementById(
            "answerStatus"
        );


    if (status) {

        status.innerText =
            extractedAnswers.length +
            " answers detected successfully";

    }


    if (
        extractedAnswers.length === 0
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No answers were detected from the answer key PDF.",
            "warning"
        );

    }

    else {

        showUIMessage(
            "<strong>Success:</strong> " +
            extractedAnswers.length +
            " answers detected.",
            "success"
        );

    }

}


// ============================================================
// SUBMIT PDF QUESTIONS
// ============================================================

async function submitQuestions() {

    const title =
        document.getElementById(
            "examTitle"
        ).value.trim();


    const specialization =
        document.getElementById(
            "specializationSelect"
        ).value;


    if (!title) {

        showUIMessage(
            "<strong>Warning:</strong> Enter an exam title.",
            "warning"
        );

        return;
    }


    if (!specialization) {

        showUIMessage(
            "<strong>Warning:</strong> Select a specialization.",
            "warning"
        );

        return;
    }


    if (
        extractedQuestions.length === 0
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No questions loaded.",
            "warning"
        );

        return;
    }


    if (
        extractedAnswers.length === 0
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No answer key loaded.",
            "warning"
        );

        return;
    }


    if (
        extractedAnswers.length !==
        extractedQuestions.length
    ) {

        showUIMessage(
            "<strong>Warning:</strong> Answer key count does not match the number of questions.",
            "warning"
        );

        return;
    }


    if (
        activeAcademicYear === ""
    ) {

        showUIMessage(
            "<strong>Warning:</strong> No Active Academic Year found.",
            "warning"
        );

        return;
    }


    try {

        const collectionRef =
            collection(
                db,
                "questionBank"
            );


        const chunkSize =
            450;


        for (
            let start = 0;
            start < extractedQuestions.length;
            start += chunkSize
        ) {

            const batch =
                writeBatch(db);


            const chunk =
                extractedQuestions.slice(
                    start,
                    start + chunkSize
                );


            chunk.forEach(
                (question, index) => {

                    const actualIndex =
                        start + index;


                    const ref =
                        doc(
                            collectionRef
                        );


                    batch.set(
                        ref,
                        {

                            title:
                                title,

                            specialization:
                                specialization,

                            academicYear:
                                activeAcademicYear,

                            question:
                                question.question,

                            choices: [

                                question.A,
                                question.B,
                                question.C,
                                question.D

                            ],

                            correctAnswer:
                                extractedAnswers[
                                    actualIndex
                                ],

                            createdBy:
                                currentFacultyUid,

                            type:
                                "pdf",

                            status:
                                "ready_for_admin",

                            createdAt:
                                serverTimestamp()

                        }
                    );

                }
            );


            await batch.commit();

        }


        showUIMessage(
            "<strong>Success!</strong> " +
            extractedQuestions.length +
            " PDF questions were added successfully and are ready for Program Chair administration.",
            "success"
        );


        extractedQuestions =
            [];


        extractedAnswers =
            [];


        await loadExistingExams();


        document.getElementById(
            "examTitle"
        ).value = "";


        document.getElementById(
            "specializationSelect"
        ).value = "";


        const status =
            document.getElementById(
                "uploadStatus"
            );


        if (status) {

            status.innerText =
                "No exam file uploaded yet";

        }


        const answerStatus =
            document.getElementById(
                "answerStatus"
            );


        if (answerStatus) {

            answerStatus.innerText =
                "No answer key uploaded yet";

        }


        const fileInput =
            document.getElementById(
                "fileInput"
            );


        if (fileInput) {

            fileInput.value =
                "";

        }


        const answerInput =
            document.getElementById(
                "answerFileInput"
            );


        if (answerInput) {

            answerInput.value =
                "";

        }


        const section =
            document.getElementById(
                "examCreationSection"
            );


        if (section) {

            section.style.display =
                "none";

        }

    }

    catch (error) {

        console.error(
            "Submit Questions Error:",
            error
        );


        showUIMessage(
            "<strong>Error:</strong> Failed to save questions. Please try again.",
            "danger"
        );

    }

}


// ============================================================
// LOAD EXISTING EXAMS
// ============================================================

async function loadExistingExams() {

    const container =
        document.getElementById(
            "existingExams"
        );


    if (
        !container ||
        !currentFacultyUid
    ) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                query(
                    collection(
                        db,
                        "questionBank"
                    ),
                    where(
                        "createdBy",
                        "==",
                        currentFacultyUid
                    )
                )
            );


        questionBankData =
            [];


        snapshot.forEach(
            docSnap => {

                questionBankData.push({

                    id:
                        docSnap.id,

                    ...docSnap.data()

                });

            }
        );


        renderExistingExams();

    }

    catch (error) {

        console.error(
            "Existing Exams Error:",
            error
        );

    }

}


// ============================================================
// RENDER EXISTING EXAMS
// ============================================================

function renderExistingExams() {

    const container =
        document.getElementById(
            "existingExams"
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    const grouped =
        {};


    questionBankData.forEach(
        data => {

            if (
                !data.specialization ||
                !data.title
            ) {
                return;
            }


            if (
                !grouped[
                    data.specialization
                ]
            ) {

                grouped[
                    data.specialization
                ] = [];

            }


            const year =
                data.academicYear ||
                "No Year";


            const exists =
                grouped[
                    data.specialization
                ].find(
                    exam =>
                        exam.title ===
                            data.title &&
                        exam.academicYear ===
                            year
                );


            if (!exists) {

                grouped[
                    data.specialization
                ].push({

                    title:
                        data.title,

                    academicYear:
                        year,

                    type:
                        data.type ||
                        "manual",

                    status:
                        data.status ||
                        "ready_for_admin"

                });

            }

        }
    );


    if (
        Object.keys(grouped).length === 0
    ) {

        container.innerHTML =
            "<p>No exams created yet.</p>";

        return;
    }


    for (
        const specialization in grouped
    ) {

        let html = `
            <details class="exam-specialization">

                <summary>
                    ${escapeHTML(
                        specialization
                    )}
                </summary>
        `;


        grouped[
            specialization
        ].forEach(
            exam => {

                const type =
                    exam.type === "pdf"
                        ? "PDF Upload"
                        : "Manual Questions";


                html += `
                    <div class="exam-item">

                        <div>

                            <b>
                                ${escapeHTML(
                                    exam.title
                                )}
                            </b>

                            <br>

                            <small>
                                Academic Year:
                                ${escapeHTML(
                                    exam.academicYear
                                )}
                            </small>

                            <br>

                            <small>
                                Type:
                                ${type}
                            </small>

                            <br>

                            <small>
                                Status:
                                Ready for Administration
                            </small>

                        </div>

                    </div>
                `;

            }
        );


        html += `
            </details>
        `;


        container.innerHTML +=
            html;

    }

}


// ============================================================
// DELETE EXAM
// ============================================================

async function deleteExam(
    title,
    specialization,
    academicYear
) {

    const confirmed =
        confirm(
            "Do you want to delete this exam?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const snapshot =
            await getDocs(
                query(

                    collection(
                        db,
                        "questionBank"
                    ),

                    where(
                        "title",
                        "==",
                        title
                    ),

                    where(
                        "specialization",
                        "==",
                        specialization
                    ),

                    where(
                        "academicYear",
                        "==",
                        academicYear
                    ),

                    where(
                        "createdBy",
                        "==",
                        currentFacultyUid
                    )

                )
            );


        if (snapshot.empty) {

            showUIMessage(
                "<strong>Notice:</strong> Exam questions not found.",
                "warning"
            );

            return;
        }


        const batch =
            writeBatch(db);


        snapshot.docs.forEach(
            docSnap => {

                batch.delete(
                    doc(
                        db,
                        "questionBank",
                        docSnap.id
                    )
                );

            }
        );


        await batch.commit();


        showUIMessage(
            "<strong>Success:</strong> Exam deleted successfully.",
            "success"
        );


        await loadExistingExams();

    }

    catch (error) {

        console.error(
            "Delete Exam Error:",
            error
        );


        showUIMessage(
            "<strong>Error:</strong> Failed to delete exam. Please try again.",
            "danger"
        );

    }

}


// ============================================================
// SIDEBAR
// ============================================================

function toggleSidebar() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );


    if (sidebar) {

        sidebar.classList.toggle(
            "active"
        );

    }

}


// ============================================================
// PAGE NAVIGATION
// ============================================================

function goPage(url) {

    window.location.href =
        url;

}


// ============================================================
// DOM READY
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupSpecializationToggle();

        setupQuestionPDFUpload();

        setupAnswerPDFUpload();

        renderManualQuestionsList();

    }
);


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.addManualQuestion =
    addManualQuestion;

window.saveManualExam =
    saveManualQuestionsToFirestore;

window.submitQuestions =
    submitQuestions;

window.toggleSidebar =
    toggleSidebar;

window.deleteExam =
    deleteExam;

window.goPage =
    goPage;