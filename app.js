const STORAGE_KEY = "hireflow.applications.v2";
const DRAFT_KEY = "hireflow.draft.v2";
const THEME_KEY = "hireflow.theme.v2";

const MAX_NOTES_LENGTH = 400;
const MAX_SUMMARY_LENGTH = 120;

const SKILL_POOL = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Node",
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


/* =========================================================
   ELEMENTS
========================================================= */

const form = document.getElementById("applicationForm");
const list = document.getElementById("applicationsList");
const template = document.getElementById("applicationCardTemplate");
const stats = document.getElementById("stats");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");

const analysisHint = document.getElementById("analysisHint");
const themeToggle = document.getElementById("themeToggle");

const jobDescription = document.getElementById("jobDescription");
const notesInput = document.getElementById("notes");
const notesCounter = document.getElementById("notesCounter");

const applicationFormSection =
  document.getElementById("applicationFormSection");

const formHeading =
  document.getElementById("formHeading");

const saveApplicationBtn =
  document.getElementById("saveApplicationBtn");


/* =========================================================
   STATE
========================================================= */

let applications = loadJson(STORAGE_KEY, []);
let editingId = null;
let statusChart = null;
let isDarkMode = loadJson(THEME_KEY, false);


/* =========================================================
   INITIAL THEME
========================================================= */

if (isDarkMode) {
  document.body.classList.add("dark-theme");
}


/* =========================================================
   THEME
========================================================= */

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

    const raw =
      localStorage.getItem(key);

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
   FORM HELPERS
========================================================= */

function formDataObject() {

  return Object.fromEntries(
    new FormData(form).entries()
  );

}


function setForm(data) {

  const fields = [
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

  fields.forEach((id) => {

    const element =
      document.getElementById(id);

    if (element) {

      element.value =
        data[id] || "";

    }

  });

  updateNotesCounter();

}


function resetForm() {

  editingId = null;

  form.reset();

  document.getElementById("status").value =
    "Saved";

  document.getElementById("dateApplied").value =
    "";

  formHeading.textContent =
    "Application Details";

  saveApplicationBtn.textContent =
    "Save Application";

  updateNotesCounter();

}


function scrollToForm() {

  applicationFormSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  setTimeout(() => {

    document.getElementById("jobTitle").focus();

  }, 500);

}


/* =========================================================
   ADD APPLICATION BUTTON
========================================================= */

document
  .getElementById("addApplicationBtn")
  .addEventListener("click", () => {

    editingId = null;

    resetForm();

    analysisHint.textContent =
      "Ready to add a new application.";

    scrollToForm();

  });


/* =========================================================
   NOTES COUNTER
========================================================= */

function updateNotesCounter() {

  if (!notesInput || !notesCounter) {
    return;
  }

  notesCounter.textContent =
    notesInput.value.length;

}


notesInput.addEventListener(
  "input",
  updateNotesCounter
);


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


  /* JOB TITLE */

  const firstLine =
    clean
      .split("\n")
      .map(line => line.trim())
      .find(line => line.length > 0) || "";


  const titleFromLabel =
    pick([
      /(?:job title|job|position|role|opening)\s*[:\-]\s*([^\n]+)/i
    ]);


  let jobTitle =
    titleFromLabel;


  if (!jobTitle) {

    if (
      firstLine.length >= 3 &&
      firstLine.length <= 80 &&
      !/^(company|location|salary|skills|required skills|deadline|apply by)\s*:/i.test(firstLine)
    ) {

      jobTitle =
        firstLine;

    }

  }


  /* COMPANY */

  const company =
    pick([
      /(?:company|organization|employer)\s*[:\-]\s*([^\n]+)/i
    ]);


  /* LOCATION */

  const location =
    pick([
      /(?:location|based in|work location|office location)\s*[:\-]\s*([^\n]+)/i
    ]);


  /* SALARY */

  const salaryByLabel =
    pick([
      /(?:salary|compensation|pay|ctc)\s*[:\-]\s*([^\n]+)/i
    ]);


  const salaryByINR =
    clean.match(
      /₹\s*[\d,.]+\s*(?:-|–|to)\s*₹?\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)?/i
    )?.[0] || "";


  const singleINR =
    clean.match(
      /₹\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)/i
    )?.[0] || "";


  const salaryByDollar =
    clean.match(
      /\$\s*[\d,.]+\s*(?:-|–|to)\s*\$?\s*[\d,.]+(?:\s*(?:per year|year|yr|hr|hour))?/i
    )?.[0] || "";


  const salary =
    salaryByLabel ||
    salaryByINR ||
    singleINR ||
    salaryByDollar;


  /* URL */

  const applyUrl =
    clean.match(
      /https?:\/\/[^\s)]+/i
    )?.[0] || "";


  /* DEADLINE */

  const deadlinePhrase =
    pick([
      /(?:deadline|apply by|application deadline|last date)\s*[:\-]\s*([^\n]+)/i
    ]);


  const deadline =
    parseToDate(deadlinePhrase);


  /* SKILLS */

  const detectedSkills = [];


  SKILL_POOL.forEach((word) => {

    const escapedWord =
      word.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );


    const regex =
      new RegExp(
        `(^|[^a-zA-Z0-9+#.])${escapedWord}(?=$|[^a-zA-Z0-9+#.])`,
        "i"
      );


    if (regex.test(clean)) {

      if (
        word === "Node" &&
        /\bNode\.js\b/i.test(clean)
      ) {
        return;
      }

      detectedSkills.push(word);

    }

  });


  return {

    jobTitle,
    company,
    location,
    salary,
    applyUrl,
    deadline,
    skills:
      detectedSkills.join(", ")

  };

}


/* =========================================================
   DATE PARSER
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


  let parsed =
    new Date(cleaned);


  if (Number.isNaN(parsed.getTime())) {

    const match =
      cleaned.match(
        /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
      );


    if (match) {

      parsed =
        new Date(
          `${match[3]}-${match[2]}-${match[1]}`
        );

    }

  }


  if (Number.isNaN(parsed.getTime())) {
    return "";
  }


  return parsed
    .toISOString()
    .slice(0, 10);

}


/* =========================================================
   FILTER + SORT
========================================================= */

function filteredApplications() {

  const q =
    searchInput.value
      .trim()
      .toLowerCase();


  const selectedStatus =
    statusFilter.value;


  const sort =
    sortSelect.value;


  let result =
    applications.filter((app) => {

      const searchableText =
        `
        ${app.jobTitle || ""}
        ${app.company || ""}
        ${app.location || ""}
        ${app.skills || ""}
        ${app.notes || ""}
        `
          .toLowerCase();


      const queryOk =
        !q ||
        searchableText.includes(q);


      const statusOk =
        selectedStatus === "all" ||
        app.status === selectedStatus;


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
   STATS
========================================================= */

function renderStats() {

  const counts =
    applications.reduce(
      (acc, app) => {

        acc.total++;

        acc[app.status] =
          (acc[app.status] || 0) + 1;

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

    ["total", "Total"],
    ["Saved", "Saved"],
    ["Applied", "Applied"],
    ["Interview", "Interview"],
    ["Offer", "Offer"],
    ["Rejected", "Rejected"]

  ]
    .map(([key, label]) => {

      return `
        <div class="stat">
          <strong>${label}</strong>
          <span>${counts[key] || 0}</span>
        </div>
      `;

    })
    .join("");


  updateChart(counts);

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

    statusChart.data =
      data;

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

          plugins: {

            legend: {

              position: "right",

              labels: {

                color:
                  isDarkMode
                    ? "#f8fafc"
                    : "#162136"

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

    list.innerHTML = `
      <li class="application-card empty-state">
        <div>
          <h3>No applications found</h3>
          <p>
            Add your first application to start
            tracking your job search.
          </p>

          <button
            id="emptyAddBtn"
            class="primary-button"
            type="button"
          >
            + Add Application
          </button>
        </div>
      </li>
    `;


    document
      .getElementById("emptyAddBtn")
      ?.addEventListener(
        "click",
        () => {

          resetForm();

          scrollToForm();

        }
      );


    return;

  }


  items.forEach((app) => {

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


    node.querySelector(
      '[data-role="title"]'
    ).textContent =
      `${app.jobTitle || "Untitled role"} — ${
        app.company || "Unknown company"
      }`;


    node.querySelector(
      '[data-role="meta"]'
    ).textContent = [

      app.location,

      app.salary,

      app.deadline &&
        `Deadline: ${app.deadline}`,

      app.dateApplied &&
        `Applied: ${app.dateApplied}`

    ]
      .filter(Boolean)
      .join(" • ");


    node.querySelector(
      '[data-role="summary"]'
    ).textContent =
      app.notes
        ?.slice(
          0,
          MAX_SUMMARY_LENGTH
        ) || "No notes added.";


    node.querySelector(
      '[data-role="skills"]'
    ).textContent =
      app.skills
        ? `Skills: ${app.skills}`
        : "No skills added";


    /* STATUS */

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

        app.updatedAt =
          new Date().toISOString();

        saveApplications();

        renderList();

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

        formHeading.textContent =
          "Edit Application";

        saveApplicationBtn.textContent =
          "Update Application";

        analysisHint.textContent =
          "Editing this application.";

        saveDraft();

        scrollToForm();

      }
    );


    /* OPEN */

    node.querySelector(
      '[data-role="open"]'
    ).addEventListener(
      "click",
      () => {

        if (!app.applyUrl) {

          analysisHint.textContent =
            "This application does not have an application URL.";

          scrollToForm();

          return;

        }


        window.open(
          app.applyUrl,
          "_blank",
          "noopener,noreferrer"
        );

      }
    );


    /* DELETE */

    node.querySelector(
      '[data-role="delete"]'
    ).addEventListener(
      "click",
      () => {

        const confirmed =
          confirm(
            `Delete ${app.jobTitle || "this application"}?`
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


  if (editingId) {

    formHeading.textContent =
      "Edit Application";

    saveApplicationBtn.textContent =
      "Update Application";

  }


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
        jobDescription.value.trim();


      if (!description) {

        analysisHint.textContent =
          "Paste a job description first.";

        jobDescription.focus();

        return;

      }


      const extracted =
        autoExtract(
          description
        );


      const current =
        formDataObject();


      const merged = {
        ...current
      };


      Object.keys(extracted)
        .forEach((key) => {

          if (extracted[key]) {

            merged[key] =
              extracted[key];

          }

        });


      setForm(merged);


      analysisHint.textContent =
        "✓ Job details extracted. Review the fields and save your application.";


      saveDraft();


      scrollToForm();

    }
  );


/* =========================================================
   CLEAR
========================================================= */

document
  .getElementById("clearDraftBtn")
  .addEventListener(
    "click",
    () => {

      localStorage.removeItem(
        DRAFT_KEY
      );

      jobDescription.value =
        "";

      resetForm();

      analysisHint.textContent =
        "Draft cleared.";

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
   SAVE / UPDATE
========================================================= */

form.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();


    const data =
      formDataObject();


    if (!data.jobTitle.trim()) {

      alert(
        "Please enter a job title."
      );

      return;

    }


    if (!data.company.trim()) {

      alert(
        "Please enter a company name."
      );

      return;

    }


    data.notes =
      data.notes
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


    if (editingId) {

      applications =
        applications.map(
          item =>
            item.id === editingId
              ? payload
              : item
        );


      analysisHint.textContent =
        "✓ Application updated successfully.";

    } else {

      applications.unshift(
        payload
      );


      analysisHint.textContent =
        "✓ Application saved successfully.";

    }


    saveApplications();


    localStorage.removeItem(
      DRAFT_KEY
    );


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

        alert(
          "There are no applications to export."
        );

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
        applications.map(
          app =>
            headers
              .map(header => {

                const value =
                  app[header] || "";

                return `"${String(value)
                  .replace(/"/g, '""')}"`;

              })
              .join(",")
        );


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
              "text/csv;charset=utf-8"
          }
        );


      downloadBlob(
        blob,
        "hireflow-applications.csv"
      );

    }
  );


function downloadBlob(blob, filename) {

  const url =
    URL.createObjectURL(blob);


  const a =
    document.createElement("a");


  a.href =
    url;

  a.download =
    filename;

  document.body.appendChild(a);

  a.click();

  a.remove();


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
        .getElementById("importFile")
        .click();

    }
  );


document
  .getElementById("importFile")
  .addEventListener(
    "change",
    async (event) => {

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
          imported.filter(
            item =>
              item &&
              typeof item === "object" &&
              item.id
          );


        applications =
          valid;


        saveApplications();

        renderList();


        analysisHint.textContent =
          `✓ Imported ${valid.length} applications successfully.`;

      } catch {

        analysisHint.textContent =
          "Could not import file. Please use a HireFlow exported JSON file.";

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

      const now =
        new Date().toISOString();


      const sampleData = [

        {
          id: crypto.randomUUID(),
          jobTitle: "Software Engineer",
          company: "Google",
          location: "Bangalore",
          salary: "₹18–25 LPA",
          applyUrl: "https://careers.google.com/",
          deadline: "2026-12-31",
          status: "Interview",
          dateApplied: "2026-08-20",
          skills: "Java, SQL, Git, AWS",
          notes: "Technical interview scheduled. Prepare DSA and system design.",
          updatedAt: now
        },

        {
          id: crypto.randomUUID(),
          jobTitle: "Frontend Developer",
          company: "Microsoft",
          location: "Hyderabad",
          salary: "₹15–22 LPA",
          applyUrl: "https://careers.microsoft.com/",
          deadline: "2026-09-15",
          status: "Applied",
          dateApplied: "2026-08-18",
          skills: "React, TypeScript, JavaScript, CSS",
          notes: "Applied through campus hiring portal.",
          updatedAt: now
        },

        {
          id: crypto.randomUUID(),
          jobTitle: "Backend Developer",
          company: "Amazon",
          location: "Bangalore",
          salary: "₹16–24 LPA",
          applyUrl: "https://www.amazon.jobs/",
          deadline: "2026-09-20",
          status: "Saved",
          dateApplied: "",
          skills: "Java, Spring Boot, AWS, SQL",
          notes: "Need to customize resume before applying.",
          updatedAt: now
        },

        {
          id: crypto.randomUUID(),
          jobTitle: "Data Analyst",
          company: "Deloitte",
          location: "Bangalore",
          salary: "₹8–12 LPA",
          applyUrl: "https://www.deloitte.com/",
          deadline: "2026-09-10",
          status: "Rejected",
          dateApplied: "2026-08-10",
          skills: "Python, SQL, Excel",
          notes: "Rejected after resume screening.",
          updatedAt: now
        },

        {
          id: crypto.randomUUID(),
          jobTitle: "Full Stack Developer",
          company: "Razorpay",
          location: "Bangalore",
          salary: "₹12–18 LPA",
          applyUrl: "https://razorpay.com/jobs/",
          deadline: "2026-10-01",
          status: "Offer",
          dateApplied: "2026-08-05",
          skills: "React, Node.js, MongoDB, Docker",
          notes: "Offer received. Reviewing compensation and role details.",
          updatedAt: now
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