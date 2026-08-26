const STORAGE_KEY = 'hireflow.applications.v1';
const DRAFT_KEY = 'hireflow.draft.v1';
const THEME_KEY = 'hireflow.theme.v1';

const MAX_NOTES_LENGTH = 400;
const MAX_SUMMARY_LENGTH = 120;
const MIN_TITLE_LENGTH = 3;
const MAX_TITLE_LENGTH = 80;

const SKILL_POOL = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node',
  'Node.js',
  'Python',
  'Java',
  'SQL',
  'AWS',
  'Azure',
  'GCP',
  'Docker',
  'Kubernetes',
  'CI/CD',
  'Git',
  'API',
  'Agile',
  'Scrum',
  'Excel',
  'Communication',
  'Leadership',
  'HTML',
  'CSS',
  'Vue',
  'Angular',
  'Django',
  'Spring Boot',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Tailwind'
];

const form = document.getElementById('applicationForm');
const list = document.getElementById('applicationsList');
const template = document.getElementById('applicationCardTemplate');
const stats = document.getElementById('stats');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const sortSelect = document.getElementById('sortSelect');
const analysisHint = document.getElementById('analysisHint');
const themeToggle = document.getElementById('themeToggle');

const fieldIds = [
  'jobTitle',
  'company',
  'location',
  'salary',
  'applyUrl',
  'deadline',
  'status',
  'dateApplied',
  'skills',
  'notes'
];

let applications = loadJson(STORAGE_KEY, []);
let editingId = null;
let statusChart = null;
let isDarkMode = loadJson(THEME_KEY, false);


/* =========================================================
   THEME
========================================================= */

if (isDarkMode) {
  document.body.classList.add('dark-theme');
}

themeToggle.addEventListener('click', () => {
  isDarkMode = !isDarkMode;

  document.body.classList.toggle('dark-theme', isDarkMode);

  localStorage.setItem(
    THEME_KEY,
    JSON.stringify(isDarkMode)
  );

  if (statusChart) {
    statusChart.options.plugins.legend.labels.color =
      isDarkMode ? '#f8fafc' : '#162136';

    statusChart.update();
  }
});


/* =========================================================
   STORAGE
========================================================= */

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
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
  fieldIds.forEach((id) => {
    const el = document.getElementById(id);

    if (el) {
      el.value = data[id] || '';
    }
  });
}

function resetForm() {
  editingId = null;

  form.reset();

  document.getElementById('status').value = 'Saved';
  document.getElementById('dateApplied').value = '';
}


/* =========================================================
   JOB DESCRIPTION ANALYZER
========================================================= */

function autoExtract(description) {

  const clean = description
    .replace(/\r/g, '')
    .trim();

  /*
   * Helper:
   * Tries multiple regex patterns and returns
   * the first successful result.
   */
  const pick = (patterns) => {

    for (const regex of patterns) {

      const match = clean.match(regex);

      if (match && match[1]) {
        return match[1]
          .trim()
          .replace(/\s+/g, ' ');
      }
    }

    return '';
  };


  /* ---------------------------------------------------------
     JOB TITLE
  --------------------------------------------------------- */

  const firstLine =
    clean
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0) || '';

  const titleFromLabel = pick([
    /(?:job title|job|position|role|opening)\s*[:\-]\s*([^\n]+)/i
  ]);

  let jobTitle = titleFromLabel;

  if (!jobTitle) {

    if (
      firstLine.length >= MIN_TITLE_LENGTH &&
      firstLine.length <= MAX_TITLE_LENGTH &&
      !/^(company|location|salary|skills|required skills|deadline|apply by)\s*:/i.test(firstLine)
    ) {
      jobTitle = firstLine;
    }
  }


  /* ---------------------------------------------------------
     COMPANY
  --------------------------------------------------------- */

  const company = pick([
    /(?:company|organization|employer)\s*[:\-]\s*([^\n]+)/i
  ]);


  /* ---------------------------------------------------------
     LOCATION
  --------------------------------------------------------- */

  const location = pick([
    /(?:location|based in|work location|office location)\s*[:\-]\s*([^\n]+)/i
  ]);


  /* ---------------------------------------------------------
     SALARY
  --------------------------------------------------------- */

  const salaryByLabel = pick([
    /(?:salary|compensation|pay|ctc)\s*[:\-]\s*([^\n]+)/i
  ]);

  const salaryByINR = clean.match(
    /₹\s*[\d,.]+\s*(?:-|–|to)\s*₹?\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)?/i
  )?.[0] || '';

  const singleINR = clean.match(
    /₹\s*[\d,.]+\s*(?:LPA|lpa|lakhs?|lakhs per annum)/i
  )?.[0] || '';

  const salaryByDollar = clean.match(
    /\$\s*[\d,.]+\s*(?:-|–|to)\s*\$?\s*[\d,.]+(?:\s*(?:per year|year|yr|hr|hour))?/i
  )?.[0] || '';

  const salary =
    salaryByLabel ||
    salaryByINR ||
    singleINR ||
    salaryByDollar;


  /* ---------------------------------------------------------
     APPLICATION URL
  --------------------------------------------------------- */

  const applyUrl =
    clean.match(/https?:\/\/[^\s)]+/i)?.[0] || '';


  /* ---------------------------------------------------------
     DEADLINE
  --------------------------------------------------------- */

  const deadlinePhrase = pick([
    /(?:deadline|apply by|application deadline|last date)\s*[:\-]\s*([^\n]+)/i
  ]);

  const deadline = parseToDate(deadlinePhrase);


  /* ---------------------------------------------------------
     SKILLS
  --------------------------------------------------------- */

  const detectedSkills = [];

  SKILL_POOL.forEach((word) => {

    const escapedWord = word.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );

    const regex = new RegExp(
      `(^|[^a-zA-Z0-9+#.])${escapedWord}(?=$|[^a-zA-Z0-9+#.])`,
      'i'
    );

    if (regex.test(clean)) {

      /*
       * Avoid duplicate Node / Node.js type results
       */
      if (
        word === 'Node' &&
        /\bNode\.js\b/i.test(clean)
      ) {
        return;
      }

      detectedSkills.push(word);
    }
  });

  const skills = detectedSkills.join(', ');


  /*
   * IMPORTANT:
   *
   * We DO NOT put the JD into Notes.
   *
   * Notes stays empty unless the user already
   * has something manually written there.
   */

  return {
    jobTitle,
    company,
    location,
    salary,
    applyUrl,
    deadline,
    skills
  };
}


/* =========================================================
   DATE PARSER
========================================================= */

function parseToDate(value) {

  if (!value) {
    return '';
  }

  const cleanedValue = value
    .replace(/(\d+)(st|nd|rd|th)/gi, '$1')
    .trim();

  const parsed = new Date(cleanedValue);

  if (Number.isNaN(parsed.getTime())) {
    return '';
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

  const status = statusFilter.value;
  const sort = sortSelect.value;

  let result = applications.filter((app) => {

    const searchableText =
      `${app.jobTitle || ''} 
       ${app.company || ''} 
       ${app.location || ''} 
       ${app.skills || ''} 
       ${app.notes || ''}`
        .toLowerCase();

    const queryOk =
      !q || searchableText.includes(q);

    const statusOk =
      status === 'all' ||
      app.status === status;

    return queryOk && statusOk;
  });


  result.sort((a, b) => {

    if (sort === 'dateDesc') {

      return (
        b.dateApplied || '0000-00-00'
      ).localeCompare(
        a.dateApplied || '0000-00-00'
      );

    } else if (sort === 'dateAsc') {

      return (
        a.dateApplied || '9999-99-99'
      ).localeCompare(
        b.dateApplied || '9999-99-99'
      );

    } else if (sort === 'title') {

      return (
        a.jobTitle || ''
      ).localeCompare(
        b.jobTitle || ''
      );

    } else if (sort === 'company') {

      return (
        a.company || ''
      ).localeCompare(
        b.company || ''
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

  const counts = applications.reduce(
    (acc, app) => {

      acc.total += 1;

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
    'total',
    'Saved',
    'Applied',
    'Interview',
    'Offer',
    'Rejected'
  ]
    .map((k) => {

      return `
        <div class="stat">
          <strong>
            ${k === 'total' ? 'Total' : k}
          </strong>
          <br>
          ${counts[k] || 0}
        </div>
      `;

    })
    .join('');


  updateChart(counts);
}


/* =========================================================
   DOUGHNUT CHART
========================================================= */

function updateChart(counts) {

  const canvas =
    document.getElementById('statusChart');

  if (!canvas) {
    return;
  }

  const ctx =
    canvas.getContext('2d');

  const data = {

    labels: [
      'Saved',
      'Applied',
      'Interview',
      'Offer',
      'Rejected'
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
          '#94a3b8',
          '#3b82f6',
          '#a855f7',
          '#22c55e',
          '#ef4444'
        ],

        borderWidth: 1
      }

    ]
  };


  if (statusChart) {

    statusChart.data = data;
    statusChart.update();

  } else {

    statusChart = new Chart(ctx, {

      type: 'doughnut',

      data: data,

      options: {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

          legend: {

            position: 'right',

            labels: {

              color:
                isDarkMode
                  ? '#f8fafc'
                  : '#162136'
            }
          }
        }
      }
    });
  }
}


/* =========================================================
   APPLICATION LIST
========================================================= */

function renderList() {

  renderStats();

  list.innerHTML = '';

  const items =
    filteredApplications();


  if (!items.length) {

    list.innerHTML = `
      <li class="application-card">
        <p>
          No applications found.
          Save one to get started.
        </p>
      </li>
    `;

    return;
  }


  items.forEach((app) => {

    const node =
      template.content
        .firstElementChild
        .cloneNode(true);


    node.classList.add(
      `status-${(
        app.status || 'saved'
      ).toLowerCase()}`
    );


    node.querySelector(
      '[data-role="title"]'
    ).textContent =
      `${app.jobTitle || 'Untitled role'} — ${
        app.company || 'Unknown company'
      }`;


    node.querySelector(
      '[data-role="meta"]'
    ).textContent = [

      app.location,

      app.salary,

      app.dateApplied &&
        `Applied: ${app.dateApplied}`

    ]
      .filter(Boolean)
      .join(' • ');


    node.querySelector(
      '[data-role="summary"]'
    ).textContent =
      app.notes
        ?.slice(0, MAX_SUMMARY_LENGTH) || '';


    node.querySelector(
      '[data-role="skills"]'
    ).textContent =
      app.skills
        ? `Skills: ${app.skills}`
        : '';


    /* STATUS */

    const statusSelect =
      node.querySelector(
        '[data-role="statusSelect"]'
      );

    statusSelect.value =
      app.status || 'Saved';


    statusSelect.addEventListener(
      'change',
      () => {

        app.status =
          statusSelect.value;

        saveApplications();

        renderList();
      }
    );


    /* EDIT */

    node.querySelector(
      '[data-role="edit"]'
    ).addEventListener(
      'click',
      () => {

        editingId = app.id;

        setForm(app);

        saveDraft();

        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    );


    /* DELETE */

    node.querySelector(
      '[data-role="delete"]'
    ).addEventListener(
      'click',
      () => {

        applications =
          applications.filter(
            (item) =>
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
   DRAFT SYSTEM
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

  if (draft) {

    if (draft.editingId) {
      editingId =
        draft.editingId;
    }

    setForm(draft);

    return true;
  }

  return false;
}


/* =========================================================
   ANALYZE BUTTON
========================================================= */

document
  .getElementById('analyzeBtn')
  .addEventListener(
    'click',
    () => {

      const description =
        document
          .getElementById(
            'jobDescription'
          )
          .value
          .trim();


      if (!description) {

        analysisHint.textContent =
          'Paste a job description first.';

        return;
      }


      const prefilled =
        autoExtract(description);


      /*
       * Get current form values.
       * This means manually entered Notes
       * will NOT be deleted.
       */

      const currentData =
        formDataObject();


      const mergedData = {
        ...currentData
      };


      /*
       * Only update fields where
       * extraction actually found something.
       */

      Object.keys(prefilled).forEach(
        (key) => {

          if (prefilled[key]) {

            mergedData[key] =
              prefilled[key];
          }
        }
      );


      setForm(mergedData);


      analysisHint.textContent =
        '✓ Job details extracted. Review the fields and click Save Application.';


      saveDraft();
    }
  );


/* =========================================================
   CLEAR DRAFT
========================================================= */

document
  .getElementById('clearDraftBtn')
  .addEventListener(
    'click',
    () => {

      localStorage.removeItem(
        DRAFT_KEY
      );

      document
        .getElementById(
          'jobDescription'
        )
        .value = '';


      analysisHint.textContent =
        'Draft cleared.';

      resetForm();
    }
  );


/* =========================================================
   AUTO SAVE DRAFT
========================================================= */

form.addEventListener(
  'input',
  saveDraft
);


/* =========================================================
   SAVE APPLICATION
========================================================= */

form.addEventListener(
  'submit',
  (event) => {

    event.preventDefault();


    const data =
      formDataObject();


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
          (item) =>
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
      editingId
        ? 'Application updated.'
        : 'Application saved.';


    resetForm();

    renderList();
  }
);


/* =========================================================
   RESET FORM
========================================================= */

document
  .getElementById('resetFormBtn')
  .addEventListener(
    'click',
    () => {

      localStorage.removeItem(
        DRAFT_KEY
      );

      resetForm();
    }
  );


/* =========================================================
   SEARCH / FILTER / SORT
========================================================= */

searchInput.addEventListener(
  'input',
  renderList
);

statusFilter.addEventListener(
  'change',
  renderList
);

sortSelect.addEventListener(
  'change',
  renderList
);


/* =========================================================
   EXPORT JSON
========================================================= */

document
  .getElementById('exportBtn')
  .addEventListener(
    'click',
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
              'application/json'
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const a =
        document.createElement(
          'a'
        );

      a.href = url;

      a.download =
        'hireflow-applications.json';

      a.click();

      URL.revokeObjectURL(url);
    }
  );


/* =========================================================
   EXPORT CSV
========================================================= */

document
  .getElementById('exportCsvBtn')
  .addEventListener(
    'click',
    () => {

      if (!applications.length) {
        return;
      }


      const headers = [

        'jobTitle',
        'company',
        'location',
        'salary',
        'applyUrl',
        'deadline',
        'status',
        'dateApplied',
        'skills',
        'notes',
        'updatedAt'

      ];


      const rows =
        applications.map(
          (app) =>

            headers
              .map((h) => {

                const val =
                  app[h] || '';

                return `"${String(val)
                  .replace(/"/g, '""')}"`;
              })
              .join(',')
        );


      const csvContent =
        [
          headers.join(','),
          ...rows
        ].join('\n');


      const blob =
        new Blob(
          [csvContent],
          {
            type: 'text/csv'
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const a =
        document.createElement(
          'a'
        );

      a.href = url;

      a.download =
        'hireflow-applications.csv';

      a.click();

      URL.revokeObjectURL(url);
    }
  );


/* =========================================================
   IMPORT JSON
========================================================= */

document
  .getElementById('importBtn')
  .addEventListener(
    'click',
    () => {

      document
        .getElementById(
          'importFile'
        )
        .click();
    }
  );


document
  .getElementById('importFile')
  .addEventListener(
    'change',
    async (event) => {

      const [file] =
        event.target.files || [];


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
            'Invalid format'
          );
        }


        const valid =
          imported.filter(
            (item) =>
              item &&
              typeof item ===
                'object' &&
              item.id
          );


        const skipped =
          imported.length -
          valid.length;


        applications =
          valid;


        saveApplications();

        renderList();


        analysisHint.textContent =
          skipped > 0
            ? `Imported ${valid.length} applications. Skipped ${skipped} invalid entries.`
            : `Imported ${valid.length} applications.`;

      } catch {

        analysisHint.textContent =
          'Could not import file. Use exported JSON format.';
      }

      event.target.value = '';
    }
  );


/* =========================================================
   DEMO DATA
========================================================= */

document
  .getElementById('loadSampleBtn')
  .addEventListener(
    'click',
    () => {

      const sampleData = [

        {
          id: crypto.randomUUID(),
          jobTitle:
            'Senior Frontend Engineer',
          company:
            'TechCorp Inc.',
          location:
            'Remote (US)',
          salary:
            '$140,000 - $160,000',
          applyUrl:
            'https://techcorp.com/careers/frontend',
          deadline:
            '2026-12-31',
          status:
            'Interview',
          dateApplied:
            '2026-10-15',
          skills:
            'React, TypeScript, CSS, Testing',
          notes:
            'Had a great first round with the hiring manager. Next step is a technical pair programming session.',
          updatedAt:
            new Date().toISOString()
        },

        {
          id: crypto.randomUUID(),
          jobTitle:
            'Full Stack Developer',
          company:
            'StartupX',
          location:
            'New York, NY',
          salary:
            '$120,000',
          applyUrl:
            'https://startupx.io/jobs/123',
          deadline:
            '2026-11-15',
          status:
            'Applied',
          dateApplied:
            '2026-10-20',
          skills:
            'Node.js, React, PostgreSQL',
          notes:
            'Applied through their custom portal. Need to follow up in a week if I do not hear back.',
          updatedAt:
            new Date().toISOString()
        },

        {
          id: crypto.randomUUID(),
          jobTitle:
            'Software Engineer II',
          company:
            'Global Systems',
          location:
            'Austin, TX',
          salary:
            '$130,000',
          applyUrl:
            '',
          deadline:
            '',
          status:
            'Rejected',
          dateApplied:
            '2026-09-01',
          skills:
            'Java, Spring Boot, AWS',
          notes:
            'Received a standard rejection email. Role might have been filled internally.',
          updatedAt:
            new Date().toISOString()
        },

        {
          id: crypto.randomUUID(),
          jobTitle:
            'Lead Web Developer',
          company:
            'Creative Agency',
          location:
            'London, UK (Hybrid)',
          salary:
            '£80,000',
          applyUrl:
            'https://creative.agency/careers',
          deadline:
            '2026-11-30',
          status:
            'Offer',
          dateApplied:
            '2026-09-15',
          skills:
            'JavaScript, Vue.js, Tailwind',
          notes:
            'They offered! Need to review the benefits package before accepting.',
          updatedAt:
            new Date().toISOString()
        },

        {
          id: crypto.randomUUID(),
          jobTitle:
            'Backend Engineer',
          company:
            'DataStream',
          location:
            'San Francisco, CA',
          salary:
            '$150,000+',
          applyUrl:
            'https://datastream.io/apply',
          deadline:
            '2026-12-01',
          status:
            'Saved',
          dateApplied:
            '',
          skills:
            'Python, Django, Redis, Docker',
          notes:
            'Interesting company, need to polish my resume to highlight my Docker experience before applying.',
          updatedAt:
            new Date().toISOString()
        }

      ];


      applications = [
        ...sampleData,
        ...applications
      ];


      saveApplications();

      renderList();

      analysisHint.textContent =
        'Sample data loaded successfully!';
    }
  );


/* =========================================================
   INITIALIZE APP
========================================================= */

const hasDraft =
  loadDraft();

if (!hasDraft) {
  resetForm();
}

renderList();