import { useCallback, useMemo, useState } from "react";
import {
  runBivariate,
  runClassification,
  runUnivariate,
} from "../services/api.js";
import { AnalysisContext } from "./analysisContextObject.js";

const ANALYSES = ["univariate", "bivariate", "classification"];

function emptySlot() {
  return { status: "idle", error: null, data: null };
}

function emptyStore() {
  return {
    univariate: { AMS: emptySlot(), POT: emptySlot() },
    bivariate: { AMS: emptySlot(), POT: emptySlot() },
    classification: { AMS: emptySlot(), POT: emptySlot() },
  };
}

const RUNNERS = {
  univariate: runUnivariate,
  bivariate: runBivariate,
  classification: runClassification,
};

export function AnalysisProvider({ children }) {
  const [series, setSeriesState] = useState("AMS");
  const [store, setStore] = useState(emptyStore);

  const setSeries = useCallback((next) => {
    if (next === "AMS" || next === "POT") {
      setSeriesState(next);
    }
  }, []);

  const getSlot = useCallback(
    (kind, forSeries = series) => store[kind]?.[forSeries] || emptySlot(),
    [series, store],
  );

  const isBusy = useCallback(
    (kind) =>
      store[kind]?.AMS?.status === "loading" ||
      store[kind]?.POT?.status === "loading",
    [store],
  );

  const run = useCallback(async (kind, extra) => {
    if (!ANALYSES.includes(kind)) {
      return;
    }
    const requestedSeries = series;
    setStore((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [requestedSeries]: { status: "loading", error: null, data: null },
      },
    }));
    try {
      const data =
        kind === "univariate"
          ? await runUnivariate(requestedSeries, extra?.given_discharge)
          : await RUNNERS[kind](requestedSeries);
      setStore((current) => ({
        ...current,
        [kind]: {
          ...current[kind],
          [requestedSeries]: { status: "success", error: null, data },
        },
      }));
    } catch (error) {
      setStore((current) => ({
        ...current,
        [kind]: {
          ...current[kind],
          [requestedSeries]: {
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "The analysis could not be displayed.",
            data: null,
          },
        },
      }));
    }
  }, [series]);

  const value = useMemo(
    () => ({
      series,
      setSeries,
      store,
      getSlot,
      isBusy,
      run,
    }),
    [series, setSeries, store, getSlot, isBusy, run],
  );

  return (
    <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
  );
}

