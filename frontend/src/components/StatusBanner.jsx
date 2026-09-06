export default function StatusBanner({
  status,
  series,
  analysisName,
  error,
}) {
  const messages = {
    idle: `No ${analysisName} has been run for the ${series} series.`,
    loading: `Running ${series} ${analysisName}. Please wait…`,
    success: `${series} ${analysisName} completed.`,
    error:
      error ||
      "The analysis could not be displayed. Check that the analysis server is running.",
  };

  return (
    <div className={`status-banner status-${status}`} role="status">
      <span className="status-dot" />
      <span>{messages[status] || messages.idle}</span>
    </div>
  );
}
