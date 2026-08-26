const STORAGE_KEY = "hireflow.applications.v1";
const DRAFT_KEY = "hireflow.draft.v1";
const THEME_KEY = "hireflow.theme.v1";

const MAX_NOTES_LENGTH = 400;
const MAX_SUMMARY_LENGTH = 120;
const MAX_TITLE_LENGTH = 80;

const SKILL_POOL = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Python",
  "Java",
  "SQL",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "CI/CD",
  "Git",
  "API",
  "Agile",
  "Scrum",
  "Excel",
  "Communication",
  "Leadership",
  "HTML",
  "CSS",
  "Vue",
  "Angular",
  "Django",
  "Spring Boot",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "Tailwind"
];

const form = document.getElementById("applicationForm");
const list = document.getElementById("applicationsList");
const template = document.getElementById("applicationCardTemplate");
const stats = document.getElementById("stats");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");

const analysisHint = document.getElementById("analysisHint");
const themeToggle = document.getElementById("themeToggle");

const weekApplications =
  document.getElementById("weekApplications");

const monthApplications =
  document.getElementById("monthApplications");

const interviewRate =
  document.getElementById("interviewRate");

const offerRate =
  document.getElementById("offerRate");

const rejectionRate =
  document.getElementById("rejectionRate");

const upcomingDeadlines =
  document.getElementById("upcomingDeadlines");

const notesCounter =
  document.getElementById("notesCounter");

const addApplicationBtn =
  document.getElementById("addApplicationBtn");

const fieldIds = [
  "jobTitle",
  "company",
  "location",
  "salary",
  "applyUrl",
  "deadline",
  "status",
  "dateApplied",
  "skills",
  "notes"
];

let applications = loadJson(STORAGE_KEY, []);
let editingId = null;
let statusChart = null;
let isDarkMode = loadJson(THEME_KEY, false);


/* =========================================================
   THEME
========================================================= */

if (isDarkMode) {
  document.body.classList.add("dark-theme");
}

themeToggle.addEventListener("click", () => {

  isDarkMode = !isDarkMode;

  document.body.classList.toggle(
    "dark-theme",
    isDarkMode
  );

  localStorage.setItem(
    THEME_KEY,
    JSON.stringify(isDarkMode)
  );

  updateChartTheme();
});


function updateChartTheme() {

  if (!statusChart) {
    return;
  }

  statusChart.options.plugins.legend.labels.color =
    isDarkMode
      ? "#f8fafc"
      : "#162136";

  statusChart.update();
}


/* =========================================================
   STORAGE
========================================================= */

function loadJson(key, fallback) {

  try {

    const raw = localStorage.getItem(key);

    return raw
      ? JSON.parse(raw)
      : fallback;

  } catch {

    return fallback;
  }
}


function saveApplications() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(applications)
  );
}


/* =========================================================
   FORM
========================================================= */

function formDataObject() {

  return Object.fromEntries(
    new FormData(form).entries()
  );
}


function setForm(data) {

  fieldIds.forEach((id) => {

    const element =
      document.getElementById(id);

    if (element) {

      element.value =
        data[id] ?? "";
    }

  });

  updateNotesCounter();
}


function resetForm() {

  editingId = null;

  form.reset();

  document.getElementById("status").value =
    "Saved";

  updateNotesCounter();
}


function updateNotesCounter() {

  const notes =
    document.getElementById("notes");

  if (notes && notesCounter) {

    notesCounter.textContent =
      notes.value.length;
  }
}


/* =========================================================
   DATE HELPERS
========================================================= */

function parseToDate(value) {

  if (!value) {
    return "";
  }

  const cleaned =
    value
      .replace(
        /(\d+)(st|nd|rd|th)/gi,
        "$1"
      )
      .trim();

  const parsed =
    new Date(cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed
    .toISOString()
    .slice(0, 10);
}


function formatDate(dateString) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}


function startOfDay(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


/* =========================================================
   JOB DESCRIPTION ANALYZER
========================================================= */

function autoExtract(description) {

  const clean =
    description
      .replace(/\r/g, "")
      .trim();

  const pick = (patterns) => {

    for (const regex of patterns) {

      const match =
        clean.match(regex);

      if (match && match[1]) {

        return match[1]
          .trim()
          .replace(/\s+/g, " ");
      }
    }

    return "";
  };


  const firstLine =
    clean
      .split("\n")
      .map(line => line.trim())
      .find(line => line.length > 0) || "";


  let jobTitle =
    pick([
      /(?:job title|position|role|opening)\s*[:\-]\s*([^\n]+)/i
    ]);


  if (!jobTitle) {

    if (
      firstLine.length >= 3 &&
      firstLine.length <= MAX_TITLE_LENGTH &&
      !/^(company|location|salary|skills|required skills|deadline|apply by)\s*:/i.test(
        firstLine
      )
    ) {

      jobTitle = firstLine;
    }
  }


  const company =
    pick([
      /(?:company|organization|employer)\s*[:\-]\s*([^\n]+)/i
    ]);


  const location =
    pick([
      /(?:location|based in|work location|office location)\s*[:\-]\s*([^\n]+)/i
    ]);


  const salaryByLabel =
    pick([
      /(?:salary|compensation|pay|ctc)\s*[:\-]\s*([^\n]+)/i
    ]);


  const salaryINR =
    clean.match(
      /₹\s*[\d,.]+\s*(?:-|–|to)\s*₹?\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)?/i
    )?.[0] || "";


  const singleINR =
    clean.match(
      /₹\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)/i
    )?.[0] || "";


  const salaryDollar =
    clean.match(
      /\$\s*[\d,.]+\s*(?:-|–|to)\s*\$?\s*[\d,.]+(?:\s*(?:per year|year|yr|hr|hour))?/i
    )?.[0] || "";


  const salary =
    salaryByLabel ||
    salaryINR ||
    singleINR ||
    salaryDollar;


  const applyUrl =
    clean.match(
      /https?:\/\/[^\s)]+/i
    )?.[0] || "";


  const deadlinePhrase =
    pick([
      /(?:deadline|apply by|application deadline|last date)\s*[:\-]\s*([^\n]+)/i
    ]);


  const deadline =
    parseToDate(deadlinePhrase);


  const detectedSkills = [];


  SKILL_POOL.forEach((word) => {

    const escaped =
      word.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const regex =
      new RegExp(
        `(^|[^a-zA-Z0-9+#.])${escaped}(?=$|[^a-zA-Z0-9+#.])`,
        "i"
      );

    if (regex.test(clean)) {

      detectedSkills.push(word);
    }
  });


  const uniqueSkills =
    [...new Set(detectedSkills)]
      .filter((skill) => {

        if (
          skill === "Node.js" &&
          detectedSkills.includes("Node")
        ) {
          return true;
        }

        return true;
      });


  return {

    jobTitle,
    company,
    location,
    salary,
    applyUrl,
    deadline,

    skills:
      uniqueSkills.join(", ")
  };
}


/* =========================================================
   FILTER + SORT
========================================================= */

function filteredApplications() {

  const query =
    searchInput.value
      .trim()
      .toLowerCase();

  const status =
    statusFilter.value;

  const sort =
    sortSelect.value;


  const result =
    applications.filter((app) => {

      const searchableText =
        [
          app.jobTitle,
          app.company,
          app.location,
          app.skills,
          app.notes
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();


      const queryOk =
        !query ||
        searchableText.includes(query);


      const statusOk =
        status === "all" ||
        app.status === status;


      return queryOk && statusOk;
    });


  result.sort((a, b) => {

    if (sort === "dateDesc") {

      return (
        b.dateApplied || "0000-00-00"
      ).localeCompare(
        a.dateApplied || "0000-00-00"
      );
    }


    if (sort === "dateAsc") {

      return (
        a.dateApplied || "9999-99-99"
      ).localeCompare(
        b.dateApplied || "9999-99-99"
      );
    }


    if (sort === "title") {

      return (
        a.jobTitle || ""
      ).localeCompare(
        b.jobTitle || ""
      );
    }


    if (sort === "company") {

      return (
        a.company || ""
      ).localeCompare(
        b.company || ""
      );
    }


    return 0;
  });


  return result;
}


/* =========================================================
   DASHBOARD STATS
========================================================= */

function renderStats() {

  const counts =
    applications.reduce(
      (acc, app) => {

        acc.total++;

        if (acc[app.status] !== undefined) {
          acc[app.status]++;
        }

        return acc;

      },
      {
        total: 0,
        Saved: 0,
        Applied: 0,
        Interview: 0,
        Offer: 0,
        Rejected: 0
      }
    );


  stats.innerHTML = [

    ["Total", counts.total],
    ["Saved", counts.Saved],
    ["Applied", counts.Applied],
    ["Interview", counts.Interview],
    ["Offer", counts.Offer],
    ["Rejected", counts.Rejected]

  ]
    .map(
      ([label, value]) => `
        <div class="stat">
          <strong>${label}</strong>
          <span>${value}</span>
        </div>
      `
    )
    .join("");


  updateChart(counts);
  renderDashboardInsights();
}


/* =========================================================
   DASHBOARD INSIGHTS
========================================================= */

function renderDashboardInsights() {

  const now =
    new Date();

  const today =
    startOfDay(now);


  const weekStart =
    new Date(today);

  const day =
    weekStart.getDay();

  const diff =
    day === 0
      ? 6
      : day - 1;

  weekStart.setDate(
    weekStart.getDate() - diff
  );


  const monthStart =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );


  const applicationsWithDates =
    applications.filter(
      app => app.dateApplied
    );


  const weekCount =
    applicationsWithDates.filter(app => {

      const date =
        new Date(
          `${app.dateApplied}T00:00:00`
        );

      return (
        date >= weekStart &&
        date <= today
      );

    }).length;


  const monthCount =
    applicationsWithDates.filter(app => {

      const date =
        new Date(
          `${app.dateApplied}T00:00:00`
        );

      return (
        date >= monthStart &&
        date <= today
      );

    }).length;


  weekApplications.textContent =
    weekCount;

  monthApplications.textContent =
    monthCount;


  const total =
    applications.length;


  const interviewCount =
    applications.filter(
      app =>
        app.status === "Interview"
    ).length;


  const offerCount =
    applications.filter(
      app =>
        app.status === "Offer"
    ).length;


  const rejectedCount =
    applications.filter(
      app =>
        app.status === "Rejected"
    ).length;


  interviewRate.textContent =
    total
      ? `${Math.round(
          (interviewCount / total) * 100
        )}%`
      : "0%";


  offerRate.textContent =
    total
      ? `${Math.round(
          (offerCount / total) * 100
        )}%`
      : "0%";


  rejectionRate.textContent =
    total
      ? `${Math.round(
          (rejectedCount / total) * 100
        )}%`
      : "0%";


  renderUpcomingDeadlines();
}


/* =========================================================
   UPCOMING DEADLINES
========================================================= */

function renderUpcomingDeadlines() {

  const today =
    startOfDay(new Date());


  const upcoming =
    applications
      .filter(app => {

        if (!app.deadline) {
          return false;
        }

        const date =
          new Date(
            `${app.deadline}T00:00:00`
          );

        return date >= today;

      })
      .sort(
        (a, b) =>
          a.deadline.localeCompare(
            b.deadline
          )
      )
      .slice(0, 6);


  if (!upcoming.length) {

    upcomingDeadlines.innerHTML = `
      <div class="no-deadlines">
        No upcoming deadlines.
      </div>
    `;

    return;
  }


  upcomingDeadlines.innerHTML =
    upcoming
      .map(app => {

        return `
          <div class="deadline-item">

            <strong>
              ${escapeHtml(
                app.jobTitle || "Untitled role"
              )}
            </strong>

            <span>
              ${escapeHtml(
                app.company || "Unknown company"
              )}
              • ${formatDate(app.deadline)}
            </span>

          </div>
        `;

      })
      .join("");
}


/* =========================================================
   CHART
========================================================= */

function updateChart(counts) {

  const canvas =
    document.getElementById(
      "statusChart"
    );

  if (!canvas) {
    return;
  }


  const data = {

    labels: [
      "Saved",
      "Applied",
      "Interview",
      "Offer",
      "Rejected"
    ],

    datasets: [

      {
        data: [
          counts.Saved,
          counts.Applied,
          counts.Interview,
          counts.Offer,
          counts.Rejected
        ],

        backgroundColor: [
          "#94a3b8",
          "#3b82f6",
          "#a855f7",
          "#22c55e",
          "#ef4444"
        ],

        borderWidth: 1
      }

    ]
  };


  if (statusChart) {

    statusChart.data = data;
    statusChart.update();

    return;
  }


  statusChart =
    new Chart(
      canvas.getContext("2d"),
      {
        type: "doughnut",

        data,

        options: {

          responsive: true,

          maintainAspectRatio: false,

          cutout: "65%",

          plugins: {

            legend: {

              position: "right",

              labels: {

                color:
                  isDarkMode
                    ? "#f8fafc"
                    : "#162136",

                boxWidth: 12,
                padding: 12,
                font: {
                  size: 11
                }
              }
            }

          }
        }
      }
    );
}


/* =========================================================
   APPLICATION LIST
========================================================= */

function renderList() {

  renderStats();

  list.innerHTML = "";


  const items =
    filteredApplications();


  if (!items.length) {

    const hasApplications =
      applications.length > 0;


    list.innerHTML = `
      <li class="empty-state">

        <div class="empty-state-icon">
          ${hasApplications ? "⌕" : "＋"}
        </div>

        <h3>
          ${
            hasApplications
              ? "No applications found"
              : "No applications yet"
          }
        </h3>

        <p>
          ${
            hasApplications
              ? "Try changing your search or status filter."
              : "Add your first application or load the demo data to get started."
          }
        </p>

      </li>
    `;

    return;
  }


  items.forEach(app => {

    const node =
      template.content
        .firstElementChild
        .cloneNode(true);


    const statusClass =
      (app.status || "Saved")
        .toLowerCase();


    node.classList.add(
      `status-${statusClass}`
    );


    const company =
      app.company || "Unknown company";


    const companyInitial =
      company
        .trim()
        .charAt(0)
        .toUpperCase() || "H";


    node.querySelector(
      '[data-role="companyIcon"]'
    ).textContent =
      companyInitial;


    node.querySelector(
      '[data-role="title"]'
    ).textContent =
      `${app.jobTitle || "Untitled role"} — ${company}`;


    const metaParts = [];


    if (app.location) {
      metaParts.push(app.location);
    }


    if (app.salary) {
      metaParts.push(app.salary);
    }


    if (app.dateApplied) {

      metaParts.push(
        `Applied: ${formatDate(
          app.dateApplied
        )}`
      );
    }


    node.querySelector(
      '[data-role="meta"]'
    ).textContent =
      metaParts.join(" • ") ||
      "No application details";


    node.querySelector(
      '[data-role="summary"]'
    ).textContent =
      app.notes
        ? app.notes.slice(
            0,
            MAX_SUMMARY_LENGTH
          )
        : "";


    node.querySelector(
      '[data-role="skills"]'
    ).textContent =
      app.skills
        ? `Skills: ${app.skills}`
        : "";


    /* STATUS BADGE */

    const statusBadge =
      node.querySelector(
        '[data-role="statusBadge"]'
      );


    statusBadge.textContent =
      app.status || "Saved";


    /* DEADLINE BADGE */

    const deadlineBadge =
      node.querySelector(
        '[data-role="deadlineBadge"]'
      );


    if (app.deadline) {

      deadlineBadge.textContent =
        `Deadline: ${formatDate(
          app.deadline
        )}`;

      deadlineBadge.hidden = false;

    } else {

      deadlineBadge.textContent =
        "No deadline";

      deadlineBadge.hidden = false;
    }


    /* STATUS SELECT */

    const statusSelect =
      node.querySelector(
        '[data-role="statusSelect"]'
      );


    statusSelect.value =
      app.status || "Saved";


    statusSelect.addEventListener(
      "change",
      () => {

        app.status =
          statusSelect.value;

        saveApplications();

        renderList();
      }
    );


    /* OPEN JOB */

    node.querySelector(
      '[data-role="open"]'
    ).addEventListener(
      "click",
      () => {

        const url =
          normalizeUrl(
            app.applyUrl
          );


        if (!url) {

          analysisHint.textContent =
            "No valid application URL is available for this application.";

          return;
        }


        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );
      }
    );


    /* EDIT */

    node.querySelector(
      '[data-role="edit"]'
    ).addEventListener(
      "click",
      () => {

        editingId =
          app.id;

        setForm(app);

        saveDraft();

        document
          .querySelector(
            ".form-panel"
          )
          .scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      }
    );


    /* DELETE */

    node.querySelector(
      '[data-role="delete"]'
    ).addEventListener(
      "click",
      () => {

        const confirmed =
          window.confirm(
            `Delete "${app.jobTitle || "this application"}"?`
          );


        if (!confirmed) {
          return;
        }


        applications =
          applications.filter(
            item =>
              item.id !== app.id
          );


        saveApplications();

        renderList();
      }
    );


    list.appendChild(node);
  });
}


/* =========================================================
   URL VALIDATION
========================================================= */

function normalizeUrl(value) {

  if (!value) {
    return "";
  }


  let url =
    value.trim();


  if (!url) {
    return "";
  }


  if (
    !/^https?:\/\//i.test(url)
  ) {

    url =
      `https://${url}`;
  }


  try {

    const parsed =
      new URL(url);


    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return "";
    }


    return parsed.href;

  } catch {

    return "";
  }
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   DRAFT
========================================================= */

function saveDraft() {

  const data =
    formDataObject();

  data.editingId =
    editingId;

  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify(data)
  );
}


function loadDraft() {

  const draft =
    loadJson(
      DRAFT_KEY,
      null
    );


  if (!draft) {
    return false;
  }


  if (draft.editingId) {

    editingId =
      draft.editingId;
  }


  setForm(draft);

  return true;
}


/* =========================================================
   ANALYZE
========================================================= */

document
  .getElementById("analyzeBtn")
  .addEventListener(
    "click",
    () => {

      const description =
        document
          .getElementById(
            "jobDescription"
          )
          .value
          .trim();


      if (!description) {

        analysisHint.textContent =
          "Paste a job description first.";

        return;
      }


      const extracted =
        autoExtract(description);


      const current =
        formDataObject();


      const merged = {
        ...current
      };


      Object.keys(extracted)
        .forEach(key => {

          if (extracted[key]) {

            merged[key] =
              extracted[key];
          }

        });


      setForm(merged);


      analysisHint.textContent =
        "✓ Job details extracted. Review the fields and click Save Application.";


      saveDraft();
    }
  );


/* =========================================================
   CLEAR DRAFT
========================================================= */

document
  .getElementById("clearDraftBtn")
  .addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        DRAFT_KEY
      );


      document
        .getElementById(
          "jobDescription"
        )
        .value = "";


      analysisHint.textContent =
        "Draft cleared.";

      resetForm();
    }
  );


/* =========================================================
   AUTO SAVE
========================================================= */

form.addEventListener(
  "input",
  () => {

    updateNotesCounter();

    saveDraft();
  }
);


/* =========================================================
   SAVE
========================================================= */

form.addEventListener(
  "submit",
  event => {

    event.preventDefault();


    const data =
      formDataObject();


    const title =
      data.jobTitle
        .trim();


    const company =
      data.company
        .trim();


    if (
      title.length < 3 ||
      company.length < 1
    ) {

      analysisHint.textContent =
        "Please enter a valid job title and company.";

      return;
    }


    if (
      data.applyUrl &&
      !normalizeUrl(data.applyUrl)
    ) {

      analysisHint.textContent =
        "Please enter a valid application URL.";

      return;
    }


    data.applyUrl =
      data.applyUrl
        ? normalizeUrl(data.applyUrl)
        : "";


    data.notes =
      (data.notes || "")
        .slice(
          0,
          MAX_NOTES_LENGTH
        );


    const payload = {

      ...data,

      id:
        editingId ||
        crypto.randomUUID(),

      updatedAt:
        new Date().toISOString()
    };


    const wasEditing =
      Boolean(editingId);


    if (editingId) {

      applications =
        applications.map(
          item =>
            item.id === editingId
              ? payload
              : item
        );

    } else {

      applications.unshift(
        payload
      );
    }


    saveApplications();

    localStorage.removeItem(
      DRAFT_KEY
    );


    analysisHint.textContent =
      wasEditing
        ? "Application updated."
        : "Application saved.";


    resetForm();

    renderList();
  }
);


/* =========================================================
   RESET
========================================================= */

document
  .getElementById("resetFormBtn")
  .addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        DRAFT_KEY
      );

      resetForm();

      analysisHint.textContent =
        "Form reset.";
    }
  );


/* =========================================================
   ADD APPLICATION
========================================================= */

addApplicationBtn.addEventListener(
  "click",
  () => {

    resetForm();

    document
      .getElementById(
        "jobDescription"
      )
      .focus();


    document
      .querySelector(
        ".workspace"
      )
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  }
);


/* =========================================================
   SEARCH / FILTER / SORT
========================================================= */

searchInput.addEventListener(
  "input",
  renderList
);

statusFilter.addEventListener(
  "change",
  renderList
);

sortSelect.addEventListener(
  "change",
  renderList
);


/* =========================================================
   EXPORT JSON
========================================================= */

document
  .getElementById("exportBtn")
  .addEventListener(
    "click",
    () => {

      if (!applications.length) {

        analysisHint.textContent =
          "There are no applications to export.";

        return;
      }


      const blob =
        new Blob(
          [
            JSON.stringify(
              applications,
              null,
              2
            )
          ],
          {
            type:
              "application/json"
          }
        );


      downloadBlob(
        blob,
        "hireflow-applications.json"
      );
    }
  );


/* =========================================================
   EXPORT CSV
========================================================= */

document
  .getElementById("exportCsvBtn")
  .addEventListener(
    "click",
    () => {

      if (!applications.length) {

        analysisHint.textContent =
          "There are no applications to export.";

        return;
      }


      const headers = [

        "jobTitle",
        "company",
        "location",
        "salary",
        "applyUrl",
        "deadline",
        "status",
        "dateApplied",
        "skills",
        "notes",
        "updatedAt"

      ];


      const rows =
        applications.map(app => {

          return headers
            .map(header => {

              const value =
                app[header] ?? "";

              return `"${String(value)
                .replaceAll('"', '""')}"`;
            })
            .join(",");
        });


      const csv =
        [
          headers.join(","),
          ...rows
        ].join("\n");


      const blob =
        new Blob(
          [csv],
          {
            type:
              "text/csv;charset=utf-8;"
          }
        );


      downloadBlob(
        blob,
        "hireflow-applications.csv"
      );
    }
  );


function downloadBlob(
  blob,
  filename
) {

  const url =
    URL.createObjectURL(blob);


  const anchor =
    document.createElement("a");


  anchor.href =
    url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );

  anchor.click();

  anchor.remove();


  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    100
  );
}


/* =========================================================
   IMPORT
========================================================= */

document
  .getElementById("importBtn")
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "importFile"
        )
        .click();
    }
  );


document
  .getElementById("importFile")
  .addEventListener(
    "change",
    async event => {

      const file =
        event.target.files?.[0];


      if (!file) {
        return;
      }


      try {

        const imported =
          JSON.parse(
            await file.text()
          );


        if (!Array.isArray(imported)) {

          throw new Error(
            "Invalid format"
          );
        }


        const valid =
          imported.filter(item => {

            return (
              item &&
              typeof item === "object" &&
              item.id
            );
          });


        applications =
          valid;


        saveApplications();

        renderList();


        const skipped =
          imported.length -
          valid.length;


        analysisHint.textContent =
          skipped
            ? `Imported ${valid.length} applications. Skipped ${skipped} invalid entries.`
            : `Imported ${valid.length} applications.`;

      } catch {

        analysisHint.textContent =
          "Could not import file. Use exported HireFlow JSON format.";
      }


      event.target.value = "";
    }
  );


/* =========================================================
   DEMO DATA
========================================================= */

document
  .getElementById("loadSampleBtn")
  .addEventListener(
    "click",
    () => {

      const today =
        new Date();


      const date =
        offsetDate(
          today,
          0
        );


      const dateMinus2 =
        offsetDate(
          today,
          -2
        );


      const dateMinus5 =
        offsetDate(
          today,
          -5
        );


      const dateMinus10 =
        offsetDate(
          today,
          -10
        );


      const datePlus7 =
        offsetDate(
          today,
          7
        );


      const datePlus14 =
        offsetDate(
          today,
          14
        );


      const sampleData = [

        {
          id: crypto.randomUUID(),

          jobTitle:
            "Software Engineer Intern",

          company:
            "Google",

          location:
            "Bangalore / Hybrid",

          salary:
            "₹12–18 LPA",

          applyUrl:
            "https://www.google.com/about/careers/applications/",

          deadline:
            datePlus7,

          status:
            "Interview",

          dateApplied:
            dateMinus2,

          skills:
            "Java, Python, SQL, Git, AWS",

          notes:
            "Completed the first technical round. Preparing for the next interview.",

          updatedAt:
            new Date().toISOString()
        },


        {
          id: crypto.randomUUID(),

          jobTitle:
            "Frontend Developer Intern",

          company:
            "Microsoft",

          location:
            "Hyderabad",

          salary:
            "₹10–15 LPA",

          applyUrl:
            "https://careers.microsoft.com/",

          deadline:
            datePlus14,

          status:
            "Applied",

          dateApplied:
            dateMinus5,

          skills:
            "React, TypeScript, JavaScript, CSS",

          notes:
            "Applied through the careers portal.",

          updatedAt:
            new Date().toISOString()
        },


        {
          id: crypto.randomUUID(),

          jobTitle:
            "Backend Developer",

          company:
            "Amazon",

          location:
            "Bangalore",

          salary:
            "₹14–20 LPA",

          applyUrl:
            "https://www.amazon.jobs/",

          deadline:
            datePlus14,

          status:
            "Saved",

          dateApplied:
            "",

          skills:
            "Java, Spring Boot, AWS, SQL",

          notes:
            "Need to update resume with backend projects before applying.",

          updatedAt:
            new Date().toISOString()
        },


        {
          id: crypto.randomUUID(),

          jobTitle:
            "Software Developer",

          company:
            "Infosys",

          location:
            "Pune",

          salary:
            "₹8–12 LPA",

          applyUrl:
            "https://www.infosys.com/careers/",

          deadline:
            "",

          status:
            "Rejected",

          dateApplied:
            dateMinus10,

          skills:
            "Java, SQL, Python",

          notes:
            "Received rejection after application review.",

          updatedAt:
            new Date().toISOString()
        },


        {
          id: crypto.randomUUID(),

          jobTitle:
            "Full Stack Developer",

          company:
            "Startup Labs",

          location:
            "Remote",

          salary:
            "₹12 LPA",

          applyUrl:
            "https://github.com/",

          deadline:
            "",

          status:
            "Offer",

          dateApplied:
            date,

          skills:
            "React, Node.js, MongoDB, Docker",

          notes:
            "Offer received. Reviewing compensation and role responsibilities.",

          updatedAt:
            new Date().toISOString()
        }

      ];


      applications =
        [
          ...sampleData,
          ...applications
        ];


      saveApplications();

      renderList();


      analysisHint.textContent =
        "✓ Demo applications loaded successfully.";
    }
  );


function offsetDate(
  base,
  days
) {

  const date =
    new Date(base);

  date.setDate(
    date.getDate() + days
  );

  return date
    .toISOString()
    .slice(0, 10);
}


/* =========================================================
   INITIALIZE
========================================================= */

const hasDraft =
  loadDraft();


if (!hasDraft) {
  resetForm();
}


updateNotesCounter();

renderList();