/* =========================================================
   INTEREST CONFIGURATION (shared by every page)

   - The Admin tags each specialization with one or more of
     these INTEREST_AREAS (Academic Management page).
   - Students answer the questions below before the exam.
   - Each choice's position matches INTEREST_AREAS:
         choice 0 -> Programming
         choice 1 -> Web & Design
         choice 2 -> Hardware & Networking
         choice 3 -> Security & Data
========================================================= */

export const INTEREST_AREAS = [
    "Programming",
    "Web & Design",
    "Hardware & Networking",
    "Security & Data"
];

export const INTEREST_QUESTIONS = [
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

/*
   answers: array of chosen choice positions, e.g. [0, 0, 2, 0, 1]
   returns: { scores: [{ area, count }], topAreas: [area, ...] }
*/
export function scoreInterestAnswers(answers) {

    const counts = INTEREST_AREAS.map(() => 0);

    (answers || []).forEach(index => {

        if (Number.isInteger(index) && counts[index] !== undefined) {
            counts[index]++;
        }

    });

    const scores = INTEREST_AREAS.map((area, index) => ({
        area,
        count: counts[index]
    }));

    const max = Math.max(...counts);

    const topAreas = max > 0
        ? scores.filter(item => item.count === max).map(item => item.area)
        : [];

    return { scores, topAreas };

}
