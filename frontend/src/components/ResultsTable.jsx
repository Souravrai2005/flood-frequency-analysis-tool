import EmptyState from "./EmptyState.jsx";
import { formatValue } from "../utils/display.js";

export default function ResultsTable({
  columns,
  rows = [],
  emptyTitle = "No analysis run yet",
  emptyText = "Tabulated results will appear here after the analysis service returns data.",
}) {
  if (!rows.length) {
    return (
      <div>
        <div className="table-wrap table-wrap-empty">
          <table className="results-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        <EmptyState title={emptyTitle}>{emptyText}</EmptyState>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="results-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>{formatValue(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
