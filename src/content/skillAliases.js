/**
 * Reviewed aliases from the local/live portfolio inventory. Array values split
 * compound labels only when each named capability was already in the source.
 * Narrow tool/action labels are grouped explicitly; unknown skills survive.
 */
export const SKILL_ALIASES = Object.freeze({
  "React.js": ["React"], "ReactJS": ["React"], "React.js (Hooks, Redux)": ["React", "Redux"],
  "NodeJS": ["Node.js"], "Node JS": ["Node.js"], "VueJS": ["Vue.js"],
  "JavaScript (ES6+)": ["JavaScript"], "Advanced Python Development": ["Python"],
  "MatLab": ["MATLAB"], "Matlab": ["MATLAB"], "Jupyter Notebook": ["Jupyter"],
  "G": ["G Programming Language (LabVIEW)"], "NI LabVIEW": ["LabVIEW"],
  "Lyx": ["LyX"], "JIRA": ["Jira"], "Bootstrap (Framework)": ["Bootstrap"],
  "Bootstrap Vue": ["BootstrapVue"], "HTML5": ["HTML"], "CSS3": ["CSS"],
  "Amazon Web Services (AWS)": ["AWS"],
  "Cloud Computing (Google Cloud Platform - GCP)": ["Cloud Computing", "Google Cloud"],
  "Google Cloud Platform (GCP)": ["Google Cloud"],
  "Containerization (Docker, Kubernetes)": ["Containerization", "Docker", "Kubernetes"],
  "Docker Products": ["Docker"], "DevOps Practices": ["DevOps"],
  "CI/CD Pipelines": ["CI/CD"], "Continuous Integration/Continuous Deployment (CI/CD)": ["CI/CD"],
  "Infrastructure as Code (IaC)": ["Infrastructure as Code"],
  "Agile (Scrum)": ["Agile", "Scrum"], "Agile Methodologies (Scrum)": ["Agile", "Scrum"],
  "Agile Methodologies": ["Agile"], "Code Reviews": ["Code Review"],
  "Integration Tests": ["Integration Testing"], "TDD (Test-Driven Development)": ["Test-Driven Development"],
  "Test-Driven Development (TDD)": ["Test-Driven Development"],
  "Behavior-Driven Development (BDD)": ["Behavior-Driven Development"],
  "BDD with Karate Testing Framework": ["Behavior-Driven Development", "Karate"],
  "Unit Testing (JUnit, Mockito)": ["Unit Testing", "JUnit", "Mockito"],
  "Unit Testing (Jest, Mocha, Chai)": ["Unit Testing", "Jest", "Mocha", "Chai"],
  "API Development and Integration": ["API Development", "API Integration"],
  "RESTful API Development": ["REST APIs"], "RESTful APIs": ["REST APIs"],
  "RESTful Web Services": ["REST APIs"], "Microservices Architecture": ["Microservices"],
  "Java Spring": ["Spring Framework"], "Eureka Discovery Service": ["Service Discovery"],
  "Service Registration": ["Service Discovery"], "Serverless Architectures": ["Serverless Architecture"],
  "ORM (Hibernate, JPA)": ["ORM", "Hibernate", "JPA"],
  "Object-Oriented Programming (OOP)": ["Object-Oriented Programming"],
  "JSON Web Tokens (JWT)": ["JWT"], "JWT Authentication": ["JWT"],
  "Authentication (JWT, OAuth)": ["User Authentication", "JWT", "OAuth"],
  "OAuth2": ["OAuth 2.0"], "Caching Mechanisms": ["Caching"],
  "Data Analytics": ["Data Analysis"], "Data Analysis and Visualization": ["Data Analysis", "Data Visualization"],
  "Dashboard Development": ["Data Visualization"], "Excel Dashboards": ["Microsoft Excel", "Data Visualization"],
  "Matplotlib": ["Data Visualization"], "Seaborn": ["Data Visualization"],
  "Advanced Statistical Techniques": ["Statistics"], "Machine Learning Basics": ["Machine Learning"],
  "Artificial Intelligence Basics": ["Artificial Intelligence"],
  "Big Data Technologies (Hadoop, Spark)": ["Big Data", "Hadoop", "Spark"],
  "SQL Scripting": ["SQL"], "Scientific Programming": ["Scientific Computing"],
  "Research": ["Scientific Research"], "Research Methodologies": ["Scientific Research"],
  "Research and Development (R&D)": ["Research and Development"],
  "Numerical Analysis": ["Numerical Methods"], "Numerical Simulations": ["Numerical Modeling"],
  "Simulation and Modeling": ["Simulation", "Mathematical Modeling"],
  "ODEs": ["Ordinary Differential Equations"], "PDEs": ["Partial Differential Equations"],
  "Fast Fourier Transform": ["Fast Fourier Transform (FFT)"],
  "Tokamak Operations": ["Tokamak Operation"], "Tore Supra Tokamak": ["Tokamak Operation"],
  "Greenwald Limit Analysis": ["Plasma Physics"], "Greenwald Limit Studies": ["Plasma Physics"],
  "Density Profile Reconstruction": ["Plasma Diagnostics"], "Phase Shift Analysis": ["Signal Processing"],
  "Magnetic Island Analysis": ["Magnetohydrodynamics (MHD)"],
  "Problem-Solving": ["Problem Solving"], "Mentorship": ["Mentoring"],
  "Academic Mentorship": ["Mentoring"], "Leadership and Mentoring": ["Leadership", "Mentoring"],
  "Academic Tutoring": ["Tutoring"], "Educational Material Development": ["Teaching Materials"],
  "Study Material Creation": ["Teaching Materials"],
  "Effective Communication": ["Communication"], "Communication Skills": ["Communication"],
  "Research Presentation": ["Scientific Communication"], "Technical Reporting and Presentation": ["Technical Writing", "Presentation Skills"],
  "Research Reporting": ["Scientific Writing"], "Technical Documentation": ["Documentation"],
  "Software Documentation": ["Documentation"], "System Documentation": ["Documentation"],
  "Technical Troubleshooting": ["Troubleshooting"], "Debugging and Troubleshooting": ["Debugging", "Troubleshooting"],
  "Performance Enhancement": ["Performance Optimization"], "System Optimization": ["Performance Optimization"],
  "System Performance Tuning": ["Performance Optimization"], "Web Performance Optimization": ["Performance Optimization"],
  "Automated Task Handling": ["Automation"], "Script Execution": ["Automation"],
  "In-Browser Event Simulation": ["Event Handling"], "Manifest V3": ["Chrome Extensions"],
  ".env Configuration": ["Environment Configuration"], "Environment Setup": ["Environment Configuration"],
  "Development Server Setup": ["Environment Configuration"], "Local Development Environment Setup": ["Environment Configuration"],
  "Production Build Scripts": ["Build Tooling"], "Ubuntu Server": ["Linux"],
  "ZFS Pool Management": ["ZFS"], "ZFS Storage": ["ZFS"],
  "Version Control (Git)": ["Git"], "Version Control (Git, GitHub, GitLab)": ["Git", "GitHub", "GitLab"],
  "Responsive Web Design": ["Responsive Design"], "User Interface (UI) Design": ["User Interface Design"],
  "Graphic Design Tools (Adobe Photoshop, Illustrator)": ["Graphic Design", "Adobe Photoshop", "Adobe Illustrator"],
  "Graphical Design": ["Graphic Design"],
  "Project Management Tools (JIRA, Trello)": ["Jira", "Trello"],
  "Virtualization (VMware, VirtualBox)": ["Virtualization", "VMware", "VirtualBox"],
  "Mobile Application Development (Android, iOS)": ["Mobile Development", "Android", "iOS"],
  "Web Hosting (Awardspace)": ["Web Hosting"],
  "Git / Version Control": ["Git"], "Git Workflows": ["Git"], "Version Control": ["Git"],
  "REST API Development": ["REST APIs"], "Agile / Scrum": ["Agile"], "Scrum": ["Agile"],
  "React Hooks": ["React"], "React Router": ["React"], "Redux": ["React"],
  "Vue Router": ["Vue.js"], "Vuex": ["Vue.js"], "Frontend Routing": ["Web Development"],
  "G Programming Language (LabVIEW)": ["LabVIEW"], "Docker Compose": ["Docker"],
  "HTTP Client Testing": ["Software Testing"], "Interactive Testing": ["Software Testing"],
  "Automated Testing": ["Software Testing"], "Contract Testing": ["Software Testing"],
  "Integration Testing": ["Software Testing"], "Unit Testing": ["Software Testing"],
  "JUnit": ["Software Testing"], "Jest": ["Software Testing"], "Mocha": ["Software Testing"],
  "Chai": ["Software Testing"], "Mockito": ["Software Testing"], "Karate": ["Software Testing"],
  "Karate Testing Framework": ["Software Testing"], "Selenium": ["Software Testing"],
  "Puppeteer": ["Browser Automation"], "Behavior-Driven Development": ["Software Testing"],
  "Advanced Data Analysis": ["Data Analysis"], "Quantitative Data Analysis": ["Data Analysis"],
  "Exploratory Data Analysis": ["Data Analysis"], "High-Dimensional Data Analysis": ["Data Analysis"],
  "Categorical Data Analysis": ["Data Analysis"], "Longitudinal Data Analysis": ["Data Analysis"],
  "Data Interpretation": ["Data Analysis"], "Advanced Quantitative Methods": ["Statistics"],
  "Advanced R Programming": ["R"], "R Programming": ["R"], "R Package Use": ["R"],
  "R Markdown": ["R"], "Apache Spark": ["Spark"],
  "NumPy": ["Scientific Computing"], "SciPy": ["Scientific Computing"],
  "Pandas": ["Data Analysis"], "Jupyter": ["Scientific Computing"],
  "Fourier Transform": ["Signal Processing"], "Fast Fourier Transform (FFT)": ["Signal Processing"],
  "Abel Transform": ["Signal Processing"],
  "Advanced Linear Models": ["Statistical Modeling"], "Advanced Regression Analysis": ["Statistical Modeling"],
  "Advanced Statistical Modelling": ["Statistical Modeling"], "Statistical Modelling": ["Statistical Modeling"],
  "Linear Regression": ["Statistical Modeling"], "Multiple Regression": ["Statistical Modeling"],
  "Regression Analysis": ["Statistical Modeling"], "Regression Modelling": ["Statistical Modeling"],
  "Generalised Linear Models": ["Statistical Modeling"], "Mixed-Effects Models": ["Statistical Modeling"],
  "Regression Diagnostics": ["Statistical Modeling"], "Residual Analysis": ["Statistical Modeling"],
  "Model Diagnostics": ["Statistical Modeling"], "Model Comparison": ["Statistical Modeling"],
  "Model Selection": ["Statistical Modeling"], "Model Interpretation": ["Statistical Modeling"],
  "Model Evaluation": ["Statistical Modeling"], "Predictive Modelling": ["Statistical Modeling"],
  "Advanced Multivariate Analysis": ["Statistics"], "Multivariate Analysis": ["Statistics"],
  "Multivariate Statistical Methods": ["Statistics"], "Applied Statistics": ["Statistics"],
  "Statistical Methods": ["Statistics"], "Statistical Inference": ["Statistics"],
  "Inferential Statistics": ["Statistics"], "Descriptive Statistics": ["Statistics"],
  "Confidence Interval Estimation": ["Statistics"], "Effect Size Estimation": ["Statistics"],
  "Parameter Estimation": ["Statistics"], "Correlation Analysis": ["Statistics"],
  "ANOVA": ["Statistics"], "Variance Analysis": ["Statistics"], "Hypothesis Testing": ["Statistics"],
  "Sampling Methods": ["Statistics"], "Repeated Measures Analysis": ["Statistical Modeling"],
  "Advanced Statistical Computing": ["Statistical Computing"], "Computational Statistics": ["Statistical Computing"],
  "Statistical Computing": ["Scientific Computing"], "Statistical Programming": ["Scientific Computing"],
  "Statistical Learning": ["Machine Learning"], "Classification Methods": ["Machine Learning"],
  "Supervised Classification": ["Machine Learning"], "Cluster Analysis": ["Machine Learning"],
  "Dimensionality Reduction": ["Machine Learning"], "Principal Component Analysis": ["Machine Learning"],
  "Cross-Validation": ["Statistical Modeling"], "Feature Engineering": ["Machine Learning"],
  "Time Series Forecasting": ["Time Series Analysis"], "Forecasting": ["Time Series Analysis"],
  "Data Science Foundations": ["Data Science"], "Applied Data Science": ["Data Science"],
  "Data Preparation": ["Data Cleaning"], "Data Wrangling": ["Data Cleaning"],
  "Data Transformation": ["Data Cleaning"], "Missing Data Handling": ["Data Cleaning"],
  "Data Quality Assessment": ["Data Management"], "Data Modelling": ["Data Modeling"],
  "Advanced Experimental Design": ["Experimental Design"], "Design of Experiments": ["Experimental Design"],
  "Academic Research": ["Scientific Research"], "Dissertation Research": ["Scientific Research"],
  "Quantitative Research": ["Scientific Research"], "Research Design": ["Scientific Research"],
  "Research Methodology": ["Scientific Research"], "Academic Writing": ["Scientific Writing"],
  "Scientific Reporting": ["Scientific Writing"], "Statistical Communication": ["Scientific Communication"],
  "Mathematical Modelling": ["Mathematical Modeling"], "Numerical Modeling": ["Numerical Methods"],
  "Numerical Simulation": ["Numerical Methods"],
  "Magnetic Diagnostics": ["Plasma Diagnostics"], "Reflectometry": ["Plasma Diagnostics"],
  "Radar Technology": ["Signal Processing"], "Plasma Turbulence": ["Plasma Physics"],
  "Magnetic Fusion": ["Plasma Physics"], "Advanced Diagnostics": ["Experimental Physics"],
  "High-Precision Measurement": ["Experimental Physics"], "Lab Equipment Maintenance": ["Experimental Physics"],
  "Electrical Susceptibility": ["Materials Science"], "Thermally Stimulated Currents": ["Materials Science"],
  "Impedance Analysis": ["Materials Science"], "Ceramics": ["Materials Science"], "Polarizable Films": ["Materials Science"],
  "Linear Algebra for Statistics": ["Linear Algebra"], "Mathematical Notation": ["Mathematics"],
  "Leadership & Mentoring": ["Leadership", "Mentoring"], "Team Leadership": ["Leadership"],
  "Technical Leadership": ["Leadership"], "Cross-Functional Team Leadership": ["Leadership"],
  "Technical Mentoring": ["Mentoring"], "Cross-Functional Collaboration": ["Collaboration"],
  "Interdisciplinary Collaboration": ["Collaboration"], "Collaborative Research": ["Collaboration"],
  "Team Collaboration": ["Collaboration"], "Collaborative Learning": ["Collaboration"],
  "Stakeholder Communication": ["Communication"], "Stakeholder Engagement": ["Communication"],
  "Public Speaking": ["Presentation Skills"], "Technical Presentation": ["Presentation Skills"],
  "Prioritisation": ["Time Management"], "Prioritization": ["Time Management"],
  "Data-Driven Decision-Making": ["Data-Driven Decision Making"],
  "Strategic Decision-Making": ["Strategic Planning"], "Vision Setting": ["Strategic Planning"],
  "Product Backlog Management": ["Agile"], "Sprint Planning": ["Agile"],
  "User Story Writing": ["Requirements Gathering"], "Customer Requirements Analysis": ["Requirements Gathering"],
  "Personalized Learning Plans": ["Tutoring"], "Exam Preparation": ["Tutoring"],
  "Innovative Teaching Methods": ["Tutoring"], "Student Engagement": ["Tutoring"],
  "Training Support": ["User Training"], "Problem Resolution": ["Problem Solving"],
  "Content Clarity Enhancement": ["Content Review"], "Content Verification": ["Content Review"],
  "Review Management": ["Web Development"], "Operational Efficiency": ["Process Improvement"],
  "DOM Manipulation": ["Web Development"], "Event Handling": ["Web Development"],
  "Form Handling": ["Web Development"], "Form Validation": ["Web Development"],
  "Image Handling": ["Web Development"], "Local Storage": ["Web Development"],
  "Filtering and Sorting": ["Web Development"], "Ride Booking": ["Web Development"],
  "CRUD Operations": ["API Development"], "Frontend-Backend Integration": ["Full-Stack Development"],
  "Component-Based Architecture": ["Software Architecture"], "System Architecture": ["Software Architecture"],
  "Enterprise Application Development": ["Software Development"],
  "Development Best Practices": ["Software Development"], "Software Prototyping": ["Software Development"],
  "HTTP/HTTPS": ["Web Development"], "AJAX": ["Web Development"], "Axios": ["Web Development"],
  "User Authentication": ["Authentication"], "JWT": ["Authentication"],
  "OAuth": ["Authentication"], "OAuth 2.0": ["Authentication"], "Session Management": ["Authentication"],
  "Object-Relational Mapping (ORM)": ["ORM"], "Hibernate": ["ORM"], "JPA": ["ORM"],
  "Spring Data": ["Spring Framework"], "Spring Data JPA": ["Spring Framework"],
  "Spring Security": ["Spring Framework"], "Spring Cloud Config": ["Spring Framework"],
  "Spring Cloud Sleuth": ["Observability"], "Sleuth": ["Observability"],
  "Zipkin": ["Observability"], "Zipkin Tracing": ["Observability"],
  "Hystrix Resiliency Patterns": ["Resilient Systems"], "High-Availability Systems": ["Resilient Systems"],
  "Service Scalability": ["Scalable Systems"], "Real-time Data Handling": ["Data Processing"],
  "File Services": ["File Management"], "Cloud Storage Solutions": ["Cloud Storage"],
  "MongoDB Atlas": ["MongoDB"], "Atlas": ["MongoDB"], "Mongoose ODM": ["MongoDB"],
  "Web Safety": ["Web Security"], "Security Best Practices": ["Web Security"],
  "Ethical Hacking": ["Security Testing"], "Penetration Testing": ["Security Testing"],
  "Network Support": ["Networking"], "Networking Concepts": ["Networking"],
  "Shell Scripting (Bash)": ["Bash"],
  "Sudoers Configuration": ["Linux"], "Linux Administration": ["Linux"],
  "Mobile Application Development": ["Mobile Development"],
  "User Interface Design": ["UI/UX Design"], "User Experience (UX) Design": ["UI/UX Design"],
  "UI/UX Collaboration": ["UI/UX Design"], "Sass": ["CSS"],
  "Webpack": ["Build Tooling"], "Maven": ["Build Tooling"]
});

// Thesis methods and interests use synonyms only, never the broader skills groups.
const RESEARCH_ALIASES = Object.freeze({
  "Multitask learning": ["Multi-task learning"], "Multi task learning": ["Multi-task learning"],
  "Multi-task learning": ["Multi-task learning"], "Scientific computing": ["Scientific computing"],
  "Statistics": ["Statistics"], "Hard parameter sharing": ["Hard parameter sharing"],
  "Matched single-task baselines": ["Matched single-task baselines"],
  "Gradient interference": ["Gradient interference"],
  "Transfer and gradient interference": ["Transfer and gradient interference"]
});

function key(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function catalogue(aliases) {
  const entries = Object.entries(aliases);
  const index = new Map(entries.map(([alias, canonical]) => [key(alias), canonical]));
  for (const canonical of entries.flatMap(([, labels]) => labels)) {
    if (!index.has(key(canonical))) index.set(key(canonical), [canonical]);
  }
  function expand(label, path = new Set()) {
    const labelKey = key(label);
    const targets = index.get(labelKey) || [label];
    if (targets.length === 1 && key(targets[0]) === labelKey) return targets;
    if (path.has(labelKey)) throw new Error(`Skill alias cycle at ${label}.`);
    const nextPath = new Set([...path, labelKey]);
    return targets.flatMap((target) => key(target) === labelKey ? [target] : expand(target, nextPath));
  }
  return new Map([...index.keys()].map((label) => [label, expand(label)]));
}

const SKILL_INDEX = catalogue(SKILL_ALIASES);
const RESEARCH_INDEX = catalogue(RESEARCH_ALIASES);

/**
 * Canonicalizes reviewed labels with stable, first-occurrence deduplication.
 * Unknown nonempty labels retain their wording; no capability allow-list exists.
 *
 * @param {unknown} value Candidate ordered string array.
 * @param {Map<string, string[]>} index Reviewed aliases to use.
 * @returns {string[]} Fresh normalized labels, preserving meaningful distinctions.
 */
function normalizeLabels(value, index) {
  const seen = new Set();
  const output = [];
  for (const label of Array.isArray(value) ? value : []) {
    if (typeof label !== "string" || !label.trim()) continue;
    for (const canonical of index.get(key(label)) || [label.trim()]) {
      if (!seen.has(key(canonical))) {
        seen.add(key(canonical));
        output.push(canonical);
      }
    }
  }
  return output;
}

/**
 * Normalizes reviewed skill aliases and subtopics; arbitrary new labels survive.
 *
 * @param {unknown} value Candidate ordered skills array.
 * @returns {string[]} Canonical labels, deduplicated in first-occurrence order.
 */
export function normalizeSkills(value) {
  return normalizeLabels(value, SKILL_INDEX);
}

/**
 * Applies synonym-only normalization to thesis methods and research interests.
 *
 * @param {unknown} value Candidate ordered research labels.
 * @returns {string[]} Fresh labels retaining meaningful thesis terminology.
 */
export function normalizeResearchLabels(value) {
  return normalizeLabels(value, RESEARCH_INDEX);
}
