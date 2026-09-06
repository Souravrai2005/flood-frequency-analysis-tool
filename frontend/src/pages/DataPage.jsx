import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";
import SeriesSelector from "../components/SeriesSelector.jsx";
import AnalysisButton from "../components/AnalysisButton.jsx";
import ResultCard from "../components/ResultCard.jsx";
import DatasetInfo from "../components/DatasetInfo.jsx";
import ResultsTable from "../components/ResultsTable.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { DATASET_CATALOG } from "../data/catalog.js";
import { useAnalysis } from "../hooks/useAnalysis.js";

const ANALYSIS_TYPES = [
  {
    id: "univariate",
    label: "Univariate peaks",
    datasetKey: "univariate",
    route: "/univariate",
  },
  {
    id: "pvd",
    label: "P–V–D events (bivariate)",
    datasetKey: "pvd",
    route: "/bivariate",
  },
  {
    id: "classification",
    label: "P–V–D events (classification)",
    datasetKey: "pvd",
    route: "/classification",
  },
];

export default function DataPage() {
  const navigate = useNavigate();
  const { series, setSeries, getSlot } = useAnalysis();
  const [analysisType, setAnalysisType] = useState("univariate");

  const selectedType = ANALYSIS_TYPES.find((item) => item.id === analysisType);
  const dataset = DATASET_CATALOG[series][selectedType.datasetKey];
  const catalog = DATASET_CATALOG[series];
  const univariateSlot = getSlot("univariate");
  const classificationSlot = getSlot("classification");
  const nValue =
    analysisType === "univariate"
      ? univariateSlot.data?.result?.n_peaks ?? "—"
      : classificationSlot.data?.result?.n_events ??
        getSlot("bivariate").data?.result?.n_events ??
        "—";

  const previewRows = useMemo(
    () =>
      dataset.columns.map((column) => ({
        name: column.name,
        meaning: column.meaning,
        sample: "Available after the analysis service reads the file",
      })),
    [dataset],
  );

  return (
    <PageShell
      title="Data"
      subtitle="Select the processed AMS or POT dataset that will feed an analysis"
    >
      <PageIntro title="Processed flood-event datasets" tags={["AMS", "POT", "P–V–D"]}>
        Event extraction was performed offline in MATLAB. This page selects
        which processed workbook the Python analysis will use. Raw Excel upload
        is not available in this phase and will be added later.
      </PageIntro>

      <div className="control-bar">
        <SeriesSelector value={series} onChange={setSeries} />
        <div className="field">
          <span className="field-label">Analysis dataset</span>
          <div className="seg-group seg-wrap" role="group" aria-label="Analysis dataset">
            {ANALYSIS_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={analysisType === item.id ? "seg active" : "seg"}
                onClick={() => setAnalysisType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="control-actions">
          <AnalysisButton
            onClick={() =>
              navigate(selectedType.route, { state: { series } })
            }
          >
            Continue to analysis
          </AnalysisButton>
        </div>
      </div>

      <div className="card-grid">
        <ResultCard title="Dataset information" kicker={catalog.short}>
          <DatasetInfo
            seriesLabel={catalog.label}
            file={dataset.file}
            path={dataset.path}
            purpose={dataset.purpose}
            nValue={nValue}
          />
          <p className="card-note">
            Observation and event counts appear here only after the analysis
            service has returned them for the selected series.
          </p>
        </ResultCard>
        <ResultCard title="Later: raw Excel upload" kicker="Not in this phase">
          <EmptyState title="Upload is disabled">
            A later phase will accept a raw daily discharge workbook. For now
            the tool uses only the processed files already stored under
            data/processed/.
          </EmptyState>
        </ResultCard>
      </div>

      <ResultCard title="Variable catalogue" kicker="Columns">
        <ResultsTable
          columns={[
            { key: "name", label: "Variable" },
            { key: "meaning", label: "Meaning" },
            { key: "sample", label: "Preview" },
          ]}
          rows={previewRows}
        />
      </ResultCard>

      <ResultCard title="Dataset preview" kicker="Observations">
        <EmptyState title="No preview rows loaded">
          Row-level values will be shown after the analysis service reads the
          selected processed file. The observation count above remains a
          placeholder until that response is available.
        </EmptyState>
      </ResultCard>
    </PageShell>
  );
}
