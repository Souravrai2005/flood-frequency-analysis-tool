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
import LoadingState from "../components/LoadingState.jsx";
import { DATASET_CATALOG } from "../data/catalog.js";
import { useAnalysis } from "../hooks/useAnalysis.js";
import { uploadRawExcel } from "../services/api.js";
import { columnsFromRows, formatValue } from "../utils/display.js";

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls"];
const ACCEPTED_HINT = ".xlsx (Excel). .xls is accepted if the server can open it.";

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

function fileExtension(name) {
  const text = String(name || "");
  const index = text.lastIndexOf(".");
  if (index < 0) {
    return "";
  }
  return text.slice(index).toLowerCase();
}

function formatCatchment(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }
  const shown = Number.isInteger(number) ? String(number) : String(number);
  return `${shown} km²`;
}

function detectedColumnRows(detected) {
  if (!detected || typeof detected !== "object") {
    return [];
  }
  return [
    { role: "Year", column: detected.year },
    { role: "Month", column: detected.month },
    { role: "Day", column: detected.day },
    { role: "Date", column: detected.date },
    { role: "Discharge / flow", column: detected.discharge },
  ];
}

function missingValueRows(missing) {
  if (!missing || typeof missing !== "object") {
    return [];
  }
  return Object.entries(missing).map(([column, count]) => ({
    column,
    missing: count,
  }));
}

export default function DataPage() {
  const navigate = useNavigate();
  const { series, setSeries, getSlot } = useAnalysis();
  const [analysisType, setAnalysisType] = useState("univariate");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

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
      })),
    [dataset],
  );

  const validation = uploadResult?.validation;
  const rawPreview = Array.isArray(validation?.preview) ? validation.preview : [];
  const previewColumns = columnsFromRows(rawPreview);
  const catchmentLabel = formatCatchment(validation?.catchment_area);
  const busy = uploadStatus === "loading";

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadStatus("idle");
    setUploadError("");
    setUploadResult(null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setUploadStatus("error");
      setUploadError("Please choose an Excel file to upload.");
      setUploadResult(null);
      return;
    }

    const extension = fileExtension(selectedFile.name);
    if (!ACCEPTED_EXTENSIONS.includes(extension)) {
      setUploadStatus("error");
      setUploadError(
        "Only Excel workbooks are accepted (.xlsx or .xls). Please choose an Excel file.",
      );
      setUploadResult(null);
      return;
    }

    if (selectedFile.size === 0) {
      setUploadStatus("error");
      setUploadError("The selected file is empty.");
      setUploadResult(null);
      return;
    }

    setUploadStatus("loading");
    setUploadError("");
    setUploadResult(null);

    try {
      const payload = await uploadRawExcel(selectedFile);
      setUploadResult(payload);
      setUploadStatus("success");
    } catch (error) {
      setUploadStatus("error");
      setUploadResult(null);
      setUploadError(
        error instanceof Error
          ? error.message
          : "The uploaded workbook could not be validated.",
      );
    }
  }

  return (
    <PageShell
      title="Data"
      subtitle="Processed AMS/POT datasets and raw Excel upload validation"
    >
      <PageIntro title="Datasets" tags={["AMS", "POT", "Raw Excel"]}>
        Analysis still uses the existing processed AMS and POT workbooks.
        Raw Excel upload in this version only receives and validates a
        hydrological workbook. It does not extract events or replace processed
        files.
      </PageIntro>

      <ResultCard title="Processed Dataset" kicker="AMS / POT — used by analysis">
        <p className="card-note">
          These are the MATLAB-extracted files already stored under
          data/processed/. Univariate, bivariate, and classification continue
          to read them. Uploading a raw file does not overwrite them.
        </p>
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

        <div className="card-grid data-processed-grid">
          <div>
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
          </div>
          <div>
            <h3 className="inner-heading">Variable catalogue</h3>
            <ResultsTable
              columns={[
                { key: "name", label: "Variable" },
                { key: "meaning", label: "Meaning" },
              ]}
              rows={previewRows}
              emptyTitle="No processed columns listed"
              emptyText="The processed-file catalogue could not be shown."
            />
          </div>
        </div>
      </ResultCard>

      <ResultCard title="Upload Raw Excel Dataset" kicker="V2.1 — validate only">
        <p className="card-note">
          Choose a raw daily discharge workbook. The server opens the first
          worksheet and checks that date and discharge columns can be identified.
          No AMS/POT conversion is performed in this version.
        </p>

        <div className="upload-bar">
          <div className="field file-picker">
            <label className="field-label" htmlFor="raw-excel-file">
              Raw Excel file
            </label>
            <input
              id="raw-excel-file"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={busy}
              onChange={handleFileChange}
            />
            <p className="field-hint">Accepted files: {ACCEPTED_HINT}</p>
            <p className="file-meta">
              Selected file:{" "}
              <strong>
                {selectedFile?.name || "No file chosen"}
              </strong>
            </p>
          </div>
          <div className="control-actions">
            <AnalysisButton onClick={handleUpload} disabled={busy}>
              {busy ? "Validating…" : "Upload / Validate"}
            </AnalysisButton>
          </div>
        </div>

        {uploadStatus === "idle" ? (
          <div className="status-banner status-idle" role="status">
            <span className="status-dot" />
            <span>
              Choose an Excel workbook and click Upload / Validate. The processed
              AMS and POT files stay unchanged.
            </span>
          </div>
        ) : null}

        {busy ? <LoadingState label="Validating the uploaded workbook…" /> : null}

        {uploadStatus === "error" ? (
          <div className="status-banner status-error" role="alert">
            <span className="status-dot" />
            <span>{uploadError || "The uploaded workbook could not be validated."}</span>
          </div>
        ) : null}

        {uploadStatus === "success" && validation ? (
          <>
            <div className="status-banner status-success" role="status">
              <span className="status-dot" />
              <span>
                {validation.message ||
                  "Workbook opened successfully. Date and discharge columns were identified."}
              </span>
            </div>

            <dl className="info-grid">
              <div>
                <dt>Validation status</dt>
                <dd>{validation.valid ? "Valid" : "Invalid"}</dd>
              </div>
              <div>
                <dt>Filename</dt>
                <dd>{uploadResult.filename || selectedFile?.name || "—"}</dd>
              </div>
              <div>
                <dt>Worksheet</dt>
                <dd>{validation.sheet_name || "—"}</dd>
              </div>
              <div>
                <dt>Rows</dt>
                <dd>{formatValue(validation.rows)}</dd>
              </div>
              <div>
                <dt>Catchment area</dt>
                <dd>
                  {catchmentLabel ||
                    "Not detected from the first worksheet name"}
                </dd>
              </div>
              <div>
                <dt>Ukai raw structure</dt>
                <dd>
                  {validation.matches_ukai_raw_structure
                    ? "Yes — Year, Month, Day, Q(m3/s), numeric sheet name"
                    : "No — columns were identified, but this is not the exact Ukai raw layout"}
                </dd>
              </div>
              <div className="info-span">
                <dt>Workbook columns</dt>
                <dd>{formatValue(validation.columns)}</dd>
              </div>
            </dl>

            <h3 className="inner-heading">Detected columns</h3>
            <ResultsTable
              columns={[
                { key: "role", label: "Role" },
                { key: "column", label: "Column name" },
              ]}
              rows={detectedColumnRows(validation.detected_columns)}
              emptyTitle="No columns detected"
              emptyText="The server did not return detected column names."
            />

            <h3 className="inner-heading">Missing values</h3>
            <ResultsTable
              columns={[
                { key: "column", label: "Column" },
                { key: "missing", label: "Missing count" },
              ]}
              rows={missingValueRows(validation.missing_values)}
              emptyTitle="No missing-value summary"
              emptyText="The server did not return missing-value counts."
            />

            <h3 className="inner-heading">Preview (first rows from the workbook)</h3>
            {rawPreview.length ? (
              <ResultsTable
                columns={previewColumns}
                rows={rawPreview}
                emptyTitle="No preview rows"
                emptyText="The server did not return a data preview."
              />
            ) : (
              <EmptyState title="No preview rows">
                The server validated the workbook but did not return sample rows.
              </EmptyState>
            )}
          </>
        ) : null}

        {uploadStatus !== "success" && !busy ? (
          <EmptyState title="No uploaded raw dataset yet">
            After a successful validation, the filename, worksheet, detected
            columns, catchment area, missing values, and a short real preview
            will appear here. This is separate from the processed AMS/POT
            datasets above.
          </EmptyState>
        ) : null}
      </ResultCard>
    </PageShell>
  );
}
