# -*- coding: utf-8 -*-
"""Bivariate analysis.

Callable pipeline: run_bivariate("AMS") or run_bivariate("POT").
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
import seaborn as sns

from scipy import stats
from scipy import optimize
from scipy.stats import rankdata, kendalltau, multivariate_t
from scipy.special import digamma

from statsmodels.distributions.copula.api import (
    FrankCopula,
    ClaytonCopula,
    GumbelCopula,
    StudentTCopula
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

PVD_DATASETS = {
    "AMS": PROJECT_ROOT / "data" / "processed" / "AMS_PVD_final_dataset.xlsx",
    "POT": PROJECT_ROOT / "data" / "processed" / "POT_PVD_final_dataset.xlsx",
}

distributions = {
    "Lognormal": stats.lognorm,
    "Gamma": stats.gamma,
    "Weibull": stats.weibull_min,
    "Gumbel": stats.gumbel_r,
    "GEV": stats.genextreme
}

T_targets = [2, 5, 10, 25, 50, 100]


def _capture_current_figure():
    fig = plt.gcf()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")



def fit_marginal_distribution(data, distributions, alpha=0.05):

    data = np.asarray(data, dtype=float)
    data = data[np.isfinite(data)]

    results = []

    n = len(data)

    for name, dist in distributions.items():

        try:
            # ------------------------------------------------
            # 1. Fit distribution
            # ------------------------------------------------
            params = dist.fit(data)

            # ------------------------------------------------
            # 2. Log-likelihood
            # ------------------------------------------------
            logpdf = dist.logpdf(data, *params)

            # Check for invalid likelihood
            if not np.all(np.isfinite(logpdf)):
                raise ValueError("Invalid log-likelihood")

            loglik = np.sum(logpdf)

            # Number of fitted parameters
            k = len(params)

            # ------------------------------------------------
            # 3. AIC
            # ------------------------------------------------
            aic = 2 * k - 2 * loglik

            # ------------------------------------------------
            # 4. BIC
            # ------------------------------------------------
            bic = k * np.log(n) - 2 * loglik

            # ------------------------------------------------
            # 5. Anderson-Darling test
            # ------------------------------------------------
            #
            # scipy's anderson() does NOT directly support
            # arbitrary fitted distributions.
            #
            # Therefore use the probability-integral
            # transformation:
            #
            # U = F(X)
            #
            # and calculate the AD statistic for U ~ Uniform(0,1)
            # ------------------------------------------------

            cdf_values = dist.cdf(data, *params)

            # Avoid exactly 0 and 1
            cdf_values = np.clip(
                cdf_values,
                1e-10,
                1 - 1e-10
            )

            # Sort the transformed observations
            u = np.sort(cdf_values)

            i = np.arange(1, n + 1)

            ad_stat = -n - np.sum(
                (2 * i - 1) / n *
                (
                    np.log(u) +
                    np.log(1 - u[::-1])
                )
            )

            results.append({
                "Distribution": name,
                "LogLikelihood": loglik,
                "AIC": aic,
                "BIC": bic,
                "AD_Statistic": ad_stat,
                "Parameters": params
            })

        except Exception:

            results.append({
                "Distribution": name,
                "LogLikelihood": np.nan,
                "AIC": np.nan,
                "BIC": np.nan,
                "AD_Statistic": np.nan,
                "Parameters": None
            })


    results_df = pd.DataFrame(results)


    # ========================================================
    # AIC AND BIC RANKING
    # ========================================================

    results_df["AIC_Rank"] = (
        results_df["AIC"]
        .rank(method="min")
    )

    results_df["BIC_Rank"] = (
        results_df["BIC"]
        .rank(method="min")
    )


    # ========================================================
    # COMBINED AIC/BIC RANK
    #
    # Lower is better.
    # ========================================================

    results_df["Mean_Rank"] = (
        results_df["AIC_Rank"] +
        results_df["BIC_Rank"]
    ) / 2


    # ========================================================
    # ORDER DISTRIBUTIONS
    # ========================================================

    ranked_results = results_df.sort_values(
        by=["Mean_Rank", "AIC", "BIC"]
    ).reset_index(drop=True)


    # ========================================================
    # AD VALIDATION
    #
    # AD critical value at 5% significance level
    # for the uniform-transformed statistic is approximately
    # 2.492.
    #
    # H0: Data follow the fitted distribution
    #
    # AD <= critical value -> PASS
    # AD > critical value  -> FAIL
    # ========================================================

    AD_CRITICAL_5 = 2.492

    ranked_results["AD_Pass_5pct"] = (
        ranked_results["AD_Statistic"] <= AD_CRITICAL_5
    )


    # ========================================================
    # SELECT DISTRIBUTION
    #
    # Start with best AIC/BIC candidate.
    # If it fails AD, move to next candidate.
    # ========================================================

    selected = None

    for _, row in ranked_results.iterrows():

        if (
            np.isfinite(row["AD_Statistic"])
            and row["AD_Pass_5pct"]
        ):
            selected = row
            break


    # --------------------------------------------------------
    # If no candidate passes AD
    # --------------------------------------------------------

    if selected is None:

        print(
            "WARNING: No fitted distribution passed "
            "the AD test at 5% significance."
        )

        # In this case retain the best AIC/BIC candidate
        selected = ranked_results.iloc[0]


    selected_distribution = selected["Distribution"]
    selected_parameters = selected["Parameters"]

    selected_dist = distributions[selected_distribution]


    return (
        ranked_results,
        selected_distribution,
        selected_parameters,
        selected_dist
    )

def plot_cdf_comparison(data, variable_name):

    # Sort data for empirical CDF
    x_emp = np.sort(data)

    # Empirical CDF
    y_emp = np.arange(1, len(data) + 1) / len(data)

    # Smooth x-axis for fitted distributions
    x_fit = np.linspace(
        np.min(data),
        np.max(data),
        500
    )

    plt.figure(figsize=(10, 6))

    # Empirical CDF
    plt.step(
        x_emp,
        y_emp,
        where="post",
        linewidth=2.5,
        label="Empirical CDF"
    )

    # Fit and plot each candidate distribution
    for name, dist in distributions.items():

        try:

            # Estimate distribution parameters
            params = dist.fit(data)

            # Calculate fitted CDF
            y_fit = dist.cdf(
                x_fit,
                *params
            )

            # Avoid plotting invalid results
            if np.all(np.isfinite(y_fit)):

                plt.plot(
                    x_fit,
                    y_fit,
                    linewidth=1.5,
                    label=name
                )

        except Exception as e:

            print(
                f"{name} could not be fitted "
                f"for {variable_name}: {e}"
            )

    plt.xlabel(variable_name)
    plt.ylabel("Cumulative Probability")

    plt.title(
        f"{variable_name}: Empirical CDF vs Candidate Distributions"
    )

    plt.legend()
    plt.grid(True, alpha=0.3)

    plt.tight_layout()
    return _capture_current_figure()


def qq_plot(data, distribution, params, title):

    data = np.sort(data)
    n = len(data)

    # Empirical probabilities
    p = (np.arange(1, n + 1) - 0.5) / n

    # Theoretical quantiles
    theoretical = distribution.ppf(p, *params)

    plt.figure(figsize=(7, 6))

    plt.scatter(theoretical, data)

    # 45-degree reference line
    mn = min(theoretical.min(), data.min())
    mx = max(theoretical.max(), data.max())

    plt.plot([mn, mx], [mn, mx], '--')

    plt.xlabel("Theoretical Quantiles")
    plt.ylabel("Observed Quantiles")
    plt.title(title)

    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    return _capture_current_figure()


def joe_cdf(u, v, theta):

    """
    Bivariate Joe copula CDF.

    C(u,v) =
    1 - [
        (1-u)^theta
        + (1-v)^theta
        - (1-u)^theta (1-v)^theta
    ]^(1/theta)

    theta >= 1
    """

    if theta < 1:
        raise ValueError(
            "Joe copula requires theta >= 1."
        )

    u = np.asarray(u, dtype=float)
    v = np.asarray(v, dtype=float)

    u = np.clip(
        u,
        1e-10,
        1 - 1e-10
    )

    v = np.clip(
        v,
        1e-10,
        1 - 1e-10
    )

    A = (1 - u) ** theta
    B = (1 - v) ** theta

    S = A + B - A * B

    C = 1 - S ** (1 / theta)

    return C


# =========================================================
# 2. JOE COPULA PDF
# =========================================================

def joe_pdf(u, v, theta):

    """
    Bivariate Joe copula density.

    theta >= 1
    """

    if theta < 1:
        return np.full_like(
            np.asarray(u, dtype=float),
            np.nan
        )

    u = np.asarray(u, dtype=float)
    v = np.asarray(v, dtype=float)

    u = np.clip(
        u,
        1e-10,
        1 - 1e-10
    )

    v = np.clip(
        v,
        1e-10,
        1 - 1e-10
    )

    A = (1 - u) ** theta
    B = (1 - v) ** theta

    S = A + B - A * B

    eta = theta - 1

    density = (
        S ** (-2 + 1 / theta)
        *
        (1 - u) ** eta
        *
        (1 - v) ** eta
        *
        (eta + S)
    )

    return density


# =========================================================
# 3. LOG-LIKELIHOOD HELPER
# =========================================================

def calculate_loglik_from_pdf(pdf):

    pdf = np.asarray(
        pdf,
        dtype=float
    )

    if np.any(
        ~np.isfinite(pdf)
    ):
        return np.nan

    if np.any(
        pdf <= 0
    ):
        return np.nan

    return np.sum(
        np.log(pdf)
    )


# =========================================================
# 4. FIT BIVARIATE COPULAS
# =========================================================

def fit_bivariate_copulas(data):

    # -----------------------------------------------------
    # Convert input to numpy array
    # -----------------------------------------------------

    data = np.asarray(
        data,
        dtype=float
    )

    # -----------------------------------------------------
    # Remove invalid rows
    # -----------------------------------------------------

    data = data[
        np.all(
            np.isfinite(data),
            axis=1
        )
    ]

    # -----------------------------------------------------
    # Check dimensions
    # -----------------------------------------------------

    if data.shape[1] != 2:

        raise ValueError(
            "Input data must contain exactly "
            "two columns."
        )

    n = len(data)

    if n < 5:

        raise ValueError(
            "At least 5 observations are required."
        )

    # -----------------------------------------------------
    # Separate U and V
    # -----------------------------------------------------

    u = data[:, 0]
    v = data[:, 1]

    # -----------------------------------------------------
    # Avoid exact 0 and 1
    # -----------------------------------------------------

    u = np.clip(
        u,
        1e-10,
        1 - 1e-10
    )

    v = np.clip(
        v,
        1e-10,
        1 - 1e-10
    )

    copula_data = np.column_stack(
        [u, v]
    )

    # =====================================================
    # KENDALL'S TAU
    # =====================================================

    tau, tau_pvalue = kendalltau(
        u,
        v
    )

    print(
        "\nKendall's tau =",
        tau
    )

    results = []

    # -----------------------------------------------------
    # IMPORTANT:
    #
    # Store actual fitted objects here.
    # -----------------------------------------------------

    fitted_copulas = {}


    # =====================================================
    # 1. FRANK COPULA
    # =====================================================

    try:

        frank = FrankCopula(
            k_dim=2
        )

        theta = frank.fit_corr_param(
            copula_data
        )

        fitted = FrankCopula(
            theta=theta,
            k_dim=2
        )

        logpdf = fitted.logpdf(
            copula_data
        )

        loglik = np.sum(
            logpdf
        )

        results.append({

            "Copula": "Frank",

            "Parameter": theta,

            "LogLikelihood": loglik,

            "NumParameters": 1

        })

        fitted_copulas["Frank"] = fitted

    except Exception as e:

        print(
            "Frank failed:",
            e
        )


    # =====================================================
    # 2. CLAYTON COPULA
    # =====================================================

    try:

        clayton = ClaytonCopula(
            k_dim=2
        )

        theta = clayton.fit_corr_param(
            copula_data
        )

        if (
            np.isfinite(theta)
            and
            abs(theta) > 1e-10
        ):

            fitted = ClaytonCopula(
                theta=theta,
                k_dim=2
            )

            logpdf = fitted.logpdf(
                copula_data
            )

            loglik = np.sum(
                logpdf
            )

            results.append({

                "Copula": "Clayton",

                "Parameter": theta,

                "LogLikelihood": loglik,

                "NumParameters": 1

            })

            fitted_copulas["Clayton"] = fitted

    except Exception as e:

        print(
            "Clayton failed:",
            e
        )


    # =====================================================
    # 3. GUMBEL COPULA
    # =====================================================

    try:

        gumbel = GumbelCopula(
            k_dim=2
        )

        theta = gumbel.fit_corr_param(
            copula_data
        )

        if (
            np.isfinite(theta)
            and
            theta >= 1
        ):

            fitted = GumbelCopula(
                theta=theta,
                k_dim=2
            )

            logpdf = fitted.logpdf(
                copula_data
            )

            loglik = np.sum(
                logpdf
            )

            results.append({

                "Copula": "Gumbel",

                "Parameter": theta,

                "LogLikelihood": loglik,

                "NumParameters": 1

            })

            fitted_copulas["Gumbel"] = fitted

    except Exception as e:

        print(
            "Gumbel failed:",
            e
        )


    # =====================================================
    # 4. JOE COPULA
    # =====================================================

    try:

        # -------------------------------------------------
        # Kendall's tau relation for Joe copula
        #
        # tau(theta) =
        #
        # 1 +
        # 2/(2-theta)
        # [
        #   psi(2)
        #   -
        #   psi(1 + 2/theta)
        # ]
        #
        # theta >= 1
        # -------------------------------------------------

        def joe_tau(theta):

            # Numerical treatment near theta = 2
            if abs(theta - 2) < 1e-6:

                theta = theta + 1e-6

            return (
                1
                +
                2 / (2 - theta)
                *
                (
                    digamma(2)
                    -
                    digamma(
                        1 + 2 / theta
                    )
                )
            )

        # -------------------------------------------------
        # Objective:
        #
        # Match theoretical tau to observed tau
        # -------------------------------------------------

        def objective(theta):

            model_tau = joe_tau(
                theta
            )

            return (
                model_tau - tau
            ) ** 2

        # -------------------------------------------------
        # Optimize theta
        # -------------------------------------------------

        opt = optimize.minimize_scalar(

            objective,

            bounds=(
                1.000001,
                100
            ),

            method="bounded"

        )

        theta = opt.x

        # -------------------------------------------------
        # Calculate Joe density
        # -------------------------------------------------

        pdf = joe_pdf(
            u,
            v,
            theta
        )

        loglik = calculate_loglik_from_pdf(
            pdf
        )

        if np.isfinite(loglik):

            results.append({

                "Copula": "Joe",

                "Parameter": theta,

                "LogLikelihood": loglik,

                "NumParameters": 1

            })

            # -------------------------------------------------
            # Store Joe as a custom fitted object.
            #
            # It provides a CDF that can be used later.
            # -------------------------------------------------

            fitted_copulas["Joe"] = {
                "theta": theta,
                "cdf": lambda x, y,
                       theta=theta:
                       joe_cdf(
                           x,
                           y,
                           theta
                       )
            }

    except Exception as e:

        print(
            "Joe failed:",
            e
        )


    # =====================================================
    # 5. STUDENT-t COPULA
    # =====================================================

    try:

        # -------------------------------------------------
        # Estimate correlation from Kendall's tau
        # -------------------------------------------------

        student_initial = StudentTCopula(

            corr=0.0,

            df=4,

            k_dim=2

        )

        rho = student_initial.corr_from_tau(
            tau
        )

        rho = np.clip(
            rho,
            -0.999,
            0.999
        )

        # -------------------------------------------------
        # Estimate degrees of freedom by ML
        # -------------------------------------------------

        def student_objective(df):

            if df <= 2:

                return np.inf

            copula = StudentTCopula(

                corr=rho,

                df=df,

                k_dim=2

            )

            logpdf = copula.logpdf(
                copula_data
            )

            if np.any(
                ~np.isfinite(logpdf)
            ):

                return np.inf

            return -np.sum(
                logpdf
            )

        # -------------------------------------------------
        # Optimize df
        # -------------------------------------------------

        opt = optimize.minimize_scalar(

            student_objective,

            bounds=(
                2.01,
                100
            ),

            method="bounded"

        )

        df_est = opt.x

        # -------------------------------------------------
        # Final fitted Student-t copula
        # -------------------------------------------------

        fitted = StudentTCopula(

            corr=rho,

            df=df_est,

            k_dim=2

        )

        logpdf = fitted.logpdf(
            copula_data
        )

        loglik = np.sum(
            logpdf
        )

        results.append({

            "Copula": "Student-t",

            "Parameter": {
                "rho": rho,
                "df": df_est
            },

            "LogLikelihood": loglik,

            "NumParameters": 2

        })

        fitted_copulas["Student-t"] = fitted

    except Exception as e:

        print(
            "Student-t failed:",
            e
        )


    # =====================================================
    # RESULTS DATAFRAME
    # =====================================================

    results_df = pd.DataFrame(
        results
    )


    # =====================================================
    # AIC
    # =====================================================

    results_df["AIC"] = (

        2
        *
        results_df["NumParameters"]

        -

        2
        *
        results_df["LogLikelihood"]

    )


    # =====================================================
    # BIC
    # =====================================================

    results_df["BIC"] = (

        results_df["NumParameters"]
        *
        np.log(n)

        -

        2
        *
        results_df["LogLikelihood"]

    )


    # =====================================================
    # AIC RANK
    # =====================================================

    results_df["AIC_Rank"] = (

        results_df["AIC"]
        .rank(
            method="min",
            ascending=True
        )

    )


    # =====================================================
    # BIC RANK
    # =====================================================

    results_df["BIC_Rank"] = (

        results_df["BIC"]
        .rank(
            method="min",
            ascending=True
        )

    )


    # =====================================================
    # MEAN RANK
    # =====================================================

    results_df["Mean_Rank"] = (

        results_df["AIC_Rank"]
        +
        results_df["BIC_Rank"]

    ) / 2


    # =====================================================
    # SORT
    # =====================================================

    ranked_results = (

        results_df

        .sort_values(

            by=[
                "Mean_Rank",
                "AIC",
                "BIC"
            ]

        )

        .reset_index(
            drop=True
        )

    )


    # =====================================================
    # SELECT BEST COPULA
    # =====================================================

    best = ranked_results.iloc[0]

    selected_copula = best["Copula"]

    selected_parameter = best["Parameter"]

    # -----------------------------------------------------
    # Retrieve ACTUAL fitted object
    # -----------------------------------------------------

    selected_copula_object = (
        fitted_copulas[
            selected_copula
        ]
    )


    # =====================================================
    # RETURN EVERYTHING
    # =====================================================

    ranked_results["Kendall_tau"] = tau

    return (

        ranked_results,

        selected_copula,

        selected_parameter,

        selected_copula_object,

        tau,

    )

def calculate_joint_return_periods(copula_obj, u_vals, v_vals, T_values, copula_name):
    """
    Calculates Joint AND/OR return periods for given marginal probabilities.
    For AMS data, T_univariate = 1 / (1 - P).
    """
    def get_cdf(u, v):
        if isinstance(copula_obj, dict): # Custom Joe implementation
            return copula_obj['cdf'](u, v)
        elif copula_name == 'Student-t':
            # For Student-t, we need to transform uniforms to t-quantiles
            df_param = copula_obj.df
            rho = copula_obj.corr[0, 1]
            # Theoretical quantiles
            x = stats.t.ppf(u, df=df_param)
            y = stats.t.ppf(v, df=df_param)
            # Bivariate t-distribution CDF
            cov = [[1, rho], [rho, 1]]
            return multivariate_t.cdf([x, y], shape=cov, df=df_param)
        else: # Other statsmodels objects (Frank, Clayton, Gumbel)
            return copula_obj.cdf(np.array([[u, v]]))[0]

    results = []
    for T in T_values:
        p = 1 - 1/T
        C_p = get_cdf(p, p)

        t_or = 1 / (1 - C_p)
        t_and = 1 / (1 - p - p + C_p)

        results.append({
            "Return Period (T)": T,
            "Joint OR (T_or)": t_or,
            "Joint AND (T_and)": t_and
        })

    return pd.DataFrame(results)


def run_bivariate(series):
    series = str(series).upper()
    if series not in PVD_DATASETS:
        raise ValueError('series must be "AMS" or "POT"')

    figures = []
    file_path = PVD_DATASETS[series]

    df = pd.read_excel(file_path)

    print(df.head())
    print(df.shape)
    print(df.info())

    describe_df = df[["Peakvalue", "Volume", "Duration"]].describe()
    skew_s = df[["Peakvalue", "Volume", "Duration"]].skew()

    cv = (
        df[["Peakvalue", "Volume", "Duration"]].std()
        / df[["Peakvalue", "Volume", "Duration"]].mean()
    )

    print(cv)

    corr_pearson = df[["Peakvalue", "Volume", "Duration"]].corr(
        method="pearson"
    )

    print(corr_pearson)

    corr_spearman = df[["Peakvalue", "Volume", "Duration"]].corr(
        method="spearman"
    )

    print(corr_spearman)

    variables = ["Peakvalue", "Volume", "Duration"]

    for col in variables:
        plt.figure(figsize=(7,5))
        plt.hist(df[col], bins=10, edgecolor="black")
        plt.xlabel(col)
        plt.ylabel("Frequency")
        plt.title(f"Distribution of {col}")
        figures.append({
            "title": f"Distribution of {col}",
            "image_base64": _capture_current_figure(),
        })

    for col in variables:
        plt.figure(figsize=(7,4))
        sns.boxplot(x=df[col])
        plt.title(f"Boxplot of {col}")
        figures.append({
            "title": f"Boxplot of {col}",
            "image_base64": _capture_current_figure(),
        })

    pairs = [
        ("Peakvalue", "Volume"),
        ("Peakvalue", "Duration"),
        ("Volume", "Duration")
    ]

    for x, y in pairs:
        plt.figure(figsize=(7,5))
        plt.scatter(df[x], df[y])
        plt.xlabel(x)
        plt.ylabel(y)
        plt.title(f"{x} vs {y}")
        plt.grid(True, alpha=0.3)
        figures.append({
            "title": f"{x} vs {y}",
            "image_base64": _capture_current_figure(),
        })

    n = len(df)

    U_peak = rankdata(df["Peakvalue"]) / (n + 1)
    U_volume = rankdata(df["Volume"]) / (n + 1)
    U_duration = rankdata(df["Duration"]) / (n + 1)

    U = pd.DataFrame({
        "Peak": U_peak,
        "Volume": U_volume,
        "Duration": U_duration
    })

    plt.figure(figsize=(7,5))

    plt.scatter(U["Peak"], U["Volume"])

    plt.xlabel("U(Peak)")
    plt.ylabel("U(Volume)")
    plt.title("Peak–Volume Copula Data")
    plt.grid(True, alpha=0.3)

    figures.append({
        "title": "Peak–Volume Copula Data",
        "image_base64": _capture_current_figure(),
    })
    plt.figure(figsize=(7,5))

    plt.scatter(U["Peak"], U["Duration"])

    plt.xlabel("U(Peak)")
    plt.ylabel("U(Duration)")
    plt.title("Peak–Duration Copula Data")
    plt.grid(True, alpha=0.3)

    figures.append({
        "title": "Peak–Duration Copula Data",
        "image_base64": _capture_current_figure(),
    })
    plt.figure(figsize=(7,5))

    plt.scatter(U["Volume"], U["Duration"])

    plt.xlabel("U(Volume)")
    plt.ylabel("U(Duration)")
    plt.title("Volume–Duration Copula Data")
    plt.grid(True, alpha=0.3)

    figures.append({
        "title": "Volume–Duration Copula Data",
        "image_base64": _capture_current_figure(),
    })

    peak_results, peak_name, peak_params, peak_dist = fit_marginal_distribution(
        df["Peakvalue"].values, distributions
    )

    volume_results, volume_name, volume_params, volume_dist = fit_marginal_distribution(
        df["Volume"].values, distributions
    )

    duration_results, duration_name, duration_params, duration_dist = fit_marginal_distribution(
        df["Duration"].values, distributions
    )

    print("\nPEAK")
    print(peak_results)

    print("\nSelected:", peak_dist)
    print("Parameters:", peak_params)


    print("\nVOLUME")
    print(volume_results)

    print("\nSelected:", volume_dist)
    print("Parameters:", volume_params)


    print("\nDURATION")
    print(duration_results)

    print("\nSelected:", duration_dist)
    print("Parameters:", duration_params)

    df = pd.read_excel(file_path)

    peak = df["Peakvalue"].dropna().values
    volume = df["Volume"].dropna().values
    duration = df["Duration"].dropna().values

    figures.append({
        "title": "Peakvalue: Empirical CDF vs Candidate Distributions",
        "image_base64": plot_cdf_comparison(peak, "Peakvalue"),
    })

    figures.append({
        "title": "Volume: Empirical CDF vs Candidate Distributions",
        "image_base64": plot_cdf_comparison(volume, "Volume"),
    })

    figures.append({
        "title": "Duration: Empirical CDF vs Candidate Distributions",
        "image_base64": plot_cdf_comparison(duration, "Duration"),
    })

    figures.append({
        "title": "QQ Plot – Peakvalue (Lognormal)",
        "image_base64": qq_plot(
            df["Peakvalue"].dropna().values,
            stats.lognorm,
            peak_params,
            "QQ Plot – Peakvalue (Lognormal)"
        ),
    })

    figures.append({
        "title": "QQ Plot – Volume (Lognormal)",
        "image_base64": qq_plot(
            df["Volume"].dropna().values,
            stats.lognorm,
            volume_params,
            "QQ Plot – Volume (Lognormal)"
        ),
    })

    figures.append({
        "title": "QQ Plot – Duration (Weibull)",
        "image_base64": qq_plot(
            df["Duration"].dropna().values,
            stats.weibull_min,
            duration_params,
            "QQ Plot – Duration (Weibull)"
        ),
    })

    peak = df["Peakvalue"].values
    volume = df["Volume"].values
    duration = df["Duration"].values

    u = peak_dist.cdf(peak, *peak_params)
    v = volume_dist.cdf(volume, *volume_params)
    w = duration_dist.cdf(duration, *duration_params)

    cdf_df = pd.DataFrame({
        "Peakvalue": peak,
        "Volume": volume,
        "Duration": duration,
        "U_Peak": u,
        "U_Volume": v,
        "U_Duration": w
    })

    print("\nSelected marginal distributions:")
    print("Peak     :", peak_name)
    print("Volume   :", volume_name)
    print("Duration :", duration_name)

    print("\nFitted marginal CDF values:")
    print(cdf_df)

    PV = cdf_df[
        ["U_Peak", "U_Volume"]
    ].values

    PD = cdf_df[
        ["U_Peak", "U_Duration"]
    ].values

    VD = cdf_df[
        ["U_Volume", "U_Duration"]
    ].values

    PV_results, PV_selected, PV_parameter, PV_copula, PV_tau = \
        fit_bivariate_copulas(PV)
    PD_results, PD_selected, PD_parameter, PD_copula, PD_tau = \
        fit_bivariate_copulas(PD)
    VD_results, VD_selected, VD_parameter, VD_copula, VD_tau = \
        fit_bivariate_copulas(VD)

    print("\n========================================")
    print("PEAK - VOLUME")
    print("========================================")

    print(PV_results)

    print("\nSelected Copula:", PV_selected)
    print("Parameter:", PV_parameter)


    print("\n========================================")
    print("PEAK - DURATION")
    print("========================================")

    print(PD_results)

    print("\nSelected Copula:", PD_selected)
    print("Parameter:", PD_parameter)


    print("\n========================================")
    print("VOLUME - DURATION")
    print("========================================")

    print(VD_results)

    print("\nSelected Copula:", VD_selected)
    print("Parameter:", VD_parameter)

    pv_rp = calculate_joint_return_periods(PV_copula, None, None, T_targets, PV_selected)
    pd_rp = calculate_joint_return_periods(PD_copula, None, None, T_targets, PD_selected)
    vd_rp = calculate_joint_return_periods(VD_copula, None, None, T_targets, VD_selected)

    print("--- Joint Return Periods: Peak & Volume (Student-t) ---")
    print(pv_rp)

    print("\n--- Joint Return Periods: Peak & Duration (Joe) ---")
    print(pd_rp)

    print("\n--- Joint Return Periods: Volume & Duration (Clayton) ---")
    print(vd_rp)

    return {
        "series": series,
        "file_path": file_path,
        "n_events": int(len(df)),
        "describe": describe_df,
        "skew": skew_s,
        "cv": cv,
        "corr_pearson": corr_pearson,
        "corr_spearman": corr_spearman,
        "peak_results": peak_results,
        "volume_results": volume_results,
        "duration_results": duration_results,
        "selected_marginals": {
            "Peak": {"name": peak_name, "parameters": peak_params},
            "Volume": {"name": volume_name, "parameters": volume_params},
            "Duration": {"name": duration_name, "parameters": duration_params},
        },
        "cdf_df": cdf_df,
        "PV_results": PV_results,
        "PD_results": PD_results,
        "VD_results": VD_results,
        "selected_copulas": {
            "Peak_Volume": {
                "name": PV_selected,
                "parameter": PV_parameter,
                "tau": float(PV_tau),
            },
            "Peak_Duration": {
                "name": PD_selected,
                "parameter": PD_parameter,
                "tau": float(PD_tau),
            },
            "Volume_Duration": {
                "name": VD_selected,
                "parameter": VD_parameter,
                "tau": float(VD_tau),
            },
        },
        "pv_rp": pv_rp,
        "pd_rp": pd_rp,
        "vd_rp": vd_rp,
        "figures": figures,
    }


if __name__ == "__main__":
    series_arg = sys.argv[1] if len(sys.argv) > 1 else "AMS"
    run_bivariate(series_arg)
