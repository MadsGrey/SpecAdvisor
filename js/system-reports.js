import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   REPORT VARIABLES
========================================================= */

let reportRows = [];
let reportHeaders = [];
let reportTitle = "";
let reportTypeGenerated = "";

let sections = [];
let specializations = [];
let studentChoiceSpecializations = [];

/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../login.html");
  }
});

/* =========================================================
   BACK BUTTON PROTECTION
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

  if (!sidebar) return;

  sidebar.classList.toggle("active");
}

/* =========================================================
   NAVIGATION
========================================================= */

function goPage(url) {
  window.location.href = url;
}

/* =========================================================
   UPDATE MAIN FILTERS
========================================================= */

function updateFilters() {
  const reportTypeElement = document.getElementById("reportType");

  if (!reportTypeElement) return;

  const reportType = reportTypeElement.value;

  const roleGroup = document.getElementById("roleFilterGroup");

  const studentSectionGroup = document.getElementById(
    "studentSectionFilterGroup",
  );

  const facultySpecializationGroup = document.getElementById(
    "facultySpecializationFilterGroup",
  );

  const sectionGroup = document.getElementById("sectionFilterGroup");

  const studentChoiceGroup = document.getElementById(
    "studentChoiceSpecializationFilterGroup",
  );

  const dateGroup = document.getElementById("dateFilterGroup");

  const timeGroup = document.getElementById("activityTimeFilterGroup");

  /* =====================================================
     HIDE EVERYTHING FIRST
  ===================================================== */

  if (roleGroup) {
    roleGroup.style.display = "none";
  }

  if (studentSectionGroup) {
    studentSectionGroup.style.display = "none";
  }

  if (facultySpecializationGroup) {
    facultySpecializationGroup.style.display = "none";
  }

  if (sectionGroup) {
    sectionGroup.style.display = "none";
  }

  if (studentChoiceGroup) {
    studentChoiceGroup.style.display = "none";
  }

  if (dateGroup) {
    dateGroup.style.display = "none";
  }

  if (timeGroup) {
    timeGroup.style.display = "none";
  }

  /* =====================================================
     USER ACCOUNTS REPORT
  ===================================================== */

  if (reportType === "users") {
    if (roleGroup) {
      roleGroup.style.display = "flex";
    }

    updateRoleDependentFilters();
  } else if (reportType === "activity") {

  /* =====================================================
     ACTIVITY REPORT
  ===================================================== */
    if (dateGroup) {
      dateGroup.style.display = "flex";
    }

    if (timeGroup) {
      timeGroup.style.display = "flex";
    }
  } else if (reportType === "specialization") {

  /* =====================================================
     SPECIALIZATION REPORT
  ===================================================== */
    if (sectionGroup) {
      sectionGroup.style.display = "flex";
    }

    if (studentChoiceGroup) {
      studentChoiceGroup.style.display = "flex";
    }
  }
}

/* =========================================================
   ROLE DEPENDENT FILTERS
========================================================= */

function updateRoleDependentFilters() {
  const roleElement = document.getElementById("roleFilter");

  if (!roleElement) return;

  const role = roleElement.value;

  const studentSectionGroup = document.getElementById(
    "studentSectionFilterGroup",
  );

  const facultySpecializationGroup = document.getElementById(
    "facultySpecializationFilterGroup",
  );

  /* =====================================================
     HIDE BOTH FIRST
  ===================================================== */

  if (studentSectionGroup) {
    studentSectionGroup.style.display = "none";
  }

  if (facultySpecializationGroup) {
    facultySpecializationGroup.style.display = "none";
  }

  /* =====================================================
     STUDENT
  ===================================================== */

  if (role.toLowerCase() === "student") {
    if (studentSectionGroup) {
      studentSectionGroup.style.display = "flex";
    }
  } else if (role.toLowerCase() === "faculty") {

  /* =====================================================
     FACULTY
  ===================================================== */
    if (facultySpecializationGroup) {
      facultySpecializationGroup.style.display = "flex";
    }
  }
}

/* =========================================================
   LOAD ACADEMIC YEARS
========================================================= */

async function loadAcademicYears() {
  const select = document.getElementById("academicYearFilter");

  if (!select) return;

  try {
    const snapshot = await getDocs(collection(db, "academicYears"));

    select.innerHTML = "";

    const allOption = document.createElement("option");

    allOption.value = "";

    allOption.textContent = "All Academic Years";

    select.appendChild(allOption);

    const years = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      if (!data.year) return;

      const year = String(data.year);

      if (!years.includes(year)) {
        years.push(year);
      }
    });

    years.sort();

    years.forEach((year) => {
      const option = document.createElement("option");

      option.value = year;

      option.textContent = year;

      select.appendChild(option);
    });
  } catch (error) {
    console.error("Unable to load academic years:", error);
  }
}

/* =========================================================
   LOAD SECTIONS
   FROM SECTIONS COLLECTION + USERS
========================================================= */

async function loadSections() {
  try {
    const sectionSet = new Set();

    /* -----------------------------------------
       LOAD FROM SECTIONS COLLECTION
    ----------------------------------------- */

    const sectionSnapshot = await getDocs(collection(db, "sections"));

    sectionSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const section = data.name || data.section || data.title || "";

      if (section) {
        sectionSet.add(String(section));
      }
    });

    /* -----------------------------------------
       ALSO LOAD FROM USERS
    ----------------------------------------- */

    const usersSnapshot = await getDocs(collection(db, "users"));

    usersSnapshot.forEach((docSnap) => {
      const user = docSnap.data();

      const role = String(user.role || "").toLowerCase();

      if (role !== "student") {
        return;
      }

      const section = user.section || "";

      if (section) {
        sectionSet.add(String(section));
      }
    });

    sections = Array.from(sectionSet).sort();

    populateSectionDropdowns();
  } catch (error) {
    console.error("Unable to load sections:", error);
  }
}

/* =========================================================
   POPULATE SECTION DROPDOWNS
========================================================= */

function populateSectionDropdowns() {
  const studentSelect = document.getElementById("studentSectionFilter");

  const specializationSelect = document.getElementById("sectionFilter");

  /* -----------------------------------------
     STUDENT USER FILTER
  ----------------------------------------- */

  if (studentSelect) {
    studentSelect.innerHTML = `
      <option value="">
        All Sections
      </option>
    `;

    sections.forEach((section) => {
      const option = document.createElement("option");

      option.value = section;

      option.textContent = section;

      studentSelect.appendChild(option);
    });
  }

  /* -----------------------------------------
     SPECIALIZATION REPORT SECTION FILTER
  ----------------------------------------- */

  if (specializationSelect) {
    specializationSelect.innerHTML = `
      <option value="">
        All Sections
      </option>
    `;

    sections.forEach((section) => {
      const option = document.createElement("option");

      option.value = section;

      option.textContent = section;

      specializationSelect.appendChild(option);
    });
  }
}

/* =========================================================
   LOAD SPECIALIZATIONS
   FROM COLLECTION + FACULTY USERS
========================================================= */

async function loadSpecializations() {
  try {
    const specializationSet = new Set();

    /* -----------------------------------------
       SPECIALIZATIONS COLLECTION
    ----------------------------------------- */

    const specializationSnapshot = await getDocs(
      collection(db, "specializations"),
    );

    specializationSnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const specialization =
        data.name || data.specialization || data.title || "";

      if (specialization) {
        specializationSet.add(String(specialization));
      }
    });

    /* -----------------------------------------
       FACULTY USERS
    ----------------------------------------- */

    const usersSnapshot = await getDocs(collection(db, "users"));

    usersSnapshot.forEach((docSnap) => {
      const user = docSnap.data();

      const role = String(user.role || "").toLowerCase();

      if (role !== "faculty") {
        return;
      }

      const specialization = user.specialization || "";

      if (specialization) {
        specializationSet.add(String(specialization));
      }
    });

    specializations = Array.from(specializationSet).sort();

    populateSpecializationDropdown();
  } catch (error) {
    console.error("Unable to load specializations:", error);
  }
}

/* =========================================================
   POPULATE FACULTY SPECIALIZATION DROPDOWN
========================================================= */

function populateSpecializationDropdown() {
  const select = document.getElementById("facultySpecializationFilter");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      All Specializations
    </option>
  `;

  specializations.forEach((specialization) => {
    const option = document.createElement("option");

    option.value = specialization;

    option.textContent = specialization;

    select.appendChild(option);
  });
}

/* =========================================================
   LOAD STUDENT CHOICE SPECIALIZATIONS
========================================================= */

async function loadStudentChoiceSpecializations() {
  try {
    const choiceSet = new Set();

    const usersSnapshot = await getDocs(collection(db, "users"));

    usersSnapshot.forEach((docSnap) => {
      const user = docSnap.data();

      const role = String(user.role || "").toLowerCase();

      if (role !== "student") {
        return;
      }

      const selectedSpecialization = user.selectedSpecialization || "";

      if (selectedSpecialization) {
        choiceSet.add(String(selectedSpecialization));
      }
    });

    studentChoiceSpecializations = Array.from(choiceSet).sort();

    populateStudentChoiceDropdown();
  } catch (error) {
    console.error("Unable to load student choices:", error);
  }
}

/* =========================================================
   POPULATE STUDENT CHOICE DROPDOWN
========================================================= */

function populateStudentChoiceDropdown() {
  const select = document.getElementById("studentChoiceSpecializationFilter");

  if (!select) return;

  select.innerHTML = `
    <option value="">
      All Specializations
    </option>
  `;

  studentChoiceSpecializations.forEach((specialization) => {
    const option = document.createElement("option");

    option.value = specialization;

    option.textContent = specialization;

    select.appendChild(option);
  });
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}

/* =========================================================
   RENDER REPORT TABLE
========================================================= */

function renderReportTable(headers, rows, type) {
  const preview = document.getElementById("reportPreview");

  if (!preview) return;

  reportHeaders = headers;

  reportRows = rows;

  reportTypeGenerated = type;

  preview.innerHTML = "";

  if (!rows || rows.length === 0) {
    const empty = document.createElement("div");

    empty.className = "no-report";

    empty.textContent = "No report data found.";

    preview.appendChild(empty);

    return;
  }

  const title = document.createElement("h3");

  title.textContent = reportTitle;

  preview.appendChild(title);

  const wrapper = document.createElement("div");

  wrapper.className = "report-table-container";

  const table = document.createElement("table");

  table.className =
    "report-table " +
    (type === "users"
      ? "users-report"
      : type === "activity"
        ? "activity-report"
        : "specialization-report");

  /* HEADER */

  const thead = document.createElement("thead");

  const headerRow = document.createElement("tr");

  headers.forEach((header) => {
    const th = document.createElement("th");

    th.textContent = header;

    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  table.appendChild(thead);

  /* BODY */

  const tbody = document.createElement("tbody");

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    row.forEach((value) => {
      const td = document.createElement("td");

      td.innerHTML = escapeHTML(value);

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  wrapper.appendChild(table);

  preview.appendChild(wrapper);
}

/* =========================================================
   GENERATE REPORT
========================================================= */

async function generateReport() {
  const reportType = document.getElementById("reportType")?.value;

  const preview = document.getElementById("reportPreview");

  if (!preview) return;

  preview.innerHTML = `
    <div class="no-report">
      Generating report...
    </div>
  `;

  reportRows = [];
  reportHeaders = [];
  reportTitle = "";

  try {
    const academicYear =
      document.getElementById("academicYearFilter")?.value || "";

    if (reportType === "users") {
      await generateUsersReport(academicYear);
    } else if (reportType === "activity") {
      await generateActivityReport(academicYear);
    } else if (reportType === "specialization") {
      await generateSpecializationReport(academicYear);
    }
  } catch (error) {
    console.error("Generate report error:", error);

    preview.innerHTML = `
      <div class="no-report">
        Unable to generate report.
      </div>
    `;
  }
}

/* =========================================================
   USER ACCOUNTS REPORT
========================================================= */

async function generateUsersReport(selectedAcademicYear) {
  const roleFilter = document.getElementById("roleFilter")?.value || "";

  const sectionFilter =
    document.getElementById("studentSectionFilter")?.value || "";

  const specializationFilter =
    document.getElementById("facultySpecializationFilter")?.value || "";

  let usersQuery = collection(db, "users");

  /* =====================================================
     ACADEMIC YEAR
  ===================================================== */

  if (selectedAcademicYear) {
    usersQuery = query(
      collection(db, "users"),
      where("activeAcademicYear", "==", selectedAcademicYear),
    );
  }

  const snapshot = await getDocs(usersQuery);

  const rows = [];

  snapshot.forEach((docSnap) => {
    const user = docSnap.data();

    const role = String(user.role || "").trim();

    const normalizedRole = role.toLowerCase();

    /* ROLE FILTER */

    if (
      roleFilter &&
      roleFilter !== "All" &&
      normalizedRole !== roleFilter.toLowerCase()
    ) {
      return;
    }

    /* STUDENT SECTION FILTER */

    if (normalizedRole === "student") {
      if (
        sectionFilter &&
        sectionFilter !== "All" &&
        String(user.section || "") !== String(sectionFilter)
      ) {
        return;
      }
    }

    /* FACULTY SPECIALIZATION FILTER */

    if (normalizedRole === "faculty") {
      if (
        specializationFilter &&
        specializationFilter !== "All" &&
        String(user.specialization || "") !== String(specializationFilter)
      ) {
        return;
      }
    }

    const userId =
      user.studentNumber ||
      user.facultyId ||
      user.idNumber ||
      user.userId ||
      docSnap.id ||
      "N/A";

    const name = user.fullname || user.name || "N/A";

    let assignment = "—";

    if (normalizedRole === "student") {
      assignment = user.section || "Not Assigned";
    } else if (normalizedRole === "faculty") {
      assignment = user.specialization || "Not Assigned";
    }

    const year = user.activeAcademicYear || "N/A";

    const status = user.active === false ? "Inactive" : "Active";

    rows.push([userId, name, role || "N/A", assignment, year, status]);
  });

  rows.sort((a, b) => String(a[2]).localeCompare(String(b[2])));

  reportTitle = "USER ACCOUNTS REPORT";

  renderReportTable(
    [
      "Student / Faculty ID",
      "Name",
      "Role",
      "Section / Specialization",
      "Academic Year",
      "Status",
    ],

    rows,

    "users",
  );
}

/* =========================================================
   ACTIVITY REPORT
   PHILIPPINE TIMEZONE
   DATE + TIME FILTER
   RESOLVE USER NAME FROM USERS COLLECTION
========================================================= */

async function generateActivityReport(selectedAcademicYear) {
  const selectedDate = document.getElementById("dateFilter")?.value || "";

  const selectedTime =
    document.getElementById("activityTimeFilter")?.value || "";

  let activityQuery = collection(db, "activityLogs");

  /* =====================================================
     ACADEMIC YEAR FILTER
  ===================================================== */

  if (selectedAcademicYear) {
    activityQuery = query(
      collection(db, "activityLogs"),
      where("academicYear", "==", selectedAcademicYear),
    );
  }

  /* =====================================================
     LOAD ACTIVITY LOGS + USERS
  ===================================================== */

  const [activitySnapshot, usersSnapshot] = await Promise.all([
    getDocs(activityQuery),

    getDocs(collection(db, "users")),
  ]);

  /* =====================================================
     CREATE USER LOOKUP
  ===================================================== */

  const usersByIdentifier = new Map();

  usersSnapshot.forEach((docSnap) => {
    const user = docSnap.data();

    const fullname = user.fullname || user.name || "";

    if (!fullname) {
      return;
    }

    /* Firestore document ID */

    usersByIdentifier.set(
      String(docSnap.id).trim().toLowerCase(),

      fullname,
    );

    /* Other possible identifiers */

    const identifiers = [
      user.uid,
      user.userId,
      user.email,
      user.studentNumber,
      user.facultyId,
      user.idNumber,
      user.username,
    ];

    identifiers.forEach((identifier) => {
      if (
        identifier !== undefined &&
        identifier !== null &&
        String(identifier).trim() !== ""
      ) {
        usersByIdentifier.set(
          String(identifier).trim().toLowerCase(),

          fullname,
        );
      }
    });
  });

  /* =========================================================
   FUNCTION TO FIND USER NAME
========================================================= */

  function resolveActivityUser(log) {
    /*
    IMPORTANT:
    Login activity logs use the field "user".

    Successful login:
    user = fullname / email / studentNumber

    Failed login:
    user = entered username

    So check "user" FIRST.
  */

    if (
      log.user &&
      String(log.user).trim() !== "" &&
      String(log.user).toLowerCase() !== "n/a"
    ) {
      const loggedUser = String(log.user).trim();

      /*
      If the activity log already contains
      the person's actual full name, use it.
    */

      if (loggedUser.includes(" ") && !loggedUser.includes("@")) {
        return loggedUser;
      }

      /*
      If it is an email, student number,
      username, UID, etc., try to resolve
      it through the users collection.
    */

      const key = loggedUser.toLowerCase();

      const foundName = usersByIdentifier.get(key);

      if (foundName) {
        return foundName;
      }

      /*
      If it is not found in users,
      still display the value from
      the activity log instead of N/A.
    */

      return loggedUser;
    }

    /*
    Other possible name fields.
  */

    if (
      log.userName &&
      String(log.userName).trim() !== "" &&
      String(log.userName).toLowerCase() !== "n/a"
    ) {
      return String(log.userName).trim();
    }

    if (
      log.name &&
      String(log.name).trim() !== "" &&
      String(log.name).toLowerCase() !== "n/a"
    ) {
      return String(log.name).trim();
    }

    /*
    Try UID / ID / email fields.
  */

    const possibleIdentifiers = [
      log.uid,

      log.userUid,

      log.userId,

      log.email,

      log.studentNumber,

      log.facultyId,

      log.idNumber,

      log.username,
    ];

    for (const identifier of possibleIdentifiers) {
      if (identifier === undefined || identifier === null) {
        continue;
      }

      const key = String(identifier).trim().toLowerCase();

      if (!key) {
        continue;
      }

      const foundName = usersByIdentifier.get(key);

      if (foundName) {
        return foundName;
      }
    }

    /*
    Last fallback.
  */

    if (log.email) {
      return String(log.email);
    }

    return "N/A";
  }

  /* =====================================================
     CONVERT TIMESTAMP TO PHILIPPINE TIME
  ===================================================== */

  function getPhilippineDateParts(dateObject) {
    if (!dateObject) {
      return null;
    }

    const formatter = new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",

      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit",

      hourCycle: "h23",
    });

    const parts = formatter.formatToParts(dateObject);

    const result = {};

    parts.forEach((part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
    });

    return {
      year: Number(result.year),

      month: Number(result.month),

      day: Number(result.day),

      hour: Number(result.hour),

      minute: Number(result.minute),

      second: Number(result.second),
    };
  }

  /* =====================================================
     FORMAT PHILIPPINE DATE/TIME
  ===================================================== */

  function formatPhilippineDateTime(dateObject) {
    if (!dateObject) {
      return "N/A";
    }

    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",

      year: "numeric",

      month: "numeric",

      day: "numeric",

      hour: "numeric",

      minute: "2-digit",

      second: "2-digit",

      hour12: true,
    }).format(dateObject);
  }

  /* =====================================================
     CREATE REPORT ROWS
  ===================================================== */

  const rows = [];

  activitySnapshot.forEach((docSnap) => {
    const log = docSnap.data();

    let dateObject = null;

    /* =================================================
         FIREBASE TIMESTAMP
      ================================================= */

    if (log.timestamp && typeof log.timestamp.toDate === "function") {
      dateObject = log.timestamp.toDate();
    } else if (log.timestamp) {

    /* =================================================
         JAVASCRIPT DATE / STRING
      ================================================= */
      dateObject = new Date(log.timestamp);
    }

    /* =================================================
         PHILIPPINE DATE/TIME
      ================================================= */

    const philippinesTime = getPhilippineDateParts(dateObject);

    /* =================================================
         DATE FILTER
      ================================================= */

    if (selectedDate) {
      if (!philippinesTime) {
        return;
      }

      const logDate =
        `${philippinesTime.year}-` +
        `${String(philippinesTime.month).padStart(2, "0")}-` +
        `${String(philippinesTime.day).padStart(2, "0")}`;

      if (logDate !== selectedDate) {
        return;
      }
    }

    /* =================================================
         TIME FILTER
         
         Example:
         21:00 = 9 PM hour
         
         This will include:
         9:00 PM
         9:01 PM
         9:15 PM
         9:45 PM
         9:59 PM
      ================================================= */

    if (selectedTime) {
      if (!philippinesTime) {
        return;
      }

      const selectedHour = Number(selectedTime.split(":")[0]);

      if (philippinesTime.hour !== selectedHour) {
        return;
      }
    }

    /* =================================================
         RESOLVE USER
      ================================================= */

    const userName = resolveActivityUser(log);

    /* =================================================
         FORMAT TIME IN PHILIPPINE TIME
      ================================================= */

    const formattedTime = formatPhilippineDateTime(dateObject);

    /* =================================================
         ADD ROW
      ================================================= */

    rows.push([
      userName,

      log.role || "N/A",

      log.academicYear || "N/A",

      log.action || "N/A",

      log.status || "Success",

      formattedTime,
    ]);
  });

  /* =====================================================
     SORT NEWEST FIRST
  ===================================================== */

  rows.sort((a, b) => {
    const dateA = new Date(a[5]);

    const dateB = new Date(b[5]);

    return dateB - dateA;
  });

  /* =====================================================
     REPORT TITLE
  ===================================================== */

  reportTitle = "SYSTEM ACTIVITY REPORT";

  /* =====================================================
     RENDER
  ===================================================== */

  renderReportTable(
    ["User", "Role", "Academic Year", "Action", "Status", "Time"],

    rows,

    "activity",
  );
}

/* =========================================================
   SPECIALIZATION REPORT
   STUDENT CHOICE FILTER
========================================================= */

async function generateSpecializationReport(selectedAcademicYear) {
  const sectionFilter = document.getElementById("sectionFilter")?.value || "";

  const studentChoiceFilter =
    document.getElementById("studentChoiceSpecializationFilter")?.value || "";

  let resultsQuery = collection(db, "results");

  if (selectedAcademicYear) {
    resultsQuery = query(
      collection(db, "results"),
      where("academicYear", "==", selectedAcademicYear),
    );
  }

  const [resultsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(resultsQuery),

    getDocs(collection(db, "users")),
  ]);

  const usersByUid = new Map();

  usersSnapshot.forEach((docSnap) => {
    usersByUid.set(docSnap.id, docSnap.data());
  });

  const rows = [];

  const processedStudents = new Set();

  resultsSnapshot.forEach((docSnap) => {
    const result = docSnap.data();

    const studentUid = result.studentUid;

    if (!studentUid) return;

    if (processedStudents.has(studentUid)) {
      return;
    }

    const student = usersByUid.get(studentUid);

    if (!student) return;

    const section = student.section || "Not Assigned";

    /* =================================================
         SECTION FILTER
      ================================================= */

    if (
      sectionFilter &&
      sectionFilter !== "All" &&
      String(section) !== String(sectionFilter)
    ) {
      return;
    }

    /* =================================================
         ACTUAL STUDENT CHOICE
      ================================================= */

    const selectedSpecialization =
      student.selectedSpecialization || "Not Selected";

    /* =================================================
         STUDENT CHOICE FILTER
      ================================================= */

    if (
      studentChoiceFilter &&
      studentChoiceFilter !== "All" &&
      String(selectedSpecialization) !== String(studentChoiceFilter)
    ) {
      return;
    }

    const studentNumber =
      student.studentNumber ||
      student.idNumber ||
      result.studentNumber ||
      "N/A";

    const studentName =
      student.fullname || student.name || result.studentName || "N/A";

    const academicYear =
      result.academicYear || student.activeAcademicYear || "N/A";

    rows.push([
      studentNumber,

      studentName,

      section,

      academicYear,

      selectedSpecialization,
    ]);

    processedStudents.add(studentUid);
  });

  rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  reportTitle = "SPECIALIZATION REPORT";

  renderReportTable(
    [
      "Student Number",
      "Student",
      "Section",
      "Academic Year",
      "Selected Specialization",
    ],

    rows,

    "specialization",
  );
}

/* =========================================================
   DOWNLOAD PDF
========================================================= */

function downloadReport() {
  if (!reportRows || reportRows.length === 0) {
    alert("Generate a report first.");

    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("PDF library is not available.");

    return;
  }

  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: "landscape",

    unit: "mm",

    format: "a4",
  });

  doc.setFontSize(16);

  doc.setTextColor(52, 57, 168);

  doc.text(
    reportTitle || "SYSTEM REPORT",

    14,

    18,
  );

  doc.setFontSize(9);

  doc.setTextColor(100, 100, 100);

  doc.text("SpecAdvisor", 14, 25);

  doc.autoTable({
    head: [reportHeaders],

    body: reportRows,

    startY: 31,

    theme: "grid",

    styles: {
      fontSize: 8,

      cellPadding: 3,

      valign: "middle",

      halign: "center",
    },

    headStyles: {
      fillColor: [63, 160, 174],

      textColor: 255,

      fontStyle: "bold",

      halign: "center",
    },

    alternateRowStyles: {
      fillColor: [248, 250, 251],
    },

    margin: {
      left: 10,

      right: 10,
    },
  });

  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);

    doc.setFontSize(8);

    doc.setTextColor(120, 120, 120);

    doc.text(
      `SpecAdvisor | Page ${page} of ${pageCount}`,

      148,

      202,

      {
        align: "center",
      },
    );
  }

  doc.save("SpecAdvisor-Report.pdf");
}

/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadAcademicYears(),

    loadSections(),

    loadSpecializations(),

    loadStudentChoiceSpecializations(),
  ]);

  updateFilters();
});

/* =========================================================
   GLOBAL FUNCTIONS
========================================================= */

window.toggleSidebar = toggleSidebar;

window.goPage = goPage;

window.generateReport = generateReport;

window.downloadReport = downloadReport;

window.updateFilters = updateFilters;

<<<<<<< HEAD
window.updateRoleDependentFilters =
  updateRoleDependentFilters;
=======
window.updateRoleDependentFilters = updateRoleDependentFilters;
>>>>>>> 764192a (Updated UI, Updated Login and Signup Page, Fixed Bugs and etc)
