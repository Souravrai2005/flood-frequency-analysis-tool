import { useState } from "react";
import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";
import SeriesSelector from "../components/SeriesSelector.jsx";
import AnalysisButton from "../components/AnalysisButton.jsx";
import ResultCard from "../components/ResultCard.jsx";
import ResultsTable from "../components/ResultsTable.jsx";
import FigureGallery from "../components/FigureGallery.jsx";
import StatusBanner from "../components/StatusBanner.jsx";
import LoadingState from "../components/LoadingState.jsx";
import EmptyState from "../components/EmptyState.jsx";
import { useAnalysisRun } from "../hooks/useAnalysis.js";
import {
  asRecordArray,
  columnsFromRows,
  objectRows,
} from "../utils/display.js";

const KV_COLUMNS = [
  { key: "item", label: "Quantity" },
  { key: "value", label: "Value" },
];

const GOF_PREFERRED = [
  "Distribution",
  "LogLikelihood",
  "AIC",
  "BIC",
  "AIC_Rank",
  "BIC_Rank",
  "Mean_Rank",
  "KS Statistic",
  "KS p-value",
];

function selectedFromComparison(comparison) {
  return comparison[0] || null;
}

function parseGivenDischarge(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return {
      error: "Enter a given discharge in m³/s before running the analysis.",
    };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { error: "Given discharge must be a number in m³/s." };
  }
  if (value <= 0) {
    return { error: "Given discharge must be greater than 0 m³/s." };
  }
  return { value };
}

export default function UnivariatePage() {
  const { series, selectSeries, status, error, data, busy, run } =
    useAnalysisRun("univariate");
  const [dischargeText, setDischargeText] = useState("");
  const [inputError, setInputError] = useState("");
  const result = data?.result;
  const figures = data?.figures || [];
  const comparison = asRecordArray(result?.comparison);
  const selected = selectedFromComparison(comparison);
  const selectedName = selected?.Distribution;
  const fittedParams = result?.fitted_params?.[selectedName];
  const gofColumns = comparison.length
    ? columnsFromRows(comparison, GOF_PREFERRED)
    : GOF_PREFERRED.map((key) => ({ key, label: key }));
  const potComparison = asRecordArray(result?.pot_excess_comparison);
  const givenDischargeRows = objectRows(result?.return_period);
  const designRows = asRecordArray(result?.design_quantiles);

  function handleRun() {
    const parsed = parseGivenDischarge(dischargeText);
    if (parsed.error) {
      setInputError(parsed.error);
      return;
    }
    setInputError("");
    run({ given_discharge: parsed.value });
  }

  return (
    <PageShell
      title="Univariate analysis"
      subtitle="Marginal distributions and return periods for the selected peak series"
    >
      <PageIntro title="Univariate flood frequency analysis">
        The same univariate pipeline is applied to AMS or POT peaks. Fitting,
        model selection, and return periods are computed by the Python analysis
        service. This page displays the returned tables and figures.
      </PageIntro>

      <div className="control-bar">
        <SeriesSelector value={series} onChange={selectSeries} />
        <div className="field">
          <label className="field-label" htmlFor="given-discharge">
            Given Discharge
          </label>
          <div className="unit-input">
            <input
              id="given-discharge"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={dischargeText}
              disabled={busy}
              placeholder="e.g. 5000"
              onChange={(event) => {
                setDischargeText(event.target.value);
                if (inputError) {
                  setInputError("");
                }
              }}
            />
            <span>m³/s</span>
          </div>
          {inputError ? <p className="field-error">{inputError}</p> : (
            <p className="field-hint">
              Used for given discharge → return period. Design quantiles for T
              = 2, 5, 10, 25, 50 and 100 years are computed from the same fit.
            </p>
          )}
        </div>
        <div className="control-actions">
          <AnalysisButton onClick={handleRun} disabled={busy}>
            Run analysis
          </AnalysisButton>
        </div>
      </div>

      <StatusBanner
        status={status}
        series={series}
        analysisName="univariate analysis"
        error={error}
      />
      {status === "loading" ? (
        <LoadingState label="Running univariate analysis…" />
      ) : null}

      <div className="card-grid">
        <ResultCard title="Selected marginal distribution" kicker="Model">
          {selected ? (
            <ResultsTable
              columns={KV_COLUMNS}
              rows={[
                { item: "Distribution (combined AIC/BIC rank)", value: selected.Distribution },
                { item: "Mean rank", value: selected.Mean_Rank },
                { item: "AIC rank", value: selected.AIC_Rank },
                { item: "BIC rank", value: selected.BIC_Rank },
                { item: "AIC", value: selected.AIC },
                { item: "BIC", value: selected.BIC },
                { item: "Log-likelihood", value: selected.LogLikelihood },
                { item: "KS statistic", value: selected["KS Statistic"] },
                { item: "KS p-value", value: selected["KS p-value"] },
                { item: "Number of peaks", value: result?.n_peaks },
              ]}
            />
          ) : (
            <EmptyState>
              The selected distribution name and fit diagnostics will appear
              here from the analysis response.
            </EmptyState>
          )}
        </ResultCard>
        <ResultCard title="Distribution parameters" kicker="Fit">
          {fittedParams != null || result?.lognormal_floc0_params ? (
            <ResultsTable
              columns={KV_COLUMNS}
              rows={[
                ...(fittedParams != null
                  ? [
                      {
                        item: `${selectedName} parameters`,
                        value: fittedParams,
                      },
                    ]
                  : []),
                ...objectRows(result?.lognormal_floc0_params).map((row) => ({
                  item: `Lognormal (floc=0) ${row.item}`,
                  value: row.value,
                })),
              ]}
            />
          ) : (
            <EmptyState>
              Parameter estimates for the selected model will be listed here.
              No values are shown until an analysis has been returned.
            </EmptyState>
          )}
        </ResultCard>
      </div>

      {series === "POT" || result?.gpd_params ? (
        <ResultCard title="POT excess model" kicker="GPD">
          {result?.gpd_params ? (
            <ResultsTable
              columns={KV_COLUMNS}
              rows={[
                { item: "Threshold", value: result.threshold },
                { item: "POT events", value: result.n_pot_events },
                { item: "GPD shape (xi)", value: result.gpd_params.shape },
                { item: "GPD location", value: result.gpd_params.location },
                { item: "GPD scale", value: result.gpd_params.scale },
                { item: "Minimum excess", value: result.pot_excess_min },
                { item: "Maximum excess", value: result.pot_excess_max },
              ]}
            />
          ) : (
            <EmptyState>
              Excess-over-threshold and generalised Pareto results occupy this
              section when they are present in the response.
            </EmptyState>
          )}
        </ResultCard>
      ) : null}

      <ResultCard title="Goodness of fit" kicker="Candidate models">
        <ResultsTable
          columns={gofColumns}
          rows={comparison}
          emptyText="AIC, BIC and Kolmogorov–Smirnov statistics will be tabulated after the run."
        />
      </ResultCard>

      {potComparison.length ? (
        <ResultCard title="POT excess goodness of fit" kicker="Excess models">
          <ResultsTable
            columns={columnsFromRows(potComparison, GOF_PREFERRED)}
            rows={potComparison}
          />
        </ResultCard>
      ) : null}

      <ResultCard title="Given Discharge" kicker="Discharge → return period">
        {givenDischargeRows.length ? (
          <>
            <p className="card-note">
              Return period of the user-supplied discharge, computed by the
              analysis service from the existing Lognormal (floc=0) fit.
            </p>
            <ResultsTable columns={KV_COLUMNS} rows={givenDischargeRows} />
          </>
        ) : (
          <EmptyState>
            Enter a given discharge and run the analysis to see the
            corresponding return period.
          </EmptyState>
        )}
      </ResultCard>

      <ResultCard title="Return Period Design Quantiles" kicker="T → design peak">
        {designRows.length ? (
          <>
            <p className="card-note">
              Design peak discharge for T = 2, 5, 10, 25, 50 and 100 years,
              from the same fitted distribution used for the given-discharge
              return period.
            </p>
            <ResultsTable
              columns={columnsFromRows(designRows, [
                "Return Period (T)",
                "Design Peak",
              ])}
              rows={designRows}
            />
          </>
        ) : (
          <EmptyState>
            Design quantiles will appear here after the analysis service
            returns them.
          </EmptyState>
        )}
      </ResultCard>

      <ResultCard
        title="Figures"
        kicker={
          figures.length
            ? `${figures.length} returned PNG figure${figures.length === 1 ? "" : "s"}`
            : "Returned PNG figures"
        }
      >
        <FigureGallery figures={figures} />
      </ResultCard>
    </PageShell>
  );
}
