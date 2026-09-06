export const RETURN_PERIODS = [2, 5, 10, 25, 50, 100];

export const CLASSIFICATION_TYPES = [
  "P-V",
  "V-D",
  "P-D",
  "Extreme",
  "Low-intensity",
  "Other",
];

export const DATASET_CATALOG = {
  AMS: {
    label: "Annual Maximum Series",
    short: "AMS",
    univariate: {
      file: "AMS_Univariate_Dataset.xlsx",
      path: "data/processed/AMS_Univariate_Dataset.xlsx",
      purpose: "Annual maximum peak discharge series for univariate frequency analysis.",
      columns: [
        { name: "Date", meaning: "Date of the annual maximum peak" },
        { name: "Peak", meaning: "Peak discharge (m³/s)" },
      ],
    },
    pvd: {
      file: "AMS_PVD_final_dataset.xlsx",
      path: "data/processed/AMS_PVD_final_dataset.xlsx",
      purpose: "Annual-maximum flood events with peak, volume, and duration.",
      columns: [
        { name: "Peakvalue", meaning: "Event peak discharge (m³/s)" },
        { name: "Volume", meaning: "Event flood volume" },
        { name: "Duration", meaning: "Event duration (days)" },
      ],
    },
  },
  POT: {
    label: "Peaks Over Threshold",
    short: "POT",
    univariate: {
      file: "POT_Univariate_Dataset.xlsx",
      path: "data/processed/POT_Univariate_Dataset.xlsx",
      purpose: "Independent peaks-over-threshold series for univariate frequency analysis.",
      columns: [
        { name: "Date", meaning: "Date of the independent peak" },
        { name: "Peak", meaning: "Peak discharge (m³/s)" },
      ],
    },
    pvd: {
      file: "POT_PVD_final_dataset.xlsx",
      path: "data/processed/POT_PVD_final_dataset.xlsx",
      purpose: "Peaks-over-threshold flood events with peak, volume, and duration.",
      columns: [
        { name: "Peakvalue", meaning: "Event peak discharge (m³/s)" },
        { name: "Volume", meaning: "Event flood volume" },
        { name: "Duration", meaning: "Event duration (days)" },
      ],
    },
  },
};

export const ANALYSIS_MODULES = [
  {
    to: "/univariate",
    title: "Univariate analysis",
    text: "Fit marginal distributions to AMS or POT peaks and estimate return periods.",
  },
  {
    to: "/bivariate",
    title: "Bivariate analysis",
    text: "Copula models for peak–volume, peak–duration, and volume–duration.",
  },
  {
    to: "/classification",
    title: "Flood classification",
    text: "Median-based P–V–D typology of flood events.",
  },
  {
    to: "/trivariate",
    title: "Trivariate analysis",
    text: "Reserved for a future three-variable copula module.",
    future: true,
  },
];
