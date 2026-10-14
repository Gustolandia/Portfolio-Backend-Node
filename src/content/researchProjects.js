/**
 * Explicit one-time content additions audited on 2026-10-15. Authors are ordered
 * bylines, independent of collaborators. No affiliations, contribution claims
 * or decorative images are inferred. See docs/research-content-migration.md.
 * These records are never inserted by GET or PUT normalization.
 */
export const RESEARCH_PROJECTS = Object.freeze([
  {
    id: "research-arxiv-2609-05584",
    name: "One equation allocates playing time in competitive team sports: the rulebook sets the arithmetic and the league sets the habit",
    dateOfCompletion: "2026-09-04",
    category: "research", outputType: "preprint", status: "preprint",
    authors: ["Gustavo Pedro Ricou"],
    description: "An analysis of playing-time allocation across team sports, separating substitution rules from competition-specific patterns. Uses cross-league comparisons to study how constraints and withdrawal timing shape participation. Available as an arXiv preprint.",
    skills: ["Statistics", "Mathematical Modeling", "Data Analysis"],
    links: ["https://arxiv.org/abs/2609.05584"],
    linksDescriptions: ["arXiv preprint; first submitted 4 September 2026"],
    linksBackupDescriptions: ["Open the playing-time allocation preprint on arXiv"]
  },
  {
    id: "research-arxiv-2608-11228",
    name: "Playing time tracks recent exposure in fifteen men's and women's football leagues: the denominator gradient and what it does to per-minute injury rates",
    dateOfCompletion: "2026-08-22",
    category: "research", outputType: "preprint", status: "preprint",
    authors: ["Gustavo Pedro Ricou", "Nicholas Mahony"],
    description: "A retrospective study of public football records examining whether playing time provides a neutral denominator for injury rates. Compares exposure definitions and repeats the denominator check across men's and women's leagues. The current arXiv version is v3; not peer reviewed.",
    skills: ["Statistics", "Data Analysis"],
    links: ["https://arxiv.org/abs/2608.11228"],
    linksDescriptions: ["arXiv preprint v3; submitted 29 July, revised 22 August 2026"],
    linksBackupDescriptions: ["Open the current football exposure preprint on arXiv"]
  },
  {
    id: "research-arxiv-2608-27736",
    name: "Don't look now: paying for documented need punishes discovery in US lead-pipe funding",
    dateOfCompletion: "2026-09-06",
    category: "research", outputType: "preprint", status: "preprint",
    authors: ["Gustavo Pedro Ricou", "Kristin C. Epstein"],
    description: "A reconstruction of US lead-pipe funding allocations that examines incentives created by self-reported inventories. Combines analysis of the allocation rule with an audited alternative to study how documenting previously unknown pipes affects funding. Available as an arXiv preprint.",
    skills: ["Mathematical Modeling", "Statistics", "Data Analysis"],
    links: ["https://arxiv.org/abs/2608.27736", "https://doi.org/10.5281/zenodo.22552146"],
    linksDescriptions: ["arXiv preprint v2; submitted 27 August, revised 6 September 2026", "Related data and code on Zenodo"],
    linksBackupDescriptions: ["Open the current lead-pipe funding preprint on arXiv", "Open the related lead-pipe funding reproducibility record"]
  },
  {
    id: "research-eartharxiv-15189",
    name: "Do public records document PFAS drinking-water response handoffs? A 51-jurisdiction audit",
    dateOfCompletion: "2026-09-25",
    category: "research", outputType: "preprint", status: "preprint",
    authors: ["Gustavo Pedro Ricou"],
    description: "A registered audit of public PFAS response records across US states and the District of Columbia. Examines whether monitoring, assistance and project documents establish traceable administrative handoffs. The scope is documentation, not a measure of programme performance or health effects. Not peer reviewed.",
    skills: ["Scientific Research", "Data Analysis", "Research and Development"],
    links: ["https://eartharxiv.org/repository/view/15189/", "https://doi.org/10.31223/X58510", "https://doi.org/10.5281/zenodo.22948936"],
    linksDescriptions: ["EarthArXiv preprint; deposited 24 September, updated 25 September 2026", "Preprint DOI", "Reproducibility materials on Zenodo"],
    linksBackupDescriptions: ["Open the PFAS public-record audit preprint", "Resolve the PFAS preprint DOI", "Open the PFAS audit reproducibility materials"]
  },
  {
    id: "research-zenodo-22044877",
    name: "When the Interval Is Smaller Than the Instrument: code and analysis for two failure modes of streaming latency benchmarks",
    dateOfCompletion: "",
    category: "research", outputType: "manuscript", status: "in-preparation",
    authors: ["Gustavo Pedro Ricou"],
    description: "A first-version manuscript in preparation on measurement failures in streaming-latency benchmarks. Studies timestamp resolution, scheduling and sample filtering through code and analysis. The linked Zenodo record is an associated software artifact; its release versions do not establish manuscript publication or peer review.",
    skills: ["Performance Testing", "Experimental Design", "Statistics", "Python"],
    links: ["https://zenodo.org/records/22044877"],
    linksDescriptions: ["Associated code and analysis artifact on Zenodo; manuscript in preparation"],
    linksBackupDescriptions: ["Open the streaming-latency code and analysis record"]
  }
]);

/**
 * Identifies known research records by stable ID, source URL/DOI or an exact
 * verified historical title. arXiv PDF/abs/HTML links and version suffixes collapse
 * to one identity. Identification never overwrites an existing edited record.
 *
 * @param {object} project Candidate existing project.
 * @returns {string | undefined} Canonical seed ID, or undefined for other work.
 */
export function researchIdentity(project) {
  const known = RESEARCH_PROJECTS.find(({ id, name }) => project.id === id || project.name === name);
  if (known) return known.id;

  const earlierFootballTitles = [
    "What public football injury reports can and cannot show about short-term match exposure: an English Premier League analysis",
    "Dividing by playing time removes part of the association it should scale: measuring the denominator gradient in eight European leagues"
  ];
  if (earlierFootballTitles.includes(project.name)) return "research-arxiv-2608-11228";

  for (const link of Array.isArray(project.links) ? project.links : []) {
    if (typeof link !== "string") continue;
    try {
      const url = new URL(link);
      const arxiv = /^\/(?:abs|pdf|html)\/(2609\.05584|2608\.11228|2608\.27736)(?:v\d+)?(?:\.pdf)?\/?$/.exec(url.pathname);
      const doi = /^\/10\.48550\/arXiv\.(2609\.05584|2608\.11228|2608\.27736)$/i.exec(url.pathname);
      if ((url.hostname === "arxiv.org" && arxiv) || (url.hostname === "doi.org" && doi)) {
        return `research-arxiv-${(arxiv || doi)[1].replace(".", "-")}`;
      }
      if ((url.hostname === "eartharxiv.org" && /^\/repository\/view\/15189\/?$/.test(url.pathname)) ||
          (url.hostname === "doi.org" && /^\/10\.31223\/X58510$/i.test(url.pathname))) {
        return "research-eartharxiv-15189";
      }
      if (url.hostname === "zenodo.org" && /^\/(?:records|record)\/22044877\/?$/.test(url.pathname)) {
        return "research-zenodo-22044877";
      }
    } catch { /* Non-URL legacy link text cannot identify a research record. */ }
  }
  return undefined;
}
