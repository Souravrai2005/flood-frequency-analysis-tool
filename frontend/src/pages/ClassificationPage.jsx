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
import Scatter3D from "../components/Scatter3D.jsx";
import { useAnalysisRun } from "../hooks/useAnalysis.js";
import {
  asRecordArray,
  columnsFromRows,
  objectRows,
} from "../utils/display.js";

const SUMMARY_PREFERRED = [
  "Flood Type",
  "Number of Events",
  "Percentage (%)",
];

const EVENT_PREFERRED = [
  "Peakvalue",
  "Volume",
  "Duration",
  "Peak_Level",
  "Volume_Level",
  "Duration_Level",
  "Flood_Type",
];

export default function ClassificationPage() {
  const { series, selectSeries, status, error, data, busy, run } =
    useAnalysisRun("classification");
  const result = data?.result;
  const figures = data?.figures || [];
  const medians = result?.medians;
  const summary = asRecordArray(result?.summary);
  const events = asRecordArray(result?.events);
  const dominant = result?.dominant;
  const highLowRows = objectRows(result?.high_low_counts);

  return (
    <PageShell
      title="Flood classification"
      subtitle="Median-based P–V–D event types for the selected series"
    >
      <PageIntro title="Flood-event classification">
        Events from the selected AMS or POT P–V–D file are labelled by the
        Python analysis using the existing median High/Low rules. Counts,
        percentages, and medians shown here come from the returned response.
      </PageIntro>

      <div className="control-bar">
        <SeriesSelector value={series} onChange={selectSeries} />
        <div className="control-actions">
          <AnalysisButton onClick={run} disabled={busy}>
            Run classification
          </AnalysisButton>
        </div>
      </div>

      <StatusBanner
        status={status}
        series={series}
        analysisName="classification"
        error={error}
      />
      {status === "loading" ? (
        <LoadingState label="Running flood classification…" />
      ) : null}

      <div className="card-grid">
        <ResultCard title="Median thresholds" kicker="High / Low">
          {medians ? (
            <ResultsTable
              columns={[
                { key: "variable", label: "Variable" },
                { key: "median", label: "Median" },
              ]}
              rows={[
                { variable: "Peak", median: medians.Peakvalue },
                { variable: "Volume", median: medians.Volume },
                { variable: "Duration", median: medians.Duration },
              ]}
            />
          ) : (
            <EmptyState>
              Median peak, volume, and duration thresholds will appear here
              from the classification response.
            </EmptyState>
          )}
        </ResultCard>
        <ResultCard title="Summary" kicker="Dominant type">
          {dominant || highLowRows.length ? (
            <ResultsTable
              columns={[
                { key: "item", label: "Quantity" },
                { key: "value", label: "Value" },
              ]}
              rows={[
                { item: "Number of events", value: result?.n_events },
                { item: "Dominant flood type", value: dominant?.["Flood Type"] },
                {
                  item: "Dominant count",
                  value: dominant?.["Number of Events"],
                },
                {
                  item: "Dominant percentage",
                  value: dominant?.["Percentage (%)"],
                },
                ...highLowRows,
              ]}
            />
          ) : (
            <EmptyState>
              The dominant flood type, High/Low counts, and percentages will be
              summarised here after classification is returned.
            </EmptyState>
          )}
        </ResultCard>
      </div>

      <ResultCard title="Classification results" kicker="Event types">
        <ResultsTable
          columns={
            summary.length
              ? columnsFromRows(summary, SUMMARY_PREFERRED)
              : SUMMARY_PREFERRED.map((key) => ({ key, label: key }))
          }
          rows={summary}
          emptyText="Flood-type counts and percentages will be tabulated from the analysis response."
        />
      </ResultCard>

      <ResultCard title="Classified events" kicker="Catalogue">
        <ResultsTable
          columns={
            events.length
              ? columnsFromRows(events, EVENT_PREFERRED)
              : EVENT_PREFERRED.map((key) => ({ key, label: key }))
          }
          rows={events}
          emptyTitle="No classified events"
          emptyText="The event-level table will be listed here from the analysis response."
        />
      </ResultCard>

      <ResultCard title="3D Flood Characteristic Space" kicker="Peak–Volume–Duration">
        <p className="card-note">
          Each point represents a flood event positioned by peak discharge,
          flood volume, and flood duration.
        </p>
        {events.length ? (
          <Scatter3D events={events} />
        ) : (
          <EmptyState>
            The interactive 3D view will appear here from the classified
            events returned by the analysis service.
          </EmptyState>
        )}
      </ResultCard>

      <ResultCard title="Classification chart" kicker="Returned PNG">
        <FigureGallery
          figures={figures}
          emptyTitle="No classification figures returned"
          emptyText="If the analysis service includes PNG figures, they will be shown here."
        />
      </ResultCard>
    </PageShell>
  );
}
