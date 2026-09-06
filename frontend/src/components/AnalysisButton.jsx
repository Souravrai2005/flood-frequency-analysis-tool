export default function AnalysisButton({
  children,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      className="analysis-button"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
