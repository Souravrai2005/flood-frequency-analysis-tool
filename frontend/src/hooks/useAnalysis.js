import { useContext } from "react";
import { AnalysisContext } from "../context/analysisContextObject.js";

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error("useAnalysis must be used within AnalysisProvider");
  }
  return context;
}

export function useAnalysisRun(kind) {
  const { series, setSeries, getSlot, isBusy, run } = useAnalysis();
  const slot = getSlot(kind);
  return {
    series,
    selectSeries: setSeries,
    status: slot.status,
    error: slot.error,
    data: slot.data,
    busy: isBusy(kind),
    run: (extra) => run(kind, extra),
  };
}
