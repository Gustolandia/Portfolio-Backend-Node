/**
 * Evidence-reviewed portfolio copy for an explicit one-time maintenance plan.
 * This catalogue is never imported by API handlers, defaults or normalizers.
 * Sources and responsibility limits: docs/academic-review-migration.md.
 * Existing IDs, categories, dates, statuses, media and relationships are retained.
 * @type {Readonly<Record<string, {description:string,contribution:string,name?:string,authors?:string[]}>>}
 */
export const ACADEMIC_REVIEW_PROJECT_COPY = Object.freeze({
  "research-eartharxiv-15189": {
    contribution: "Sole author: designed and carried out the registered public-record audit and prepared its reproducibility materials and manuscript.",
    description: "A registered audit across 50 US states and the District of Columbia tests whether public monitoring, assistance and project records document traceable response handoffs. It provides a reproducible way to distinguish an evidenced administrative relationship from merely adjacent records. This is a documentation finding, not a measure of state inaction, programme performance or health effects. Preprint; not peer reviewed."
  },
  "research-arxiv-2608-27736": {
    contribution: "Lead author: developed the study concept, analytical methodology, software and allocation mechanism, carried out the formal analysis and wrote the initial manuscript. Coauthor validation and industry-practice review remain separately credited.",
    description: "Reconstructs US lead-pipe funding allocations and derives how resolving an unknown pipe can reduce expected funding under the existing rule. An audit-anchored allocation is developed to remove that discovery penalty within the stated model. The work combines mechanism derivation with reproducible allocation analysis; it does not claim a field-tested policy intervention. Preprint; not peer reviewed."
  },
  "research-arxiv-2609-05584": {
    contribution: "Sole author: developed the cross-sport mathematical analysis, compiled the appearance and substitution evidence, and prepared the reproducible analysis and manuscript.",
    description: "Combines cross-sport appearance records with substitution budgets and withdrawal timing to separate rule constraints from competition-specific behaviour. A decomposition relates playing-time allocation to sorting, timing and lineup composition, with explicit limits for substitution chains and player re-entry. It reports cross-competition tests rather than an unrestricted rule for every sport. Preprint; not peer reviewed."
  },
  "research-arxiv-2608-11228": {
    contribution: "Lead author: developed the study and methods, curated the data, implemented and checked the analyses, produced the visualisations and drafted the manuscript. Methodological input and editing by the coauthor remain credited.",
    description: "Uses a retrospective public-record cohort and appearance data from fifteen men's and women's football leagues to separate outcome-truncated minutes from exposure-dependent playing time. Recorded minutes track recent exposure, so dividing by them can attenuate the association being measured; a denominator-gradient check identifies when a local correction is needed. These are observational measurements, not causal injury predictions. Preprint; not peer reviewed."
  },
  "project-c2307a8588da6647db62d7b3": {
    contribution: "Coauthored the supervised CEA training report and contributed to reflectometry signal analysis using MATLAB. The report does not assign individual experimental tasks between its two authors.",
    description: "A supervised training report on reflectometry principles, density-profile reconstruction and heterodyne signal processing. While Tore Supra was stopped, a metal plate provided a controlled reflector for calibration, phase and Fourier analysis. The exercise linked beat frequency to reflector distance; it was not a live-plasma experiment or a claim of a new diagnostic technique."
  },
  "project-c1f062a755abff4388000db1": {
    contribution: "Analysed COMPASS disruption diagnostics with Python and prepared the supervised EMTRAIC training report as the named task participant.",
    description: "A supervised COMPASS tokamak training study using magnetic diagnostics to examine island behaviour and disruption asymmetry. Python supported signal analysis and visualisation. The density target was not reached, the poloidal island mode was unresolved and the saddle-coil asymmetry analysis was inconclusive. The report identifies additional diagnostics and field subtraction needed for a stronger analysis."
  },
  "project-701dc8ee8551735c9de9d27d": {
    contribution: "Carried out the experimental work and jointly developed the LabVIEW control and acquisition programs with Diogo Pereira Lopes and Pedro Ivo Teixeira Kercadio Sarmento, as explicitly credited in the report.",
    description: "An undergraduate Physics Laboratory III report at the University of Porto on LabVIEW instrument control and automatic data acquisition for electrical susceptibility and thermally stimulated current measurements. It integrates impedance, electrometer and temperature readings with configurable measurement and logging procedures. This is a supervised laboratory/software report, not a claim of independently established gains in measurement accuracy or efficiency."
  },
  "research-zenodo-22044877": {
    name: "Super-Precise Latency: How CPU Threading Affects High-Precision Latency, and an Industry-Wide Audit",
    authors: ["Gustavo Pedro Ricou", "Romaric Duvignau"],
    contribution: "Coauthor of the current manuscript on scheduler-sensitive latency measurement and benchmark auditing. The public manuscript does not specify the individual division of responsibilities.",
    description: "A manuscript in preparation investigating how a timestamping thread's wait for a CPU can distort sub-millisecond streaming-latency measurements. Controlled scheduling interventions and benchmark-tool audits distinguish late clock readings from discarded samples; kernel timestamps are evaluated as a way to exclude client-thread waits. Public code and the living manuscript are available; older archived artifact files are restricted. Not a published or peer-reviewed article."
  }
});
