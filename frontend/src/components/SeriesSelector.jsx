export default function SeriesSelector({ value, onChange, label = "Event series" }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="seg-group" role="group" aria-label={label}>
        {["AMS", "POT"].map((series) => (
          <button
            key={series}
            type="button"
            className={value === series ? "seg active" : "seg"}
            onClick={() => onChange(series)}
          >
            {series}
          </button>
        ))}
      </div>
      <p className="field-hint">
        {value === "AMS"
          ? "Annual maximum series from the processed AMS files."
          : "Peaks-over-threshold series from the processed POT files."}
      </p>
    </div>
  );
}
