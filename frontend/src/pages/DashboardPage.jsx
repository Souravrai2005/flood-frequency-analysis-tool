import { Link } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";
import ResultCard from "../components/ResultCard.jsx";
import SeriesSelector from "../components/SeriesSelector.jsx";
import { ANALYSIS_MODULES, DATASET_CATALOG } from "../data/catalog.js";
import { useAnalysis } from "../hooks/useAnalysis.js";

const WORKFLOW = [
  {
    step: "1",
    title: "Processed events",
    text: "MATLAB extracts AMS and POT peak and P–V–D files into data/processed/.",
  },
  {
    step: "2",
    title: "Select series",
    text: "Choose AMS or POT. The same analysis methods are applied to either file.",
  },
  {
    step: "3",
    title: "Run analysis",
    text: "Python performs univariate, bivariate, or classification calculations.",
  },
  {
    step: "4",
    title: "Review results",
    text: "Tables and figures will be shown in the analysis pages and collected under Results.",
  },
];

export default function DashboardPage() {
  const { series, setSeries, getSlot } = useAnalysis();
  const univariate = getSlot("univariate");
  const bivariate = getSlot("bivariate");
  const classification = getSlot("classification");

  return (
    <PageShell
      title="Dashboard"
      subtitle="Flood Frequency Analysis Tool — workspace overview"
    >
      <PageIntro
        title="Flood Frequency Analysis Tool"
        tags={["Ukai", "Tapi basin", "B.Tech project"]}
      >
        A hydrologic design interface for flood extremes at Ukai. Annual-maximum
        and peaks-over-threshold series are analysed for peak, volume, and
        duration. The browser displays results; it does not fit distributions
        or copulas.
      </PageIntro>

      <div className="control-bar">
        <SeriesSelector value={series} onChange={setSeries} />
        <p className="field-hint">
          Selection is passed into the analysis pages. No metrics are computed
          on this dashboard.
        </p>
      </div>

      <div className="card-grid">
        <ResultCard title="Processed series" kicker="AMS / POT">
          <ul className="status-list">
            <li>
              <strong>AMS</strong>
              <span>
                {DATASET_CATALOG.AMS.univariate.file} and{" "}
                {DATASET_CATALOG.AMS.pvd.file}
              </span>
              <em>Ready as processed input</em>
            </li>
            <li>
              <strong>POT</strong>
              <span>
                {DATASET_CATALOG.POT.univariate.file} and{" "}
                {DATASET_CATALOG.POT.pvd.file}
              </span>
              <em>Ready as processed input</em>
            </li>
          </ul>
          <p className="card-note">
            Univariate: {univariate.status}. Bivariate: {bivariate.status}.
            Classification: {classification.status}. Observation counts appear
            after an analysis has been run.
          </p>
        </ResultCard>
        <ResultCard title="Workflow" kicker="How the tool is used">
          <ol className="workflow">
            {WORKFLOW.map((item) => (
              <li key={item.step}>
                <span>{item.step}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </ResultCard>
      </div>

      <ResultCard title="Analysis modules" kicker="Navigate">
        <div className="module-grid">
          {ANALYSIS_MODULES.map((module) => (
            <Link
              key={module.to}
              to={module.to}
              className={module.future ? "module-card future" : "module-card"}
            >
              <h3>
                {module.title}
                {module.future ? <span className="badge">Future</span> : null}
              </h3>
              <p>{module.text}</p>
            </Link>
          ))}
        </div>
      </ResultCard>

      <ResultCard title="Workspace pages" kicker="Data and results">
        <div className="module-grid">
          <Link to="/data" className="module-card">
            <h3>Data</h3>
            <p>
              Inspect the processed AMS or POT workbooks that feed the
              selected analysis.
            </p>
          </Link>
          <Link to="/results" className="module-card">
            <h3>Results</h3>
            <p>
              Consolidated tables and figures after analyses have been
              returned by the service.
            </p>
          </Link>
        </div>
      </ResultCard>
    </PageShell>
  );
}
