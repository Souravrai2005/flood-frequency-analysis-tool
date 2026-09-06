# -*- coding: utf-8 -*-
"""Classification analysis.

Callable pipeline: run_classification("AMS") or run_classification("POT").
Statistical rules are unchanged from the validated Colab implementation.
"""

from pathlib import Path
import io
import base64

import numpy as np
import pandas as pd

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

PROJECT_ROOT = Path(__file__).resolve().parents[1]

P_col = "Peakvalue"
V_col = "Volume"
D_col = "Duration"

PVD_DATASETS = {
    "AMS": PROJECT_ROOT / "data" / "processed" / "AMS_PVD_final_dataset.xlsx",
    "POT": PROJECT_ROOT / "data" / "processed" / "POT_PVD_final_dataset.xlsx",
}


def classify_flood(row, P_median, V_median, D_median):

    P_high = row[P_col] >= P_median
    V_high = row[V_col] >= V_median
    D_high = row[D_col] >= D_median

    # --------------------------------------------------------
    # Extreme event
    # --------------------------------------------------------
    if P_high and V_high and D_high:
        return "Extreme event"

    # --------------------------------------------------------
    # P-V type
    # --------------------------------------------------------
    elif P_high and V_high and not D_high:
        return "P-V type"

    # --------------------------------------------------------
    # V-D type
    # --------------------------------------------------------
    elif not P_high and V_high and D_high:
        return "V-D type"

    # --------------------------------------------------------
    # P-D type
    # --------------------------------------------------------
    elif P_high and not V_high and D_high:
        return "P-D type"

    # --------------------------------------------------------
    # Low-intensity event
    # --------------------------------------------------------
    elif not P_high and not V_high and not D_high:
        return "Low-intensity event"

    # --------------------------------------------------------
    # Remaining combinations
    # --------------------------------------------------------
    else:
        return "Other"


FLOOD_TYPE_COLORS = {
    "P-V type": "#2c7a86",
    "V-D type": "#0b1f33",
    "P-D type": "#c4a574",
    "Extreme event": "#8b3a32",
    "Low-intensity event": "#6b8f71",
    "Other": "#5c6773",
}

TYPE_ORDER = [
    "P-V type",
    "V-D type",
    "P-D type",
    "Extreme event",
    "Low-intensity event",
    "Other",
]


def _capture_current_figure():
    fig = plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=140)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _pvd_scatter_figure(df):
    """3D scatter of actual classified P–V–D observations. No reclassification."""
    fig = plt.figure(figsize=(9.5, 7.2))
    ax = fig.add_subplot(111, projection="3d")

    for flood_type in TYPE_ORDER:
        group = df[df["Flood_Type"] == flood_type]
        if group.empty:
            continue
        ax.scatter(
            group[P_col].to_numpy(),
            group[V_col].to_numpy(),
            group[D_col].to_numpy(),
            label=flood_type,
            color=FLOOD_TYPE_COLORS.get(flood_type, "#5c6773"),
            s=46,
            depthshade=True,
            edgecolors="white",
            linewidths=0.4,
        )

    ax.set_xlabel("Peak Discharge")
    ax.set_ylabel("Flood Volume")
    ax.set_zlabel("Flood Duration")
    ax.set_title("Flood events in Peak–Volume–Duration space")
    ax.legend(loc="upper left", bbox_to_anchor=(0.0, 1.05), fontsize=8)
    fig.subplots_adjust(left=0.02, right=0.82, bottom=0.05, top=0.92)
    return {
        "title": "3D Flood Characteristic Space (Peak–Volume–Duration)",
        "image_base64": _capture_current_figure(),
    }


def run_classification(series):
    # ============================================================
    # 1. READ DATA
    # ============================================================

    series = str(series).upper()
    if series not in PVD_DATASETS:
        raise ValueError('series must be "AMS" or "POT"')

    file_path = PVD_DATASETS[series]

    df = pd.read_excel(file_path)

    # Actual column names in your dataset

    # ============================================================
    # 2. CONVERT TO NUMERIC
    # ============================================================

    df[P_col] = pd.to_numeric(df[P_col], errors="coerce")
    df[V_col] = pd.to_numeric(df[V_col], errors="coerce")
    df[D_col] = pd.to_numeric(df[D_col], errors="coerce")


    # Remove rows where P, V or D is missing
    df = df.dropna(
        subset=[P_col, V_col, D_col]
    ).copy()


    # ============================================================
    # 3. EXTRACT VARIABLES
    # ============================================================

    P = df[P_col]
    V = df[V_col]
    D = df[D_col]


    # ============================================================
    # 4. CALCULATE MEDIAN VALUES
    # ============================================================

    P_median = P.median()
    V_median = V.median()
    D_median = D.median()


    print("\n============================================")
    print("MEDIAN VALUES")
    print("============================================")

    print(f"Peakvalue median = {P_median}")
    print(f"Volume median    = {V_median}")
    print(f"Duration median  = {D_median}")


    # ============================================================
    # 5. HIGH / LOW CLASSIFICATION
    #
    # HIGH = value >= median
    # LOW  = value < median
    # ============================================================

    df["Peak_Level"] = np.where(
        df[P_col] >= P_median,
        "High",
        "Low"
    )

    df["Volume_Level"] = np.where(
        df[V_col] >= V_median,
        "High",
        "Low"
    )

    df["Duration_Level"] = np.where(
        df[D_col] >= D_median,
        "High",
        "Low"
    )


    # ============================================================
    # 6. FLOOD TYPE CLASSIFICATION
    # ============================================================

    df["Flood_Type"] = df.apply(
        lambda row: classify_flood(row, P_median, V_median, D_median),
        axis=1
    )


    # ============================================================
    # 7. SUMMARY
    # ============================================================

    type_order = [
        "P-V type",
        "V-D type",
        "P-D type",
        "Extreme event",
        "Low-intensity event",
        "Other"
    ]

    summary = (
        df["Flood_Type"]
        .value_counts()
        .reindex(
            type_order,
            fill_value=0
        )
        .reset_index()
    )

    summary.columns = [
        "Flood Type",
        "Number of Events"
    ]

    summary["Percentage (%)"] = (
        summary["Number of Events"]
        / len(df)
        * 100
    )


    print("\n============================================")
    print("FLOOD CLASSIFICATION SUMMARY")
    print("============================================")

    print(
        summary.to_string(index=False)
    )


    # ============================================================
    # 8. DOMINANT FLOOD TYPE
    # ============================================================

    dominant = summary.loc[
        summary["Number of Events"].idxmax()
    ]

    print("\n============================================")
    print("DOMINANT FLOOD TYPE")
    print("============================================")

    print(
        f"Dominant type: {dominant['Flood Type']}"
    )

    print(
        f"Number of events: "
        f"{int(dominant['Number of Events'])}"
    )

    print(
        f"Percentage: "
        f"{dominant['Percentage (%)']:.2f}%"
    )


    # ============================================================
    # 9. HIGH / LOW COUNTS
    # ============================================================

    print("\n============================================")
    print("HIGH / LOW COUNTS")
    print("============================================")

    print(
        f"Peakvalue High: "
        f"{(df[P_col] >= P_median).sum()}"
    )

    print(
        f"Peakvalue Low : "
        f"{(df[P_col] < P_median).sum()}"
    )

    print(
        f"Volume High: "
        f"{(df[V_col] >= V_median).sum()}"
    )

    print(
        f"Volume Low : "
        f"{(df[V_col] < V_median).sum()}"
    )

    print(
        f"Duration High: "
        f"{(df[D_col] >= D_median).sum()}"
    )

    print(
        f"Duration Low : "
        f"{(df[D_col] < D_median).sum()}"
    )


    # ============================================================
    # 10. FIRST 10 EVENTS — MANUAL CHECK
    # ============================================================

    print("\n============================================")
    print("FIRST 10 EVENTS — MANUAL CHECK")
    print("============================================")

    manual_columns = [
        P_col,
        V_col,
        D_col,
        "Peak_Level",
        "Volume_Level",
        "Duration_Level",
        "Flood_Type"
    ]

    print(
        df[manual_columns]
        .head(10)
        .to_string(index=False)
    )


    # ============================================================
    # 11. SAVE CLASSIFIED DATA
    # ============================================================

    output_columns = [
        P_col,
        V_col,
        D_col,
        "Peak_Level",
        "Volume_Level",
        "Duration_Level",
        "Flood_Type"
    ]

    if series == "AMS":
        output_file = PROJECT_ROOT / "results" / "PVD_Median_Flood_Classification.xlsx"
    else:
        output_file = PROJECT_ROOT / "results" / "POT_PVD_Median_Flood_Classification.xlsx"

    df[output_columns].to_excel(
        output_file,
        index=False
    )


    print("\n============================================")
    print("OUTPUT FILE")
    print("============================================")

    print(f"Saved as: {output_file}")

    figures = [_pvd_scatter_figure(df)]

    return {
        "series": series,
        "file_path": file_path,
        "n_events": int(len(df)),
        "medians": {
            "Peakvalue": P_median,
            "Volume": V_median,
            "Duration": D_median,
        },
        "summary": summary,
        "dominant": {
            "Flood Type": dominant["Flood Type"],
            "Number of Events": int(dominant["Number of Events"]),
            "Percentage (%)": float(dominant["Percentage (%)"]),
        },
        "high_low_counts": {
            "Peakvalue High": int((df[P_col] >= P_median).sum()),
            "Peakvalue Low": int((df[P_col] < P_median).sum()),
            "Volume High": int((df[V_col] >= V_median).sum()),
            "Volume Low": int((df[V_col] < V_median).sum()),
            "Duration High": int((df[D_col] >= D_median).sum()),
            "Duration Low": int((df[D_col] < D_median).sum()),
        },
        "events": df[output_columns].copy(),
        "excel_path": output_file,
        "figures": figures,
    }


if __name__ == "__main__":
    import sys

    series_arg = sys.argv[1] if len(sys.argv) > 1 else "AMS"
    run_classification(series_arg)
