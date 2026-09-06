export const API_BASE = "http://127.0.0.1:8000";

const CONNECT_ERROR =
  "Unable to connect to the FFA analysis server. Please make sure FastAPI is running at http://127.0.0.1:8000.";

function assertSeries(series) {
  if (series !== "AMS" && series !== "POT") {
    throw new Error("series must be AMS or POT");
  }
}

function messageFromPayload(payload, fallback) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }
  return fallback;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error(
      response.ok
        ? "The analysis server returned a malformed response."
        : `The analysis server returned HTTP ${response.status}. The response was not valid JSON.`,
    );
    error.cause = "malformed";
    throw error;
  }
}

async function postAnalysis(path, body) {
  assertSeries(body.series);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(CONNECT_ERROR);
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      messageFromPayload(
        payload,
        `The analysis server returned HTTP ${response.status}.`,
      ),
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("The analysis server returned an unexpected response structure.");
  }

  if (payload.status === "error") {
    throw new Error(
      messageFromPayload(payload, "The analysis server returned an error."),
    );
  }

  if (
    payload.status !== "success" ||
    payload.result == null ||
    typeof payload.result !== "object"
  ) {
    throw new Error("The analysis server returned an unexpected response structure.");
  }

  return {
    status: payload.status,
    analysis: payload.analysis,
    series: payload.series || body.series,
    result: payload.result,
    figures: Array.isArray(payload.figures) ? payload.figures : [],
  };
}

export function runUnivariate(series, givenDischarge) {
  const body = { series };
  if (givenDischarge != null && givenDischarge !== "") {
    body.given_discharge = givenDischarge;
  }
  return postAnalysis("/api/univariate", body);
}

export function runBivariate(series) {
  return postAnalysis("/api/bivariate", { series });
}

export function runClassification(series) {
  return postAnalysis("/api/classification", { series });
}
