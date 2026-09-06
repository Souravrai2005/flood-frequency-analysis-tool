import { useAnalysis } from "../hooks/useAnalysis.js";

export function useSeriesSelection() {
  const { series, setSeries } = useAnalysis();
  return { series, selectSeries: setSeries };
}
