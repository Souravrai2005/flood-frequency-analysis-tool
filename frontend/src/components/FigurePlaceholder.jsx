export default function FigurePlaceholder({
  title,
  caption = "Figure will be displayed from the analysis service (PNG).",
}) {
  return (
    <figure className="figure-placeholder">
      <div className="figure-frame" aria-hidden="true">
        <svg viewBox="0 0 120 64" className="figure-sketch">
          <path d="M8 52 H112" stroke="currentColor" strokeWidth="1" />
          <path d="M8 8 V52" stroke="currentColor" strokeWidth="1" />
          <path
            d="M12 46 L28 38 L44 41 L62 22 L78 28 L104 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
