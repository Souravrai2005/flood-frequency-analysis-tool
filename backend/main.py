# -*- coding: utf-8 -*-
"""FastAPI interface for the validated flood-frequency analysis layer.

Statistical calculations live only in analysis/*.py.
"""

from __future__ import annotations

import math
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any, Literal, Optional

import matplotlib
matplotlib.use("Agg")

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ANALYSIS_DIR = PROJECT_ROOT / "analysis"
if str(ANALYSIS_DIR) not in sys.path:
    sys.path.insert(0, str(ANALYSIS_DIR))

from univariate import run_univariate  # noqa: E402
from bivariate import run_bivariate  # noqa: E402
from classification import run_classification  # noqa: E402
try:
    from backend.upload_validation import (  # noqa: E402
        UploadValidationError,
        validate_raw_excel,
    )
except ImportError:
    from upload_validation import (  # noqa: E402
        UploadValidationError,
        validate_raw_excel,
    )


ALLOWED_SERIES = ("AMS", "POT")


class AnalysisRequest(BaseModel):
    series: Literal["AMS", "POT"] = Field(
        ...,
        description="Processed dataset selector. Only AMS or POT is allowed.",
    )
    given_discharge: Optional[float] = Field(
        default=None,
        gt=0,
        description="Optional peak discharge (m³/s) for the univariate given-discharge return period.",
    )


app = FastAPI(
    title="Flood Frequency Analysis Tool",
    description="HTTP interface over the validated Python flood-frequency analysis.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_jsonable(obj: Any) -> Any:
    """Convert analysis-layer values to JSON-safe Python types.

    Does not compute new statistics. Live scipy/statsmodels objects are omitted.
    Non-finite floats are returned as null because they are not valid JSON.
    """
    if obj is None or isinstance(obj, (bool, str)):
        return obj

    if isinstance(obj, int) and not isinstance(obj, bool):
        return int(obj)

    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj

    if isinstance(obj, Path):
        return str(obj)

    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    try:
        import numpy as np
        import pandas as pd
    except ImportError:
        np = None
        pd = None

    if np is not None:
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            value = float(obj)
            if math.isnan(value) or math.isinf(value):
                return None
            return value
        if isinstance(obj, np.ndarray):
            return [to_jsonable(item) for item in obj.tolist()]

    if pd is not None:
        if isinstance(obj, pd.Timestamp):
            if pd.isna(obj):
                return None
            return obj.isoformat()
        if isinstance(obj, pd.Timedelta):
            return str(obj)
        if isinstance(obj, pd.DataFrame):
            frame = obj.copy()
            records = frame.to_dict(orient="records")
            return [to_jsonable(record) for record in records]
        if isinstance(obj, pd.Series):
            return {str(key): to_jsonable(value) for key, value in obj.items()}

    if isinstance(obj, dict):
        return {str(key): to_jsonable(value) for key, value in obj.items()}

    if isinstance(obj, (list, tuple)):
        return [to_jsonable(item) for item in obj]

    module = type(obj).__module__ or ""
    if module.startswith("scipy") or module.startswith("statsmodels"):
        return None

    return str(obj)


def extract_figures(payload: dict) -> list[dict]:
    figures = payload.get("figures") or []
    converted = []
    for figure in figures:
        converted.append({
            "name": figure.get("title") or figure.get("name") or "figure",
            "image": figure.get("image_base64") or figure.get("image") or "",
        })
    return converted


def build_success_response(analysis: str, series: str, raw: dict) -> dict:
    figures = extract_figures(raw)
    result = {key: value for key, value in raw.items() if key != "figures"}
    return {
        "status": "success",
        "analysis": analysis,
        "series": series,
        "result": to_jsonable(result),
        "figures": figures,
    }


def run_analysis(analysis: str, series: str, given_discharge=None) -> dict:
    if series not in ALLOWED_SERIES:
        raise HTTPException(
            status_code=400,
            detail={"status": "error", "message": "series must be AMS or POT"},
        )

    if analysis == "univariate":
        raw = run_univariate(series, given_discharge=given_discharge)
    elif analysis == "bivariate":
        raw = run_bivariate(series)
    elif analysis == "classification":
        raw = run_classification(series)
    else:
        raise HTTPException(
            status_code=400,
            detail={"status": "error", "message": "Unknown analysis"},
        )
    return build_success_response(analysis, series, raw)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    errors = exc.errors()
    locs = [err.get("loc", ()) for err in errors]
    path = str(getattr(request.url, "path", "") or "")
    if any("given_discharge" in loc for loc in locs):
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "message": "given_discharge must be a positive number in m³/s.",
            },
        )
    if path.endswith("/api/data/upload") or any("file" in loc for loc in locs):
        return JSONResponse(
            status_code=422,
            content={
                "status": "error",
                "message": "An Excel file is required. Please choose a .xlsx workbook.",
            },
        )
    return JSONResponse(
        status_code=422,
        content={
            "status": "error",
            "message": "series must be AMS or POT",
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc: HTTPException):
    if isinstance(exc.detail, dict) and exc.detail.get("status") == "error":
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc)},
    )


@app.get("/")
def root():
    return {
        "name": "Flood Frequency Analysis Tool",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/univariate")
def api_univariate(body: AnalysisRequest):
    return run_analysis(
        "univariate",
        body.series,
        given_discharge=body.given_discharge,
    )


@app.post("/api/bivariate")
def api_bivariate(body: AnalysisRequest):
    return run_analysis("bivariate", body.series)


@app.post("/api/classification")
def api_classification(body: AnalysisRequest):
    # given_discharge is ignored for classification
    return run_analysis("classification", body.series)


@app.post("/api/data/upload")
async def api_data_upload(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        validation = validate_raw_excel(contents, file.filename or "")
    except UploadValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"status": "error", "message": exc.message},
        ) from None
    return {
        "status": "success",
        "filename": file.filename,
        "validation": to_jsonable(validation),
    }

