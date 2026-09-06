export default function DatasetInfo({
  seriesLabel,
  file,
  path,
  purpose,
  nLabel = "Number of observations / events",
  nValue = "To be reported by the analysis service",
}) {
  return (
    <dl className="info-grid">
      <div>
        <dt>Series</dt>
        <dd>{seriesLabel}</dd>
      </div>
      <div>
        <dt>Processed file</dt>
        <dd>{file}</dd>
      </div>
      <div>
        <dt>Project path</dt>
        <dd className="mono">{path}</dd>
      </div>
      <div>
        <dt>{nLabel}</dt>
        <dd>{nValue}</dd>
      </div>
      <div className="info-span">
        <dt>Purpose</dt>
        <dd>{purpose}</dd>
      </div>
    </dl>
  );
}
