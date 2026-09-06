import { Link } from "react-router-dom";
import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";
import ResultCard from "../components/ResultCard.jsx";
import ResultsTable from "../components/ResultsTable.jsx";
import FigureGallery from "../components/FigureGallery.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Scatter3D from "../components/Scatter3D.jsx";
import { useAnalysis } from "../hooks/useAnalysis.js";
import {
  asRecordArray,
  columnsFromRows,
  lookupRow,
  objectRows,
} from "../utils/display.js";

const PAIR_KEYS = [
  { key: "Peak_Volume", label: "Peak–Volume", resultsKey: "PV_results", rpKey: "pv_rp" },
  { key: "Peak_Duration", label: "Peak–Duration", resultsKey: "PD_results", rpKey: "pd_rp" },
  { key: "Volume_Duration", label: "Volume–Duration", resultsKey: "VD_results", rpKey: "vd_rp" },
];

export default function ResultsPage() {
  const { series, getSlot } = useAnalysis();
  const univariate = getSlot("univariate");
  const bivariate = getSlot("bivariate");
  const classification = getSlot("classification");
  const uniResult = univariate.data?.result;
  const biResult = bivariate.data?.result;
  const classResult = classification.data?.result;
  const hasAny =
    univariate.data || bivariate.data || classification.data;

  const uniComparison = asRecordArray(uniResult?.comparison);
  const selectedUni = uniComparison[0];
  const classSummary = asRecordArray(classResult?.summary);
  const classEvents = asRecordArray(classResult?.events);
  const designRows = asRecordArray(uniResult?.design_quantiles);

  const copulaRows = PAIR_KEYS.map((pair) => {
    const selected = biResult?.selected_copulas?.[pair.key];
    const ranked = lookupRow(
      asRecordArray(biResult?.[pair.resultsKey]),
      "Copula",
      selected?.name,
    );
    return {
      pair: pair.label,
      copula: selected?.name,
      tau:
        selected?.tau ??
        ranked?.Kendall_tau ??
        ranked?.["Kendall's tau"] ??
        ranked?.tau,
      aic: ranked?.AIC,
      bic: ranked?.BIC,
    };
  }).filter((row) => row.copula || row.aic != null);

  return (
    <PageShell
      title="Results"
      subtitle="Consolidated outputs after analyses have been run"
    >
      <PageIntro title="Analysis results">
        This page shows results already returned for the current AMS/POT
        selection. It does not rerun the analysis service.
      </PageIntro>

      {!hasAny ? (
        <EmptyState title="No analysis results available. Run an analysis to view results.">
          Use the univariate, bivariate, or classification pages to run an
          analysis. Results stay available while you navigate this session.
        </EmptyState>
      ) : null}

      <div className="inline-links">
        <Link to="/univariate">Univariate</Link>
        <Link to="/bivariate">Bivariate</Link>
        <Link to="/classification">Classification</Link>
      </div>

      <ResultCard title="Analysis summary" kicker="Overview">
        <ResultsTable
          columns={[
            { key: "item", label: "Quantity" },
            { key: "value", label: "Value" },
          ]}
          rows={[
            { item: "Selected series", value: series },
            { item: "Univariate", value: univariate.status },
            { item: "Bivariate", value: bivariate.status },
            { item: "Classification", value: classification.status },
            { item: "Univariate peaks", value: uniResult?.n_peaks },
            { item: "Bivariate events", value: biResult?.n_events },
            { item: "Classified events", value: classResult?.n_events },
          ]}
        />
      </ResultCard>

      <ResultCard title="Selected marginal distributions" kicker="Univariate / bivariate">
        {selectedUni || biResult?.selected_marginals ? (
          <ResultsTable
            columns={[
              { key: "variable", label: "Variable" },
              { key: "model", label: "Selected model" },
              { key: "note", label: "Notes" },
            ]}
            rows={[
              ...(selectedUni
                ? [
                    {
                      variable: "Peak (univariate)",
                      model: selectedUni.Distribution,
                      note: selectedUni.Mean_Rank,
                    },
                  ]
                : []),
              ...(biResult?.selected_marginals
                ? ["Peak", "Volume", "Duration"].map((variable) => ({
                    variable: `${variable} (bivariate)`,
                    model: biResult.selected_marginals[variable]?.name,
                    note: biResult.selected_marginals[variable]?.parameters,
                  }))
                : []),
            ]}
          />
        ) : (
          <EmptyState>
            Selected models will appear here after univariate or bivariate
            analysis has been run for {series}.
          </EmptyState>
        )}
      </ResultCard>

      <ResultCard title="Bivariate copula selections" kicker="P–V, P–D, V–D">
        <ResultsTable
          columns={[
            { key: "pair", label: "Pair" },
            { key: "copula", label: "Selected copula" },
            { key: "tau", label: "Kendall's tau" },
            { key: "aic", label: "AIC" },
            { key: "bic", label: "BIC" },
          ]}
          rows={copulaRows}
          emptyText="Run bivariate analysis to populate copula selections."
        />
      </ResultCard>

      <ResultCard title="Goodness of fit" kicker="Information criteria">
        {uniComparison.length ? (
          <ResultsTable
            columns={columnsFromRows(uniComparison, [
              "Distribution",
              "LogLikelihood",
              "AIC",
              "BIC",
              "AIC_Rank",
              "BIC_Rank",
              "Mean_Rank",
              "KS Statistic",
              "KS p-value",
            ])}
            rows={uniComparison}
          />
        ) : (
          <EmptyState>
            AIC, BIC and other diagnostics from the last univariate run will
            appear here.
          </EmptyState>
        )}
      </ResultCard>

      <ResultCard title="Return-period results" kicker="Returned values">
        {uniResult?.return_period ? (
          <>
            <h3 className="inner-title">Given Discharge → return period</h3>
            <ResultsTable
              columns={[
                { key: "item", label: "Quantity" },
                { key: "value", label: "Value" },
              ]}
              rows={objectRows(uniResult.return_period)}
            />
          </>
        ) : null}
        {designRows.length ? (
          <>
            <h3 className="inner-title">Return Period Design Quantiles</h3>
            <ResultsTable
              columns={columnsFromRows(designRows, [
                "Return Period (T)",
                "Design Peak",
              ])}
              rows={designRows}
            />
          </>
        ) : null}
        {PAIR_KEYS.map((pair) => {
          const rows = asRecordArray(biResult?.[pair.rpKey]);
          if (!rows.length) {
            return null;
          }
          return (
            <div key={pair.key}>
              <h3 className="inner-title">{pair.label}</h3>
              <ResultsTable
                columns={columnsFromRows(rows, [
                  "Return Period (T)",
                  "Joint OR (T_or)",
                  "Joint AND (T_and)",
                ])}
                rows={rows}
              />
            </div>
          );
        })}
        {!uniResult?.return_period &&
        !designRows.length &&
        !PAIR_KEYS.some((pair) => asRecordArray(biResult?.[pair.rpKey]).length) ? (
          <EmptyState>
            Return-period tables will appear here after univariate or bivariate
            results have been returned.
          </EmptyState>
        ) : null}
      </ResultCard>

      <ResultCard title="Flood classification" kicker="P–V–D types">
        {classSummary.length ? (
          <ResultsTable
            columns={columnsFromRows(classSummary, [
              "Flood Type",
              "Number of Events",
              "Percentage (%)",
            ])}
            rows={classSummary}
          />
        ) : (
          <EmptyState>
            Type counts and the dominant class will be summarised here after
            classification has been returned.
          </EmptyState>
        )}
        {classEvents.length ? (
          <>
            <h3 className="inner-title">3D Flood Characteristic Space</h3>
            <p className="card-note">
              Each point represents a flood event positioned by peak discharge,
              flood volume, and flood duration.
            </p>
            <Scatter3D events={classEvents} />
          </>
        ) : null}
      </ResultCard>

      <ResultCard title="Generated figures" kicker="From the analysis service">
        <h3 className="inner-title">Univariate</h3>
        <FigureGallery figures={univariate.data?.figures || []} />
        <h3 className="inner-title">Bivariate</h3>
        <FigureGallery figures={bivariate.data?.figures || []} />
        <h3 className="inner-title">Classification</h3>
        <FigureGallery figures={classification.data?.figures || []} />
      </ResultCard>
    </PageShell>
  );
}
