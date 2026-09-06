# -*- coding: utf-8 -*-
"""Univariate analysis.

Callable pipeline: run_univariate("AMS") or run_univariate("POT").
Statistical calculations are unchanged from the validated Colab implementation.
"""

from pathlib import Path
import io
import base64
import sys

import pandas as pd
import numpy as np

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from scipy import stats
from scipy.stats import lognorm, expon, gamma, weibull_min, genpareto

PROJECT_ROOT = Path(__file__).resolve().parents[1]

UNIVARIATE_DATASETS = {
    "AMS": PROJECT_ROOT / "data" / "processed" / "AMS_Univariate_Dataset.xlsx",
    "POT": PROJECT_ROOT / "data" / "processed" / "POT_Univariate_Dataset.xlsx",
}

# POT excess threshold used by the existing excess-over-threshold / GPD
# methodology. This is not the user-supplied given-discharge input.
THRESHOLD = 4622.9

DESIGN_RETURN_PERIODS = [2, 5, 10, 25, 50, 100]


def _capture_current_figure():
    fig = plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def run_univariate(series, given_discharge=None):
    series = str(series).upper()
    if series not in UNIVARIATE_DATASETS:
        raise ValueError('series must be "AMS" or "POT"')

    if given_discharge is not None:
        try:
            given_discharge = float(given_discharge)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                "given_discharge must be a positive number in m³/s"
            ) from exc
        if not np.isfinite(given_discharge) or given_discharge <= 0:
            raise ValueError("given_discharge must be a positive number in m³/s")

    figures = []

    file_path = UNIVARIATE_DATASETS[series]
    df = pd.read_excel(file_path)

    ams = df["Peak"].dropna().reset_index(drop=True)

    print("Number of AMS observations:", len(ams))
    print(ams.describe())

    plt.figure(figsize=(8, 5))

    plt.hist(ams, bins=10, edgecolor="black")

    plt.xlabel("Peak Discharge (m³/s)")
    plt.ylabel("Frequency")
    plt.title("Histogram of AMS Peak Discharge")

    figures.append({
        "title": "Histogram of AMS Peak Discharge",
        "image_base64": _capture_current_figure(),
    })

    plt.figure(figsize=(8, 4))

    plt.boxplot(ams, vert=False)

    plt.xlabel("Peak Discharge (m³/s)")
    plt.title("Boxplot of AMS Peak Discharge")

    figures.append({
        "title": "Boxplot of AMS Peak Discharge",
        "image_base64": _capture_current_figure(),
    })

    # ============================================================
    # 2. EMPIRICAL CDF
    # ============================================================

    ams_sorted = np.sort(ams)

    n = len(ams_sorted)

    # Weibull plotting position
    empirical_cdf = np.arange(1, n + 1) / (n + 1)


    # ============================================================
    # 3. CANDIDATE DISTRIBUTIONS
    # ============================================================

    distributions = {
        "GEV": stats.genextreme,
        "Gumbel": stats.gumbel_r,
        "Lognormal": stats.lognorm,
        "Gamma": stats.gamma,
        "Weibull": stats.weibull_min,
        "Pearson III": stats.pearson3
    }


    # ============================================================
    # 4. FIT DISTRIBUTIONS
    # ============================================================

    fitted_params = {}

    for name, distribution in distributions.items():

        try:
            params = distribution.fit(ams)
            fitted_params[name] = params

            print(f"\n{name}")
            print("Parameters:", params)

        except Exception as e:
            print(f"{name} could not be fitted: {e}")


    # ============================================================
    # 5. PLOT EMPIRICAL CDF + THEORETICAL CDFS
    # ============================================================

    plt.figure(figsize=(10, 6))

    # Empirical CDF
    plt.plot(
        ams_sorted,
        empirical_cdf,
        "ko",
        markersize=5,
        label="Empirical CDF"
    )


    # Theoretical CDFs
    x = np.linspace(
        ams_sorted.min(),
        ams_sorted.max(),
        500
    )

    for name, distribution in distributions.items():

        if name in fitted_params:

            params = fitted_params[name]

            cdf = distribution.cdf(x, *params)

            plt.plot(
                x,
                cdf,
                linewidth=2,
                label=name
            )


    plt.xlabel("Annual Maximum Discharge (m³/s)")
    plt.ylabel("Cumulative Probability")
    plt.title("AMS: Empirical CDF vs Candidate Distributions")

    plt.grid(True, alpha=0.3)
    plt.legend()

    figures.append({
        "title": "AMS: Empirical CDF vs Candidate Distributions",
        "image_base64": _capture_current_figure(),
    })

    # ============================================================
    # 6. AIC AND BIC
    # ============================================================

    results = []

    for name, distribution in distributions.items():

        if name not in fitted_params:
            continue

        params = fitted_params[name]

        # log-likelihood
        loglik = np.sum(distribution.logpdf(ams, *params))

        # number of parameters
        k = len(params)

        # AIC
        aic = 2 * k - 2 * loglik

        # BIC
        bic = k * np.log(len(ams)) - 2 * loglik

        results.append({
            "Distribution": name,
            "LogLikelihood": loglik,
            "AIC": aic,
            "BIC": bic
        })


    results_df = pd.DataFrame(results)

    results_df = results_df.sort_values("AIC")

    print("\nDistribution comparison:")
    print(results_df)

    # ============================================================
    # 7. KOLMOGOROV-SMIRNOV TEST
    # ============================================================

    ks_results = []

    for name, distribution in distributions.items():

        if name not in fitted_params:
            continue

        params = fitted_params[name]

        ks_stat, ks_pvalue = stats.kstest(
            ams,
            distribution.cdf,
            args=params
        )

        ks_results.append({
            "Distribution": name,
            "KS Statistic": ks_stat,
            "KS p-value": ks_pvalue
        })


    ks_df = pd.DataFrame(ks_results)

    ks_df = ks_df.sort_values("KS Statistic")

    print("\nKS goodness-of-fit:")
    print(ks_df)

    comparison = results_df.merge(
        ks_df,
        on="Distribution"
    )

    # Combined AIC/BIC ranking, same as analysis/bivariate.py
    # (fit_marginal_distribution / copula ranking):
    #   AIC_Rank = AIC.rank(method="min")
    #   BIC_Rank = BIC.rank(method="min")
    #   Mean_Rank = (AIC_Rank + BIC_Rank) / 2
    #   order by Mean_Rank, then AIC, then BIC
    comparison["AIC_Rank"] = comparison["AIC"].rank(method="min")
    comparison["BIC_Rank"] = comparison["BIC"].rank(method="min")
    comparison["Mean_Rank"] = (
        comparison["AIC_Rank"] + comparison["BIC_Rank"]
    ) / 2
    comparison = comparison.sort_values(
        by=["Mean_Rank", "AIC", "BIC"]
    ).reset_index(drop=True)

    print(comparison)

    # --------------------------------------------------
    # 1. AMS data
    # --------------------------------------------------
    data = np.asarray(ams)
    data = data[np.isfinite(data)]
    data = data[data > 0]       # Lognormal requires positive values

    # --------------------------------------------------
    # 2. Fit Lognormal distribution
    # --------------------------------------------------
    shape, loc, scale = stats.lognorm.fit(data, floc=0)

    # --------------------------------------------------
    # 3. Calculate theoretical quantiles
    # --------------------------------------------------
    n = len(data)

    # Empirical plotting positions
    p = (np.arange(1, n + 1) - 0.5) / n

    # Observed quantiles
    observed = np.sort(data)

    # Theoretical Lognormal quantiles
    theoretical = stats.lognorm.ppf(
        p,
        s=shape,
        loc=loc,
        scale=scale
    )

    # --------------------------------------------------
    # 4. QQ Plot
    # --------------------------------------------------
    plt.figure(figsize=(7, 6))

    plt.scatter(theoretical, observed, s=35)

    # 1:1 reference line
    min_val = min(theoretical.min(), observed.min())
    max_val = max(theoretical.max(), observed.max())

    plt.plot(
        [min_val, max_val],
        [min_val, max_val],
        'r--',
        linewidth=2
    )

    plt.xlabel("Theoretical Lognormal Quantiles")
    plt.ylabel("Observed AMS Peak Discharges (m³/s)")
    plt.title("Q-Q Plot: AMS vs Lognormal Distribution")

    plt.grid(alpha=0.3)
    plt.tight_layout()
    figures.append({
        "title": "Q-Q Plot: AMS vs Lognormal Distribution",
        "image_base64": _capture_current_figure(),
    })

    # Given discharge → return period, using the existing Lognormal (floc=0)
    # CDF calculation. The discharge value is supplied by the caller.
    return_period_result = None
    if given_discharge is not None:
        p_non_exceedance = lognorm.cdf(
            given_discharge,
            s=shape,
            loc=loc,
            scale=scale
        )

        p_exceedance = 1 - p_non_exceedance

        return_period = 1 / p_exceedance

        print(f"Given discharge = {given_discharge:.2f} m³/s")
        print(f"Non-exceedance probability = {p_non_exceedance:.6f}")
        print(f"Exceedance probability = {p_exceedance:.6f}")
        print(f"Return period = {return_period:.2f} years")

        return_period_result = {
            "given_discharge": given_discharge,
            "p_non_exceedance": p_non_exceedance,
            "p_exceedance": p_exceedance,
            "return_period": return_period,
        }

    # Given return period → design discharge, inverse of the same Lognormal
    # (floc=0) relationship: F(x) = 1 - 1/T, x = lognorm.ppf(F, ...).
    design_quantile_rows = []
    for T in DESIGN_RETURN_PERIODS:
        p_non_exceedance_T = 1.0 - 1.0 / T
        design_peak = lognorm.ppf(
            p_non_exceedance_T,
            s=shape,
            loc=loc,
            scale=scale,
        )
        design_quantile_rows.append({
            "Return Period (T)": T,
            "Design Peak": design_peak,
        })
        print(f"T = {T} years, Design Peak = {design_peak:.4f} m³/s")

    design_quantiles = pd.DataFrame(design_quantile_rows)

    output = {
        "series": series,
        "file_path": file_path,
        "n_peaks": int(len(ams)),
        "peak_describe": ams.describe(),
        "fitted_params": fitted_params,
        "distribution_comparison": results_df,
        "ks_results": ks_df,
        "comparison": comparison,
        "lognormal_floc0_params": {
            "shape": shape,
            "loc": loc,
            "scale": scale,
        },
        "return_period": return_period_result,
        "design_quantiles": design_quantiles,
        "figures": figures,
    }

    if series != "POT":
        return output

    # ============================================================
    # univariate POT excess analysis
    # Uses processed POT peaks and the existing threshold.
    # ============================================================

    threshold = THRESHOLD
    pot_q = ams.values

    # Excess above threshold
    pot_excess = pot_q - threshold

    print("Number of independent POT events:", len(pot_excess))
    print("Minimum excess:", pot_excess.min())
    print("Maximum excess:", pot_excess.max())

    # Check that all are actually above the threshold
    print("All exceed threshold:", np.all(pot_q > threshold))

    plt.figure(figsize=(8, 5))

    plt.hist(pot_excess, bins=10, density=True, edgecolor="black")

    plt.xlabel("Excess discharge, Q - u (m³/s)")
    plt.ylabel("Density")
    plt.title("POT Excess Discharge Distribution")

    figures.append({
        "title": "POT Excess Discharge Distribution",
        "image_base64": _capture_current_figure(),
    })

    pot_distributions = {
        "Exponential": expon,
        "Gamma": gamma,
        "Lognormal": lognorm,
        "Weibull": weibull_min,
        "Generalized Pareto": genpareto
    }

    pot_results = []

    for name, dist in pot_distributions.items():

        # Fit distribution
        params = dist.fit(pot_excess)

        # Log-likelihood
        loglik = np.sum(dist.logpdf(pot_excess, *params))

        # Number of parameters
        k = len(params)

        # AIC
        aic = 2*k - 2*loglik

        # BIC
        bic = k*np.log(len(pot_excess)) - 2*loglik

        # KS test
        ks_stat, ks_p = stats.kstest(
            pot_excess,
            dist.cdf,
            args=params
        )

        pot_results.append([
            name,
            loglik,
            aic,
            bic,
            ks_stat,
            ks_p
        ])

    pot_results_df = pd.DataFrame(
        pot_results,
        columns=[
            "Distribution",
            "LogLikelihood",
            "AIC",
            "BIC",
            "KS Statistic",
            "KS p-value"
        ]
    )

    pot_results_df["AIC_Rank"] = pot_results_df["AIC"].rank(method="min")
    pot_results_df["BIC_Rank"] = pot_results_df["BIC"].rank(method="min")
    pot_results_df["Mean_Rank"] = (
        pot_results_df["AIC_Rank"] + pot_results_df["BIC_Rank"]
    ) / 2
    pot_results_df = pot_results_df.sort_values(
        by=["Mean_Rank", "AIC", "BIC"]
    ).reset_index(drop=True)

    print(pot_results_df.to_string(index=False))

    # Sort excesses
    x = np.sort(pot_excess)

    # Empirical CDF
    n = len(x)
    empirical_cdf = np.arange(1, n + 1) / n

    plt.figure(figsize=(9, 6))

    # Empirical CDF
    plt.step(
        x,
        empirical_cdf,
        where="post",
        label="Empirical CDF",
        linewidth=2
    )

    # Fitted distributions
    for name, dist in pot_distributions.items():

        params = dist.fit(pot_excess)

        theoretical_cdf = dist.cdf(x, *params)

        plt.plot(
            x,
            theoretical_cdf,
            label=name
        )

    plt.xlabel("Excess discharge, Q - u (m³/s)")
    plt.ylabel("Cumulative Probability")
    plt.title("POT Excess: Empirical CDF vs Fitted Distributions")
    plt.legend()
    plt.grid(alpha=0.3)

    figures.append({
        "title": "POT Excess: Empirical CDF vs Fitted Distributions",
        "image_base64": _capture_current_figure(),
    })

    fig, axes = plt.subplots(2, 3, figsize=(14, 9))
    axes = axes.flatten()

    for i, (name, dist) in enumerate(pot_distributions.items()):

        params = dist.fit(pot_excess)

        # Theoretical probabilities
        p = (np.arange(1, n + 1) - 0.5) / n

        # Theoretical quantiles
        theoretical_q = dist.ppf(p, *params)

        # Observed quantiles
        observed_q = np.sort(pot_excess)

        axes[i].scatter(
            theoretical_q,
            observed_q,
            s=25
        )

        # 45-degree reference line
        min_val = min(theoretical_q.min(), observed_q.min())
        max_val = max(theoretical_q.max(), observed_q.max())

        axes[i].plot(
            [min_val, max_val],
            [min_val, max_val],
            linestyle="--"
        )

        axes[i].set_title(name)
        axes[i].set_xlabel("Theoretical Quantiles")
        axes[i].set_ylabel("Observed Quantiles")
        axes[i].grid(alpha=0.3)

    # Hide unused sixth subplot
    axes[-1].axis("off")

    plt.tight_layout()
    figures.append({
        "title": "POT Excess QQ Plots",
        "image_base64": _capture_current_figure(),
    })

    gpd_params = genpareto.fit(pot_excess)

    print("GPD parameters:")
    print("Shape (xi) =", gpd_params[0])
    print("Location =", gpd_params[1])
    print("Scale =", gpd_params[2])

    output["threshold"] = threshold
    output["n_pot_events"] = int(len(pot_excess))
    output["pot_excess_min"] = float(pot_excess.min())
    output["pot_excess_max"] = float(pot_excess.max())
    output["all_exceed_threshold"] = bool(np.all(pot_q > threshold))
    output["pot_excess_comparison"] = pot_results_df
    output["gpd_params"] = {
        "shape": gpd_params[0],
        "location": gpd_params[1],
        "scale": gpd_params[2],
    }
    output["figures"] = figures

    return output


if __name__ == "__main__":
    series_arg = sys.argv[1] if len(sys.argv) > 1 else "AMS"
    discharge_arg = float(sys.argv[2]) if len(sys.argv) > 2 else None
    run_univariate(series_arg, given_discharge=discharge_arg)
