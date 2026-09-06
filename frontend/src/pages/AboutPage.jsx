import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";

export default function AboutPage() {
  return (
    <PageShell
      title="About"
      subtitle="B.Tech project information"
    >
      <PageIntro title="Flood Frequency Analysis Tool">
        This interface is the web front of a B.Tech project on flood frequency
        analysis for the Ukai catchment. The work compares annual-maximum and
        peaks-over-threshold representations of flood extremes and treats peak,
        volume, and duration jointly through copulas, following a multivariate
        flood-frequency framework.
      </PageIntro>
      <div className="panel">
        <h2>Project notes</h2>
        <p>
          Station sheet 62255 identifies the catchment area in square
          kilometres. Event extraction is performed offline. The Python
          analysis and FastAPI service are already in the repository; this
          React application is the user-facing shell and is not yet connected
          to the API.
        </p>
      </div>
    </PageShell>
  );
}
