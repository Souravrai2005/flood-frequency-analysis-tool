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
  lookupRow,
  pickFigures,
  remainingFigures,
} from "../utils/display.js";

const PAIRS = [
  {
    key: "Peak_Volume",
    title: "Peak–Volume (P–V)",
    kicker: "P–V",
    resultsKey: "PV_results",
    rpKey: "pv_rp",
    figurePattern: /peak.?volume|peakvalue vs volume/i,
  },
  {
    key: "Peak_Duration",
    title: "Peak–Duration (P–D)",
    kicker: "P–D",
    resultsKey: "PD_results",
    rpKey: "pd_rp",
    figurePattern: /peak.?duration|peakvalue vs duration/i,
  },
  {
    key: "Volume_Duration",
    title: "Volume–Duration (V–D)",
    kicker: "V–D",
    resultsKey: "VD_results",
    rpKey: "vd_rp",
    figurePattern: /volume.?duration|volume vs duration/i,
  },
];

const MODEL_COLUMNS = [
  { key: "item", label: "Quantity" },
  { key: "value", label: "Value" },
];

const MARGINAL_PREFERRED = [
  "Distribution",
  "LogLikelihood",
  "AIC",
  "BIC",
  "AD_Statistic",
  "AD_Pass_5pct",
  "AIC_Rank",
  "BIC_Rank",
  "Mean_Rank",
];

const COPULA_PREFERRED = [
  "Copula",
  "Kendall_tau",
  "Parameter",
  "LogLikelihood",
  "AIC",
  "BIC",
  "NumParameters",
  "AIC_Rank",
  "BIC_Rank",
  "Mean_Rank",
];

const RP_PREFERRED = ["Return Period (T)", "Joint OR (T_or)", "Joint AND (T_and)"];

function pairModelRows(selected, rankedRow) {
  if (!selected && !rankedRow) {
    return [];
  }
  const tau =
    selected?.tau ??
    selected?.kendall_tau ??
    rankedRow?.Kendall_tau ??
    rankedRow?.["Kendall's tau"] ??
    rankedRow?.tau;
  return [
    { item: "Selected copula", value: selected?.name ?? rankedRow?.Copula },
    { item: "Kendall's tau", value: tau },
    { item: "AIC", value: rankedRow?.AIC },
    { item: "BIC", value: rankedRow?.BIC },
    {
      item: "Model information",
      value: selected?.parameter ?? rankedRow?.Parameter,
    },
  ];
}

function PairSection({ spec, result, figures }) {
  const selected = result?.selected_copulas?.[spec.key];
  const ranked = asRecordArray(result?.[spec.resultsKey]);
  const rankedRow = selected?.name
    ? lookupRow(ranked, "Copula", selected.name)
    : ranked[0];
  const rpRows = asRecordArray(result?.[spec.rpKey]);
  const pairFigures = pickFigures(figures, spec.figurePattern);

  return (
    <ResultCard title={spec.title} kicker={spec.kicker}>
      <div className="split-grid">
        <div>
          <h3 className="inner-title">Selected copula and diagnostics</h3>
          {selected || rankedRow ? (
            <ResultsTable
              columns={MODEL_COLUMNS}
              rows={pairModelRows(selected, rankedRow)}
            />
          ) : (
            <EmptyState>
              Selected copula, Kendall's tau, AIC and BIC will appear here
              when they are present in the response.
            </EmptyState>
          )}
        </div>
        <div>
          <h3 className="inner-title">Joint return periods</h3>
          <ResultsTable
            columns={
              rpRows.length
                ? columnsFromRows(rpRows, RP_PREFERRED)
                : RP_PREFERRED.map((key) => ({ key, label: key }))
            }
            rows={rpRows}
            emptyText="AND/OR return periods will appear here from the analysis response."
          />
        </div>
      </div>
      {ranked.length ? (
        <div className="gof-block">
          <h3 className="inner-title">Copula ranking</h3>
          <ResultsTable
            columns={columnsFromRows(ranked, COPULA_PREFERRED)}
            rows={ranked}
          />
        </div>
      ) : null}
      <FigureGallery
        figures={pairFigures}
        emptyTitle="No pair figures returned"
        emptyText="PNG figures for this pair will appear here when included in the response."
      />
    </ResultCard>
  );
}

export default function BivariatePage() {
  const { series, selectSeries, status, error, data, busy, run } =
    useAnalysisRun("bivariate");
  const result = data?.result;
  const figures = data?.figures || [];
  const usedFigures = PAIRS.flatMap((spec) =>
    pickFigures(figures, spec.figurePattern),
  );
  const otherFigures = remainingFigures(figures, usedFigures);

  const peakRows = asRecordArray(result?.peak_results);
  const volumeRows = asRecordArray(result?.volume_results);
  const durationRows = asRecordArray(result?.duration_results);
  const selectedMarginals = result?.selected_marginals;

  return (
    <PageShell
      title="Bivariate analysis"
      subtitle="Copula models for peak, volume, and duration pairs"
    >
      <PageIntro title="Bivariate copula analysis">
        One bivariate methodology is applied to either the AMS or the POT
        P–V–D dataset. Marginal selection, copula ranking, and AND/OR return
        periods are produced by the Python layer. This page only displays the
        returned results.
      </PageIntro>

      <div className="control-bar">
        <SeriesSelector value={series} onChange={selectSeries} />
        <div className="control-actions">
          <AnalysisButton onClick={run} disabled={busy}>
            Run analysis
          </AnalysisButton>
        </div>
      </div>

      <StatusBanner
        status={status}
        series={series}
        analysisName="bivariate analysis"
        error={error}
      />
      {status === "loading" ? (
        <LoadingState label="Running bivariate analysis. This may take several minutes…" />
      ) : null}

      <ResultCard title="Marginal distributions" kicker="Peak, volume, duration">
        {selectedMarginals ? (
          <ResultsTable
            columns={[
              { key: "variable", label: "Variable" },
              { key: "name", label: "Selected model" },
              { key: "parameters", label: "Parameters" },
            ]}
            rows={["Peak", "Volume", "Duration"].map((variable) => ({
              variable,
              name: selectedMarginals[variable]?.name,
              parameters: selectedMarginals[variable]?.parameters,
            }))}
          />
        ) : (
          <EmptyState>
            Selected marginal models will be shown here after the analysis
            response is received.
          </EmptyState>
        )}
        {peakRows.length ? (
          <>
            <h3 className="inner-title">Peak candidates</h3>
            <ResultsTable
              columns={columnsFromRows(peakRows, MARGINAL_PREFERRED).filter(
                (column) => column.key !== "Parameters",
              )}
              rows={peakRows}
            />
          </>
        ) : null}
        {volumeRows.length ? (
          <>
            <h3 className="inner-title">Volume candidates</h3>
            <ResultsTable
              columns={columnsFromRows(volumeRows, MARGINAL_PREFERRED).filter(
                (column) => column.key !== "Parameters",
              )}
              rows={volumeRows}
            />
          </>
        ) : null}
        {durationRows.length ? (
          <>
            <h3 className="inner-title">Duration candidates</h3>
            <ResultsTable
              columns={columnsFromRows(durationRows, MARGINAL_PREFERRED).filter(
                (column) => column.key !== "Parameters",
              )}
              rows={durationRows}
            />
          </>
        ) : null}
      </ResultCard>

      {PAIRS.map((spec) => (
        <PairSection
          key={spec.key}
          spec={spec}
          result={result}
          figures={figures}
        />
      ))}

      <ResultCard title="Exploratory figures" kicker="P–V–D">
        <FigureGallery figures={otherFigures} />
      </ResultCard>
    </PageShell>
  );
}
