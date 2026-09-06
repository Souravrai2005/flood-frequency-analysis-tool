import EmptyState from "./EmptyState.jsx";
import FigureDisplay from "./FigureDisplay.jsx";

export default function FigureGallery({
  figures = [],
  emptyTitle = "No figures returned",
  emptyText = "Figures will appear here when the analysis service includes PNG images.",
}) {
  if (!figures.length) {
    return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  }

  return (
    <div className="figure-grid figure-grid-live">
      {figures.map((figure, index) => (
        <FigureDisplay
          key={`${figure.name || "figure"}-${index}`}
          name={figure.name}
          image={figure.image}
        />
      ))}
    </div>
  );
}
