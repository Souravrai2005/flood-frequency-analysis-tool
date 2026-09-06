import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AnalysisProvider } from "./context/AnalysisContext.jsx";
import AppLayout from "./layouts/AppLayout.jsx";
import HomePage from "./pages/HomePage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DataPage from "./pages/DataPage.jsx";
import UnivariatePage from "./pages/UnivariatePage.jsx";
import BivariatePage from "./pages/BivariatePage.jsx";
import TrivariatePage from "./pages/TrivariatePage.jsx";
import ClassificationPage from "./pages/ClassificationPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";
import MethodologyPage from "./pages/MethodologyPage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <AnalysisProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/univariate" element={<UnivariatePage />} />
          <Route path="/bivariate" element={<BivariatePage />} />
          <Route path="/trivariate" element={<TrivariatePage />} />
          <Route path="/classification" element={<ClassificationPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </AnalysisProvider>
    </BrowserRouter>
  );
}
