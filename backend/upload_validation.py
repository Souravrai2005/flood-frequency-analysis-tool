# -*- coding: utf-8 -*-
"""Raw Excel upload validation for V2.1.

Opens and inspects a hydrological workbook. Does not extract AMS/POT events
or run statistical analysis.
"""

from __future__ import annotations

import math
import re
from io import BytesIO
from typing import Any, Optional

import pandas as pd

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".xlsx", ".xls"}
PREVIEW_ROWS = 8

YEAR_ALIASES = {"year"}
MONTH_ALIASES = {"month"}
DAY_ALIASES = {"day"}
DATE_ALIASES = {"date"}
DISCHARGE_ALIASES = ("q(m3/s)", "discharge", "flow", "q")


class UploadValidationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalize(name: Any) -> str:
    text = str(name).strip().lower().replace("³", "3")
    text = re.sub(r"\s+", "", text)
    return text


def _extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return "." + filename.rsplit(".", 1)[-1].lower()


def _parse_catchment_area(sheet_name: str) -> Optional[float]:
    """MATLAB uses str2double(first sheet name) as catchment area km²."""
    try:
        value = float(str(sheet_name).strip())
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    return value


def _first_alias_match(columns: list[str], aliases: set[str]) -> Optional[str]:
    for column in columns:
        if _normalize(column) in aliases:
            return column
    return None


def _discharge_match(columns: list[str]) -> Optional[str]:
    normalized = {_normalize(column): column for column in columns}
    for alias in DISCHARGE_ALIASES:
        if alias in normalized:
            return normalized[alias]
    return None


def _numeric_count(series: pd.Series) -> int:
    values = pd.to_numeric(series, errors="coerce")
    return int(values.notna().sum())


def _json_cell(value: Any) -> Any:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except (TypeError, ValueError):
            pass
    if hasattr(value, "item") and not isinstance(value, (bytes, str)):
        try:
            return _json_cell(value.item())
        except (ValueError, AttributeError):
            pass
    if isinstance(value, str):
        return value
    return str(value)


def validate_raw_excel(contents: bytes, filename: str) -> dict:
    if not filename or not str(filename).strip():
        raise UploadValidationError("An Excel file is required.")

    filename = str(filename).strip()
    extension = _extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise UploadValidationError(
            "Only Excel workbooks are accepted (.xlsx or .xls). Please choose an Excel file."
        )

    if contents is None or len(contents) == 0:
        raise UploadValidationError("The uploaded file is empty.")

    if len(contents) > MAX_UPLOAD_BYTES:
        raise UploadValidationError(
            "The uploaded file is too large. Please upload a workbook under 25 MB."
        )

    buffer = BytesIO(contents)
    try:
        workbook = pd.ExcelFile(buffer)
    except Exception:
        raise UploadValidationError(
            "The file could not be opened as an Excel workbook. It may be corrupt, "
            "unreadable, or not a valid .xlsx file."
        )

    sheet_names = list(workbook.sheet_names or [])
    if not sheet_names:
        raise UploadValidationError("The workbook does not contain any worksheets.")

    sheet_name = str(sheet_names[0])
    try:
        frame = pd.read_excel(workbook, sheet_name=0)
    except Exception:
        raise UploadValidationError(
            "The first worksheet could not be read. The workbook may be corrupt."
        )

    if frame is None or frame.empty:
        raise UploadValidationError("The first worksheet is empty.")

    columns = [str(column) for column in frame.columns]
    if not columns or all(_normalize(column) in {"", "unnamed:0"} or column.lower().startswith("unnamed") for column in columns):
        raise UploadValidationError(
            "The first worksheet has no usable column headings."
        )

    year_col = _first_alias_match(columns, YEAR_ALIASES)
    month_col = _first_alias_match(columns, MONTH_ALIASES)
    day_col = _first_alias_match(columns, DAY_ALIASES)
    date_col = _first_alias_match(columns, DATE_ALIASES)
    discharge_col = _discharge_match(columns)

    has_ymd = year_col is not None and month_col is not None and day_col is not None
    if not has_ymd and date_col is None:
        raise UploadValidationError(
            "Expected date information was not found. The first worksheet should "
            "contain Year, Month and Day columns, or a Date column."
        )

    if discharge_col is None:
        raise UploadValidationError(
            "A discharge/flow column was not found. Expected a column such as "
            "Q(m3/s), Discharge, Flow, or Q."
        )

    discharge_usable = _numeric_count(frame[discharge_col])
    if discharge_usable < 1:
        raise UploadValidationError(
            f"Column '{discharge_col}' does not contain usable numeric discharge observations."
        )

    if has_ymd:
        if _numeric_count(frame[year_col]) < 1:
            raise UploadValidationError(
                f"Column '{year_col}' does not contain usable numeric year values."
            )
        if _numeric_count(frame[month_col]) < 1:
            raise UploadValidationError(
                f"Column '{month_col}' does not contain usable numeric month values."
            )
        if _numeric_count(frame[day_col]) < 1:
            raise UploadValidationError(
                f"Column '{day_col}' does not contain usable numeric day values."
            )
    elif int(frame[date_col].notna().sum()) < 1:
        raise UploadValidationError(
            f"Column '{date_col}' does not contain usable date values."
        )

    missing_values = {
        column: int(frame[column].isna().sum()) for column in columns
    }
    catchment_area = _parse_catchment_area(sheet_name)
    matches_ukai = (
        year_col == "Year"
        and month_col == "Month"
        and day_col == "Day"
        and discharge_col == "Q(m3/s)"
        and catchment_area is not None
    )

    if matches_ukai:
        message = (
            "Workbook matches the existing Ukai raw-data structure: first sheet "
            "name is the catchment area, with Year, Month, Day and Q(m3/s)."
        )
    else:
        message = (
            "Workbook opened successfully. Date and discharge columns were "
            "identified. This file has not been converted to AMS/POT events."
        )

    preview = frame.head(PREVIEW_ROWS)
    preview_records = []
    for record in preview.to_dict(orient="records"):
        preview_records.append(
            {str(key): _json_cell(value) for key, value in record.items()}
        )

    return {
        "valid": True,
        "message": message,
        "sheet_name": sheet_name,
        "sheet_names": sheet_names,
        "rows": int(len(frame)),
        "columns": columns,
        "detected_columns": {
            "year": year_col,
            "month": month_col,
            "day": day_col,
            "date": date_col,
            "discharge": discharge_col,
        },
        "catchment_area": catchment_area,
        "missing_values": missing_values,
        "usable_discharge_observations": discharge_usable,
        "matches_ukai_raw_structure": matches_ukai,
        "preview": preview_records,
    }
