import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";

export default function HomePage() {
  return (
    <PageShell
      title="Home"
      subtitle="Introduction to the Flood Frequency Analysis Tool"
    >
      <PageIntro
        title="A hydrologic design aid for flood extremes"
        tags={["Ukai catchment", "AMS", "POT", "Copulas"]}
      >
        This application presents flood frequency analysis for the Ukai station
        on the Tapi basin. It is built around processed annual-maximum and
        peaks-over-threshold event series, then univariate, bivariate, and
        classification modules. Statistical calculations remain on the Python
        analysis layer; this page introduces the tool and its intended use in
        hydrologic design.
      </PageIntro>
      <div className="panel">
        <h2>What this interface will contain</h2>
        <p>
          Later phases will connect this shell to the FastAPI service so that
          AMS or POT can be selected, analyses can be run, and tables, copula
          results, return periods, and figures can be displayed here. No
          analysis results are shown on this page yet.
        </p>
      </div>
    </PageShell>
  );
}
