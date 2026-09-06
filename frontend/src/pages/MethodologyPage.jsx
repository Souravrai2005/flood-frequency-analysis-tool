import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";

export default function MethodologyPage() {
  return (
    <PageShell
      title="Methodology"
      subtitle="How the Flood Frequency Analysis Tool is structured"
    >
      <PageIntro title="Methodological outline">
        The tool follows a two-layer workflow. MATLAB and the SFE-IFC toolbox
        extract AMS and POT flood events, including peak, volume, and duration.
        Python then performs univariate distribution fitting, copula-based
        bivariate analysis, joint AND/OR return periods, and median flood-type
        classification. This page will later hold a readable account of those
        steps for the BTP report audience.
      </PageIntro>
      <div className="panel">
        <h2>Principles already fixed in the analysis layer</h2>
        <ul className="note-list">
          <li>AMS and POT are alternative input series, not separate statistical codes</li>
          <li>Candidate distributions and copulas are selected by the existing information-criteria and goodness-of-fit rules</li>
          <li>The web interface will display those results; it will not re-fit models</li>
        </ul>
      </div>
    </PageShell>
  );
}
