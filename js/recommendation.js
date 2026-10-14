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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { appAlert } from "./ui-dialog.js";

import { INTEREST_AREAS } from "./interest-config.js";

/* =========================================================
   RECOMMENDATION RULES
   (Change the numbers here and the page AND the "How this
    works" panel update automatically. The Specialization Selection
    page imports this engine from this file.)
========================================================= */

const RULES = {
  // Rule 1: minimum exam items for a specialization to be rated
  MIN_ITEMS: 5,

  // Rule 2: performance levels (percentage of correct answers)
  HIGHLY_RECOMMENDED: 85,
  RECOMMENDED: 70,
  DEVELOPING: 50,

  // Rule 4: specializations within this many points of the top
  // score are shown as "also a close match"
  TIE_MARGIN: 5,

  // Rule 4/6: when exam confidence is Low, every score is weak, so a
  // wider range of specializations counts as "close" and interest
  // is allowed to choose among them
  LOW_CONFIDENCE_MARGIN: 15,
};

/* =========================================================
   STEP 1: BUILD PER-SPECIALIZATION SCORES
========================================================= */

export function buildSpecializationStats(results) {
  const map = new Map();

  function add(specialization, correct, total) {
    const name = String(specialization || "").trim();

    total = Number(total) || 0;
    correct = Number(correct) || 0;

    if (!name || total <= 0) return;

    if (!map.has(name)) {
      map.set(name, { correct: 0, total: 0 });
    }

    const entry = map.get(name);

    entry.correct += correct;
    entry.total += total;
  }

  results.forEach((result) => {
    // Terminated / unfinished attempts are never used.
    if (result.status !== "Completed") return;

    if (
      Array.isArray(result.specializationBreakdown) &&
      result.specializationBreakdown.length > 0
    ) {
      // Comprehensive exam: one entry per specialization
      result.specializationBreakdown.forEach((item) => {
        add(item.specialization, item.correct, item.total);
      });
    } else if (
      result.specialization &&
      result.specialization !== "All Specializations"
    ) {
      // Older single-specialization exam results
      add(
        result.specialization,
        result.originalScore ?? result.score,
        result.totalItems,
      );
    }
  });

  return [...map.entries()].map(([specialization, entry]) => ({
    specialization,
    correct: entry.correct,
    total: entry.total,
    percentage: (entry.correct / entry.total) * 100,
  }));
}

/* =========================================================
   INTEREST DATA (tags set by Admin + student answers)
========================================================= */

export async function loadSpecializationTags() {
  const tags = new Map();

  try {
    const snapshot = await getDocs(collection(db, "specializations"));

    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      const name = String(
        data.name || data.specialization || data.title || docSnapshot.id,
      )
        .trim()
        .toLowerCase();

      tags.set(
        name,
        Array.isArray(data.interestAreas) ? data.interestAreas : [],
      );
    });
  } catch (error) {
    // If students cannot read this collection, the exam alone decides.
    console.warn("Specialization tags unavailable:", error);
  }

  return tags;
}

export function getInterestProfile(results) {
  const completed = results.find(
    (result) =>
      result.status === "Completed" &&
      Array.isArray(result.interestScores) &&
      result.interestScores.length > 0,
  );

  if (!completed) return null;

  const counts = {};

  completed.interestScores.forEach((item) => {
    counts[item.area] = Number(item.count) || 0;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) return null;

  const max = Math.max(...Object.values(counts));

  const topAreas = Object.keys(counts).filter((area) => counts[area] === max);

  return { counts, total, topAreas };
}

function getInterestMatch(specialization, interest, tagMap) {
  if (!interest || !tagMap) return null;

  const areas = tagMap.get(String(specialization).trim().toLowerCase());

  if (!areas || areas.length === 0) return null;

  let bestArea = "";
  let bestCount = -1;

  areas.forEach((area) => {
    const count = interest.counts[area] || 0;

    if (count > bestCount) {
      bestCount = count;
      bestArea = area;
    }
  });

  return {
    pct: (bestCount / interest.total) * 100,
    area: bestArea,
  };
}

/* =========================================================
   STEP 2: RULE ENGINE
========================================================= */

function getLevel(percentage) {
  if (percentage >= RULES.HIGHLY_RECOMMENDED) {
    return { label: "Highly Recommended", color: "#2e8b57" };
  }

  if (percentage >= RULES.RECOMMENDED) {
    return { label: "Recommended", color: "#3b8ea5" };
  }

  if (percentage >= RULES.DEVELOPING) {
    return { label: "Developing", color: "#d98a00" };
  }

  return { label: "Not Yet Recommended", color: "#c0392b" };
}

export function evaluateRecommendation(stats, interest, tagMap) {
  // RULE 1: only rate specializations with enough exam items
  const reliable = stats.filter((item) => item.total >= RULES.MIN_ITEMS);

  const unreliable = stats.filter((item) => item.total < RULES.MIN_ITEMS);

  if (reliable.length === 0) {
    return {
      status: "insufficient",
      ranked: [],
      unreliable,
      primary: null,
      alsoClose: [],
      reasons: [
        `No specialization had at least ${RULES.MIN_ITEMS} ` +
          `exam items, so no reliable recommendation can be made.`,
      ],
    };
  }

  // RULE 3: rank by percentage, then more items answered
  // (more reliable), then alphabetical.
  const ranked = [...reliable].sort(
    (a, b) =>
      b.percentage - a.percentage ||
      b.total - a.total ||
      a.specialization.localeCompare(b.specialization),
  );

  const top = ranked[0];

  const reasons = [
    `Only specializations with at least ${RULES.MIN_ITEMS} exam ` +
      `items were rated (Rule 1).`,
  ];

  // RULE 5: confidence level (from the exam)
  let confidence = "High";

  if (top.percentage < RULES.DEVELOPING) {
    confidence = "Low";
  } else if (top.percentage < RULES.RECOMMENDED) {
    confidence = "Moderate";
  }

  // Attach the interest match to every rated specialization
  ranked.forEach((item) => {
    const match = getInterestMatch(item.specialization, interest, tagMap);

    item.interestPct = match ? match.pct : null;
    item.interestArea = match ? match.area : "";
  });

  // RULE 4: close candidates
  const margin =
    confidence === "Low" ? RULES.LOW_CONFIDENCE_MARGIN : RULES.TIE_MARGIN;

  const candidates = ranked.filter(
    (item) => top.percentage - item.percentage <= margin,
  );

  // RULE 6: interest decides among close candidates
  let primary = top;
  let decidedBy = "exam";

  const withInterest = candidates.filter(
    (item) => item.interestPct !== null && item.interestPct > 0,
  );

  if (candidates.length > 1 && withInterest.length > 0) {
    const best = [...withInterest].sort(
      (a, b) =>
        b.interestPct - a.interestPct ||
        b.percentage - a.percentage ||
        b.total - a.total ||
        a.specialization.localeCompare(b.specialization),
    )[0];

    primary = best;
    decidedBy = best === top ? "exam" : "interest";
  }

  const alsoClose = candidates.filter((item) => item !== primary);

  // ----- explanations -----
  if (decidedBy === "interest") {
    reasons.push(
      `${top.specialization} had the highest exam score ` +
        `(${top.percentage.toFixed(1)}%), but ${candidates.length} ` +
        `specializations were within ${margin} points of it, so the ` +
        `exam alone could not clearly decide (Rule 4).`,
    );

    reasons.push(
      `Your interest in ${primary.interestArea} ` +
        `(${primary.interestPct.toFixed(0)}% interest match) favored ` +
        `${primary.specialization}, so it is recommended (Rule 6).`,
    );
  } else {
    reasons.push(
      `${primary.specialization} has the highest score ` +
        `(${primary.percentage.toFixed(1)}%), which is "` +
        `${getLevel(primary.percentage).label}" (Rules 2 and 3).`,
    );

    if (alsoClose.length > 0) {
      reasons.push(
        `Within ${margin} points of the top score, these are ` +
          `also a close match (Rule 4): ` +
          alsoClose.map((item) => item.specialization).join(", ") +
          ".",
      );
    }

    if (primary.interestPct !== null && primary.interestPct > 0) {
      reasons.push(
        `It also matches your interest in ` +
          `${primary.interestArea} (Rule 6).`,
      );
    }
  }

  if (
    decidedBy !== "interest" &&
    ranked.length > 1 &&
    ranked.every((item) => top.percentage - item.percentage <= RULES.TIE_MARGIN)
  ) {
    reasons.push(
      `Your exam scores were nearly the same in every ` +
        `specialization, so the exam alone cannot clearly separate them.`,
    );
  }

  if (!interest && (confidence === "Low" || candidates.length > 1)) {
    reasons.push(
      `No interest answers were found for this attempt, so only ` +
        `the exam was used.`,
    );
  } else if (interest && candidates.length > 1 && withInterest.length === 0) {
    reasons.push(
      `Your interest answers could not be used because the Admin ` +
        `has not tagged these specializations with interest areas.`,
    );
  }

  if (confidence === "Low") {
    reasons.push(
      `Your score was below ${RULES.DEVELOPING}% in every ` +
        `specialization, so this shows where you did relatively ` +
        `best, not strong mastery. Please discuss it with your ` +
        `adviser (Rule 5).`,
    );
  } else if (confidence === "Moderate") {
    reasons.push(
      `Your best score is between ${RULES.DEVELOPING}% and ` +
        `${RULES.RECOMMENDED - 0.1}%, so treat this as a ` +
        `moderate-confidence suggestion (Rule 5).`,
    );
  }

  return {
    status: "recommended",
    confidence,
    decidedBy,
    interest,
    ranked,
    unreliable,
    primary,
    alsoClose,
    reasons,
  };
}

/* =========================================================
   PAGE CACHE FIX
========================================================= */

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

/* =========================================================
   SIDEBAR
========================================================= */

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");

  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

/* =========================================================
   NAVIGATION
========================================================= */

function goPage(url) {
  document.body.style.opacity = "0";

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

/* =========================================================
   LOGOUT (existing logout modal is kept as-is)
========================================================= */

function logout() {
  const overlay = document.getElementById("logout-overlay");

  if (!overlay) {
    console.error("Logout overlay not found.");

    return;
  }

  overlay.classList.add("active");
}

function closeLogoutModal() {
  const overlay = document.getElementById("logout-overlay");

  if (overlay) {
    overlay.classList.remove("active");
  }
}

function closeLogoutOutside(event) {
  if (event.target && event.target.id === "logout-overlay") {
    closeLogoutModal();
  }
}

async function performLogout() {
  try {
    await signOut(auth);

    localStorage.clear();

    window.location.replace("../login.html");
  } catch (error) {
    console.error("Logout error:", error);

    await appAlert("Unable to log out.", { type: "error" });
  }
}

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
   GET ACTIVE ACADEMIC YEAR
========================================================= */

async function getActiveAcademicYear() {
  const q = query(collection(db, "academicYears"), where("active", "==", true));

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return "";
  }

  const data = snapshot.docs[0].data();

  return String(data.year || data.name || "");
}

/* =========================================================
   CHECK IF ADMIN HAS APPROVED (ADMINISTERED) QUESTIONS
========================================================= */

async function hasApprovedQuestions(academicYear) {
  const q = query(
    collection(db, "questionBank"),
    where("academicYear", "==", academicYear),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.some(
    (docSnapshot) => docSnapshot.data().status === "administered",
  );
}

/* =========================================================
   GET STUDENT RESULTS
========================================================= */

async function getStudentResults(user, academicYear) {
  const q = query(
    collection(db, "results"),
    where("studentUid", "==", user.uid),
    where("academicYear", "==", academicYear),
  );

  const snapshot = await getDocs(q);

  const results = [];

  snapshot.forEach((docSnapshot) => {
    results.push({
      id: docSnapshot.id,
      ...docSnapshot.data(),
    });
  });

  return results;
}

/* =========================================================
   RENDER
========================================================= */

function levelBadge(percentage) {
  const level = getLevel(percentage);

  return `
        <span style="
            display:inline-block;padding:3px 10px;border-radius:20px;
            background:${level.color};color:#fff;font-size:12px;
            font-weight:700;">
            ${escapeHTML(level.label)}
        </span>
    `;
}

function interestLine(item) {
  if (item.interestPct === null || item.interestPct === undefined) {
    return `<span style="color:#829197;font-size:13px;">
            Interest match: not available</span>`;
  }

  return `Interest match: <b>${item.interestPct.toFixed(0)}%</b>
        (${escapeHTML(item.interestArea)})`;
}

function interestProfileHTML(interest) {
  if (!interest) return "";

  const rows = INTEREST_AREAS.map((area) => {
    const count = interest.counts[area] || 0;
    const pct = (count / interest.total) * 100;
    const isTop = interest.topAreas.includes(area);

    return `
            <div style="margin:8px 0;">
                <div style="display:flex;justify-content:space-between;
                    font-size:13px;">
                    <span>${escapeHTML(area)}${isTop ? " ★" : ""}</span>
                    <span>${count}/${interest.total}</span>
                </div>
                <div style="height:7px;background:#e8eff1;
                    border-radius:20px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;
                        background:#8ec6d1;"></div>
                </div>
            </div>
        `;
  }).join("");

  return `
        <h3 style="margin:18px 0 6px;">Your Interest Profile</h3>
        ${rows}
    `;
}

function rulesPanelHTML() {
  return `
        <details style="margin-top:22px;">
            <summary style="cursor:pointer;font-weight:700;">
                How this recommendation works
            </summary>

            <ol style="line-height:1.7;margin-top:10px;">
                <li><b>Rule 1 - Minimum items:</b> a specialization is
                    rated only if it had at least ${RULES.MIN_ITEMS} exam items.</li>
                <li><b>Rule 2 - Levels:</b>
                    ${RULES.HIGHLY_RECOMMENDED}% and above = Highly Recommended;
                    ${RULES.RECOMMENDED}% to ${RULES.HIGHLY_RECOMMENDED - 0.1}% = Recommended;
                    ${RULES.DEVELOPING}% to ${RULES.RECOMMENDED - 0.1}% = Developing;
                    below ${RULES.DEVELOPING}% = Not Yet Recommended.</li>
                <li><b>Rule 3 - Best match:</b> the specialization with the
                    highest percentage is recommended. Ties go to the one with
                    more exam items, then alphabetical order.</li>
                <li><b>Rule 4 - Close candidates:</b> specializations within
                    ${RULES.TIE_MARGIN} points of the top score
                    (${RULES.LOW_CONFIDENCE_MARGIN} points when confidence is
                    Low) are treated as close candidates.</li>
                <li><b>Rule 5 - Confidence:</b> a recommendation is always
                    given. Confidence is High if the best score is
                    ${RULES.RECOMMENDED}% or above, Moderate from
                    ${RULES.DEVELOPING}% to ${RULES.RECOMMENDED - 0.1}%, and
                    Low below ${RULES.DEVELOPING}%. Low-confidence results
                    are flagged for adviser consultation.</li>
                <li><b>Rule 6 - Interest tie-break:</b> when there is more
                    than one close candidate, the one that best matches the
                    student's interest answers is recommended. Each
                    specialization's interest areas are assigned by the Admin.
                    If interest data or tags are missing, the exam decides.</li>
            </ol>

            <p style="color:#667981;font-size:13px;">
                Only completed exams in the active academic year are used.
                Terminated attempts are ignored.
            </p>
        </details>
    `;
}

function renderRecommendation(container, evaluation, continueBtn) {
  if (evaluation.status === "insufficient") {
    container.innerHTML = `
            <div class="rec-empty">
                <h2>Not enough exam data yet.</h2>
                <p>${escapeHTML(evaluation.reasons[0])}</p>
                ${rulesPanelHTML()}
            </div>
        `;

    return;
  }

  const {
    primary,
    alsoClose,
    ranked,
    unreliable,
    reasons,
    confidence,
    interest,
  } = evaluation;

  const confidenceColor = {
    High: "#2e8b57",
    Moderate: "#d98a00",
    Low: "#c0392b",
  }[confidence];

  const headline =
    confidence === "Low" ? "Best Relative Fit" : "Recommended Specialization";

  const adviceHTML =
    confidence === "Low"
      ? `
            <div style="margin:16px 0;padding:14px 16px;
                background:#fff8e8;border:1px solid #f0dca8;
                border-radius:10px;color:#6b5314;line-height:1.5;">
                Your exam scores were low across all specializations.
                This is the specialization where you did relatively best,
                not a guarantee. Please talk with your adviser before
                deciding.
            </div>
        `
      : "";

  let rankingHTML = "";

  ranked.forEach((item, index) => {
    rankingHTML += `
            <div class="ranking-card">
                <h3>${index + 1}. ${escapeHTML(item.specialization)}</h3>
                <p>
                    Exam Match Score:
                    <b>${item.percentage.toFixed(1)}%</b>
                    (${item.correct}/${item.total} correct)
                    &nbsp; ${levelBadge(item.percentage)}
                    <br>
                    ${interestLine(item)}
                </p>
            </div>
        `;
  });

  let unreliableHTML = "";

  if (unreliable.length > 0) {
    unreliableHTML = `
            <p style="color:#667981;font-size:13px;margin-top:14px;">
                Not rated (fewer than ${RULES.MIN_ITEMS} exam items):
                ${unreliable
                  .map(
                    (item) =>
                      `${escapeHTML(item.specialization)} (${item.total})`,
                  )
                  .join(", ")}
            </p>
        `;
  }

  const closeHTML =
    alsoClose.length > 0
      ? `<p><b>Also a close match:</b> ${alsoClose
          .map((item) => escapeHTML(item.specialization))
          .join(", ")}</p>`
      : "";

  const reasonsHTML = reasons
    .map((text) => `<li>${escapeHTML(text)}</li>`)
    .join("");

  container.innerHTML = `
        <div class="rec-main">

            <div class="rec-icon">
                <svg viewBox="0 0 24 24" width="32" height="32"
                    fill="none" stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3l2.6 5.3L20.5 9l-4.2 4.1 1 5.9L12 16.2 6.7 19l1-5.9L3.5 9l5.9-.7L12 3z"></path>
                </svg>
            </div>

            <div>
                <div style="font-size:13px;color:#667981;">
                    ${headline}
                </div>

                <div class="rec-name">
                    ${escapeHTML(primary.specialization)}
                </div>

                <p>
                    ${levelBadge(primary.percentage)}
                    &nbsp; ${primary.percentage.toFixed(1)}%
                    (${primary.correct}/${primary.total} correct)
                </p>

                <p>
                    Confidence:
                    <b style="color:${confidenceColor};">${confidence}</b>
                </p>

                ${closeHTML}
            </div>
        </div>

        ${adviceHTML}

        ${interestProfileHTML(interest)}

        <h3 style="margin:18px 0 6px;">Why this recommendation?</h3>
        <ul style="line-height:1.6;margin:0;">${reasonsHTML}</ul>

        <br>

        <div class="ranking-section">
            <h2>Specialization Rankings</h2>
            ${rankingHTML}
            ${unreliableHTML}
        </div>

        ${rulesPanelHTML()}
    `;

  if (continueBtn) {
    continueBtn.style.display = "inline-block";
  }
}

/* =========================================================
   LOAD RECOMMENDATION
========================================================= */

async function loadRecommendation(user) {
  const container = document.getElementById("recommendationContainer");

  if (!container) return;

  const continueBtn = document.getElementById("continueBtn");

  if (continueBtn) {
    continueBtn.style.display = "none";
  }

  container.innerHTML = `
        <div class="loading-box">
            <h2>Checking Your Exam Results...</h2>
            <p>Please wait.</p>
        </div>
    `;

  try {
    const activeAcademicYear = await getActiveAcademicYear();

    if (!activeAcademicYear) {
      container.innerHTML = `
                <div class="rec-empty">
                    <p>No active academic year is available yet.</p>
                </div>
            `;

      return;
    }

    const results = await getStudentResults(user, activeAcademicYear);

    const hasCompleted = results.some(
      (result) => result.status === "Completed",
    );

    if (!hasCompleted) {
      const approved = await hasApprovedQuestions(activeAcademicYear);

      container.innerHTML = approved
        ? `
                    <div class="rec-empty">
                        <h2>You have not completed the exam yet.</h2>
                        <p>
                            Go to <strong>Take Exam</strong> and finish the
                            Comprehensive IT Examination to get your
                            recommendation.
                        </p>
                    </div>
                `
        : `
                    <div class="rec-empty">
                        <h2>No approved exam yet.</h2>
                        <p>
                            Please wait for the Admin to administer the
                            examination.
                        </p>
                    </div>
                `;

      return;
    }

    const stats = buildSpecializationStats(results);

    const tagMap = await loadSpecializationTags();

    const interest = getInterestProfile(results);

    const evaluation = evaluateRecommendation(stats, interest, tagMap);

    renderRecommendation(container, evaluation, continueBtn);
  } catch (error) {
    console.error("Recommendation error:", error);

    container.innerHTML = `
            <div class="rec-empty">
                <p>
                    Unable to load your recommendation.
                    Please try again.
                </p>
            </div>
        `;
  }
}

/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../Login.html");

    return;
  }

  loadRecommendation(user);
});

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.toggleSidebar = toggleSidebar;
window.goPage = goPage;
window.logout = logout;
window.closeLogoutModal = closeLogoutModal;
window.closeLogoutOutside = closeLogoutOutside;
window.performLogout = performLogout;
