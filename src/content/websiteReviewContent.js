import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData } from "../validation/portfolioData.js";
import { WEBSITE_REVIEW_MIGRATION_ID } from "./websiteReviewMigration.js";

export const WEBSITE_PROJECT_COPY = Object.freeze({
  "research-arxiv-2608-27736": "Derives how resolving unknown lead pipes can reduce expected funding under the existing US allocation rule, then develops an audit-anchored alternative that removes this discovery penalty within the model. Reproducible allocation analysis, not a field-tested policy intervention.",
  "research-arxiv-2608-11228": "Studies public appearance records from fifteen men's and women's football leagues to examine how exposure-dependent minutes can attenuate per-minute injury-rate associations. Separates outcome truncation from a denominator gradient; observational measurements do not establish causal injury predictions.",
  "research-arxiv-2609-05584": "Decomposes playing-time allocation into rule constraints, withdrawal timing and competition behaviour using cross-sport records. Substitution chains and player re-entry limit the scope of a common identity.",
  "research-eartharxiv-15189": "Audits whether public monitoring, assistance and project records document traceable PFAS response handoffs across 50 US states and the District of Columbia. A reproducible documentation audit, not a measure of inaction, programme performance or health effects.",
  "research-zenodo-22044877": "Examines how CPU scheduling can distort sub-millisecond streaming-latency measurements, separating late clock readings from discarded samples. Controlled scheduling interventions and benchmark audits evaluate whether kernel timestamps exclude client-thread waits.",
  "project-c2307a8588da6647db62d7b3": "Uses a controlled metal-plate reflector while Tore Supra was stopped to study reflectometry calibration, phase and Fourier analysis. A supervised signal-processing report, not a live-plasma experiment.",
  "project-c1f062a755abff4388000db1": "Analyses magnetic diagnostics from the COMPASS tokamak using Python. The density target was not reached; island-mode identification and saddle-coil asymmetry remained inconclusive.",
  "project-701dc8ee8551735c9de9d27d": "Integrates impedance, electrometer and temperature readings through LabVIEW instrument control and automatic logging for electrical-susceptibility and thermally stimulated current measurements. Supervised Physics Laboratory III work at the University of Porto.",
  "project-1930afed6e1b31fc8e95b24e": "A file-storage application with a PHP/Symfony backend on Linux, ZFS-based storage and a React frontend. Includes file navigation, snapshots and authentication; a recorded demonstration documents the interface.",
  "project-e5a9d2ac9375ff84851016ad": "A carpooling application with Spring Boot microservices for users, rides and reviews, backed by MySQL and Docker. Gillian Middleton developed the Vue.js frontend; a recorded demonstration and project reports document the work.",
  "project-829a53079026e22c418fda42": "A Chrome extension for naming and saving timestamps in YouTube videos, with an options page for managing saved bookmarks.",
  "project-20e3c4c3fa44a48fd5ff553d": "An apartment-listing web application with filtering by price, location and amenities, plus authenticated listing management. Built with PHP, MariaDB and browser-side web technologies.",
  "project-739137b5bba481267f708c82": "A Python data-analysis project examining US manslaughter records from 1980 to 2014 through data cleaning, descriptive statistics and visualisation. The report explores demographic and temporal patterns without asserting causal findings.",
  "project-6f2264d4a653de434559ad0d": "A coursework report on the Product Owner's role in Scrum, covering backlog prioritisation, user stories and collaboration with the development team.",
  "project-38981053924e2c7d93a437c8": "A professional-networking application built with an Express.js/MongoDB backend and a React/Bootstrap frontend. Includes authentication, profiles, experience records and posts."
});
export const WEBSITE_FEATURED_PROJECTS = Object.freeze({
  "research-arxiv-2608-27736": 1, "research-arxiv-2608-11228": 2,
  "research-arxiv-2609-05584": 3, "research-eartharxiv-15189": 4,
  "project-e5a9d2ac9375ff84851016ad": 1, "project-1930afed6e1b31fc8e95b24e": 2
});
export const WEBSITE_FEATURED_JOBS = Object.freeze({
  "job-2fd5cc4b22e6e527a835b835": 1, "job-linkedin-boscasports-2025-09": 2,
  "job-linkedin-xerotech-2024-01": 3, "job-linkedin-invertase-2024-10": 4
});
export const WEBSITE_ROLE_LINKS = Object.freeze({
  "project-c2307a8588da6647db62d7b3": "job-dd51274e5e20da7c1715b4fe",
  "project-c1f062a755abff4388000db1": "job-9f528b7842a0aa7ab1d817da",
  "project-701dc8ee8551735c9de9d27d": "job-e3dab59ed6334e53ad5302c2",
  "project-e5a9d2ac9375ff84851016ad": "job-44a10c8d45ae3eaaa582ac9c"
});
const CAR_CONTRIBUTION = "Developed most of the Spring Boot backend for CarSurfing, a microservices-based carpooling service.";
const EVIDENCE = ["Owner-confirmed website/CV review, 2026-10-16; docs/website-review-migration.md"];
const OPTIONAL = new Set(["featuredOrder", "programme"]);
const MEDIA_LABELS = Object.freeze({
  "research-arxiv-2608-27736": "Lead-pipe funding preprint",
  "research-arxiv-2608-11228": "Football exposure preprint",
  "research-arxiv-2609-05584": "Playing-time allocation preprint",
  "research-eartharxiv-15189": "PFAS public-record audit preprint",
  "research-zenodo-22044877": "Streaming-latency manuscript",
  "project-c2307a8588da6647db62d7b3": "Reflectometry report",
  "project-c1f062a755abff4388000db1": "COMPASS tokamak report",
  "project-701dc8ee8551735c9de9d27d": "LabVIEW control and data-acquisition report",
  "project-e5a9d2ac9375ff84851016ad": "CarSurfing",
  "project-1930afed6e1b31fc8e95b24e": "Filebox"
});

/**
 * Creates a proposal from current normalized values and reviewed copy.
 *
 * This is offline planning, not approval or an automatic updater. Review the
 * resulting exact source/candidate hashes and full private field diff before
 * applying through the separate guarded runner. Missing/ambiguous identities
 * fail closed. No statuses, paper bylines, primary URLs, maps or courses change.
 * Only latency links change reading order as a complete [2,1,0] tuple permutation.
 * Repeated per-record skill tags are curated while retaining the full distinct
 * portfolio vocabulary, including uncertain unique technical skills.
 *
 * @param {object} current Complete raw snapshot; never a tracked seed for live replacement.
 * @returns {{version:number,migrationId:string,patches:import('./websiteReviewMigration.js').WebsiteReviewPatch[]}} Reviewable plan only.
 */
export function createWebsiteReviewPlan(current) {
  const d = normalizePortfolioData(current);
  const patches = new Map();
  const unique = (rows, predicate) => {
    const matches = rows.filter(predicate);
    if (matches.length !== 1) throw new Error("Website copy requires every exact reviewed identity.");
    return matches[0];
  };
  const project = id => unique(d.projects, row => row.id === id);
  const job = id => unique(d.jobs, row => row.id === id);
  const education = institution => unique(d.education, row => row.institution === institution);
  const add = (collection, row, values, extra = {}) => {
    const identity = collection === "education" ? { match: Object.fromEntries(["degree", "institution", "start", "end"].map(key => [key, row[key]])) }
      : ["jobs", "projects"].includes(collection) ? { id: row.id } : extra;
    const key = JSON.stringify([collection, identity]);
    const patch = patches.get(key) || { collection, ...identity, expected: {}, values: {}, evidence: [...EVIDENCE] };
    Object.assign(patch, extra);
    for (const [field, value] of Object.entries(values)) {
      const original = row[field] ?? (OPTIONAL.has(field) ? null : undefined);
      if (isDeepStrictEqual(original, value)) continue;
      patch.expected[field] = original;
      patch.values[field] = value;
    }
    if (Object.keys(patch.values).length) patches.set(key, patch);
  };
  add("profile", d.profile, {
    academicStatus: "MSc Statistics and Data Science, Trinity College Dublin",
    availability: "Available for PhD opportunities from July 2027",
    summary: "Physics, statistics and software engineering inform my work on learning systems and scientific measurement."
  });
  add("research", d.research, {
    summary: "How do modelling and measurement choices change the conclusions we draw? My work spans learning systems, statistical inference and scientific computing.",
    thesisSummary: "I compare two tasks trained together on the same inputs, using a shared trunk and separate heads, with matched single-task networks. The aim is to understand when sharing helps or hurts and whether transfer can be predicted before training."
  });
  const pageCopy = {
    home: { title: "Gustavo Pedro Ricou", description: "Physics, statistics and software engineering, with a current thesis on transfer and gradient interference in multi-task learning." },
    experience: { description: "Industry, software, data and teaching roles, with contributions to production systems and analysis." },
    education: { description: "Academic training in physics, computing and statistics, with research placements in fusion and experimental physics." },
    projects: { description: "Software, data analysis and supervised scientific projects, with code, reports and recorded demonstrations where available." },
    contact: { description: "I welcome PhD opportunities starting from July 2027 and research collaborations in machine learning, statistics and scientific computing." }
  };
  for (const [page, values] of Object.entries(pageCopy)) add("pages", d.pages[page], values, { page });
  for (const [id, description] of Object.entries(WEBSITE_PROJECT_COPY)) add("projects", project(id), { description });
  for (const [id, featuredOrder] of Object.entries(WEBSITE_FEATURED_PROJECTS)) add("projects", project(id), { featuredOrder });
  for (const [id, featuredOrder] of Object.entries(WEBSITE_FEATURED_JOBS)) add("jobs", job(id), { featuredOrder });
  for (const [id, role] of Object.entries(WEBSITE_ROLE_LINKS)) {
    job(role);
    const row = project(id);
    add("projects", row, { relatedRoleIds: [...new Set([...row.relatedRoleIds, role])] });
  }
  add("jobs", job("job-44a10c8d45ae3eaaa582ac9c"), { duties: [CAR_CONTRIBUTION] });
  add("projects", project("project-e5a9d2ac9375ff84851016ad"), { name: "CarSurfing", contribution: CAR_CONTRIBUTION });
  add("projects", project("project-1930afed6e1b31fc8e95b24e"), { name: "Filebox" });
  for (const id of ["project-e5a9d2ac9375ff84851016ad", "project-1930afed6e1b31fc8e95b24e", "project-829a53079026e22c418fda42", "project-20e3c4c3fa44a48fd5ff553d", "project-38981053924e2c7d93a437c8"]) add("projects", project(id), { category: "software" });
  add("projects", project("project-739137b5bba481267f708c82"), { category: "data" });
  add("projects", project("project-6f2264d4a653de434559ad0d"), { category: "coursework" });
  for (const name of ["Technological University of the Shannon", "Atlantic Technological University"]) add("education", education(name), { grade: "First Class Honours" });
  add("education", education("Universidade do Porto"), { grade: "15/20; ranked third of 50" });
  const tcd = education("Trinity College Dublin");
  add("education", tcd, { grade: "80% (provisional mark as of June 2026; not a final degree result)", end: "Present",
    activities: [...tcd.activities, "Thesis submission and defence expected in April 2027; results expected in May or June 2027. PhD availability from July 2027."] });
  for (const name of ["Universite de Lorraine", "Universität Stuttgart"]) {
    const row = education(name);
    add("education", row, { programme: "Fusion-EP", activities: [...row.activities.filter(text => text.startsWith("One Fusion-EP programme")), ...row.activities.filter(text => !text.startsWith("One Fusion-EP programme"))] });
  }
  const labels = {
    "project-1930afed6e1b31fc8e95b24e": ["Backend repository", "Frontend repository", "Recorded demonstration"],
    "project-e5a9d2ac9375ff84851016ad": ["Project report", "Project poster", "Recorded demonstration"],
    "project-20e3c4c3fa44a48fd5ff553d": ["Historical project link"],
    "project-38981053924e2c7d93a437c8": ["Backend repository", "Historical demo link"],
    "research-arxiv-2608-27736": ["arXiv preprint", "Data and code"],
    "research-arxiv-2608-11228": ["arXiv preprint"],
    "research-arxiv-2609-05584": ["arXiv preprint"],
    "research-eartharxiv-15189": ["EarthArXiv preprint", "Preprint DOI", "Reproducibility materials"]
  };
  for (const [id, text] of Object.entries(labels)) add("projects", project(id), { linksTitles: text, linksDescriptions: text, linksBackupDescriptions: text });
  const latency = project("research-zenodo-22044877");
  const linkOrder = [2, 1, 0];
  const latencyLabels = ["Current manuscript", "Code and analysis", "Older restricted archive"];
  add("projects", latency, { links: linkOrder.map(index => latency.links[index]), linksTitles: latencyLabels,
    linksDescriptions: latencyLabels, linksBackupDescriptions: latencyLabels }, { linkOrder });

  const selected = [];
  const curate = (collection, row, priority) => {
    selected.push({ collection, row, skills: priority.filter(skill => row.skills.includes(skill)) });
  };
  curate("education", tcd, ["Statistics", "Statistical Modeling", "R", "Data Analysis", "Experimental Design", "Time Series Analysis", "Machine Learning", "Scientific Computing", "Scientific Research", "Scientific Writing", "Probability Theory", "Linear Algebra", "Numerical Methods", "Uncertainty Quantification", "Causal Inference", "Bayesian Statistics"]);
  curate("education", education("Technological University of the Shannon"), ["Java", "Spring Boot", "Microservices", "Docker", "Kubernetes", "AWS", "CI/CD", "Software Testing", "Git", "Python", "Software Architecture", "Cloud Native Computing", "Authentication", "REST APIs", "MySQL", "Observability", "Service Discovery", "Infrastructure as Code"]);
  curate("education", education("Atlantic Technological University"), ["Java", "Object-Oriented Programming", "Software Testing", "Software Development", "SQL", "Database Management", "Linux", "Shell Scripting", "HTML", "CSS", "PHP", "Web Development", "Git", "Software Design Patterns", "Debugging", "Networking"]);
  curate("education", education("EPICODE"), ["JavaScript", "Node.js", "Express.js", "React", "HTML", "CSS", "MongoDB", "PostgreSQL", "SQL", "Authentication", "REST APIs", "Microsoft Azure", "Web Development"]);
  curate("projects", project("project-e5a9d2ac9375ff84851016ad"), ["Java", "Spring Boot", "Microservices", "REST APIs", "MySQL", "Docker", "Service Discovery", "Software Testing", "Git"]);
  curate("projects", project("project-1930afed6e1b31fc8e95b24e"), ["PHP", "Symfony", "Linux", "ZFS", "React", "MySQL", "API Development", "Authentication", "Git", "Software Testing"]);
  curate("projects", project("project-38981053924e2c7d93a437c8"), ["Node.js", "Express.js", "MongoDB", "React", "JavaScript", "Authentication", "REST APIs", "Git", "Data Modeling"]);
  const changedRows = new Set(selected.map(entry => entry.row));
  const retained = new Set(["jobs", "education", "projects"].flatMap(key => d[key].filter(row => !changedRows.has(row)).flatMap(row => row.skills)));
  for (const entry of selected) for (const skill of entry.skills) retained.add(skill);
  for (const entry of selected) for (const skill of entry.row.skills) {
    if (!retained.has(skill)) { entry.skills.push(skill); retained.add(skill); }
  }
  for (const entry of selected) add(entry.collection, entry.row, { skills: entry.skills });

  for (const collection of ["jobs", "education", "projects"]) for (const row of d[collection]) {
    const label = MEDIA_LABELS[row.id] || row.company || row.institution || row.name;
    const fallback = index => `${label} - image ${index + 1}`;
    const carLanding = row.id === "project-e5a9d2ac9375ff84851016ad";
    const descriptions = row.imageDescriptions.map((text, i) => text || (carLanding && i === 0 ? "CarSurfing landing page" : fallback(i)));
    const backups = row.imageBackupDescriptions.map((text, i) => {
      if (row.id === "project-e5a9d2ac9375ff84851016ad" && i === 0) return "CarSurfing landing page";
      if (text && text.length <= 180) return text;
      const caption = row.imageDescriptions[i] || row.imageTitles[i];
      return caption && caption.length <= 180 ? caption : fallback(i);
    });
    add(collection, row, { imageDescriptions: descriptions, imageBackupDescriptions: backups });
    if (carLanding && !row.imageTitles[0]) {
      add(collection, row, { imageTitles: row.imageTitles.map((text, i) => i === 0 ? "CarSurfing landing page" : text) });
    }
  }
  return { version: 1, migrationId: WEBSITE_REVIEW_MIGRATION_ID, patches: [...patches.values()] };
}
