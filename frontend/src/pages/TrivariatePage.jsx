import PageShell from "../components/PageShell.jsx";
import PageIntro from "../components/PageIntro.jsx";
import ResultCard from "../components/ResultCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

export default function TrivariatePage() {
  return (
    <PageShell
      title="Trivariate analysis"
      subtitle="Reserved module — not yet implemented"
    >
      <PageIntro
        title="Future trivariate copula analysis"
        tags={["Under development"]}
      >
        A three-variable copula treatment of peak, volume, and duration is
        planned but is not part of the current analysis layer. This page is
        reserved so navigation does not have to change when that module is
        added. No trivariate calculations are available.
      </PageIntro>
      <ResultCard title="Status" kicker="Not implemented">
        <EmptyState title="Under development">
          The Python trivariate analysis file has not been added. AMS/POT
          selection and run controls will appear here only after that module
          exists.
        </EmptyState>
      </ResultCard>
    </PageShell>
  );
}
