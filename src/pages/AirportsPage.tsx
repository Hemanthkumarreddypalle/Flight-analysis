import type { DashboardRow } from "../dashboardBinding";
import DatasetPage, {
  type DatasetMetric,
  type DatasetPieSlice,
  type DatasetTableColumn,
} from "./DatasetPage";

function formatNumber(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }
  return `${value.toFixed(1)}${suffix}`;
}

function buildMetrics(rows: DashboardRow[]): DatasetMetric[] {
  const depValues = rows.map((row) => row.averageDepDelay).filter((v): v is number => v != null);
  const arrValues = rows.map((row) => row.averageArrDelay).filter((v): v is number => v != null);
  const complete = rows.filter((row) => row.completeHistory).length;

  const avgDep = depValues.length === 0
    ? null
    : depValues.reduce((sum, value) => sum + value, 0) / depValues.length;
  const avgArr = arrValues.length === 0
    ? null
    : arrValues.reduce((sum, value) => sum + value, 0) / arrValues.length;

  return [
    { label: "Total Airports", value: String(rows.length) },
    { label: "Avg Dep Delay", value: formatNumber(avgDep, " min") },
    { label: "Avg Arr Delay", value: formatNumber(avgArr, " min") },
    { label: "Complete History", value: String(complete) },
  ];
}

function buildPieSlices(rows: DashboardRow[]): DatasetPieSlice[] {
  const low = rows.filter((row) => (row.averageDepDelay ?? 0) < 5).length;
  const medium = rows.filter((row) => {
    const value = row.averageDepDelay ?? 0;
    return value >= 5 && value < 15;
  }).length;
  const high = rows.filter((row) => (row.averageDepDelay ?? 0) >= 15).length;

  return [
    { label: "Low Delay (<5)", value: low, color: "#22c55e" },
    { label: "Medium Delay (5-15)", value: medium, color: "#f59e0b" },
    { label: "High Delay (>=15)", value: high, color: "#ef4444" },
  ];
}

const tableColumns: DatasetTableColumn[] = [
  { header: "Airport ID", getValue: (row) => row.id },
  { header: "Airport Name", getValue: (row) => row.name },
  { header: "State", getValue: (row) => row.stateCode },
  { header: "City", getValue: (row) => row.city },
  { header: "Avg Dep Delay", getValue: (row) => formatNumber(row.averageDepDelay, " min") },
  { header: "Avg Arr Delay", getValue: (row) => formatNumber(row.averageArrDelay, " min") },
  { header: "Flights", getValue: (row) => formatNumber(row.departingFlightCount) },
  { header: "Complete", getValue: (row) => (row.completeHistory ? "Yes" : "No") },
];

function AirportsPage() {
  return (
    <DatasetPage
      datasetId="example-airport"
      buildMetrics={buildMetrics}
      buildPieSlices={buildPieSlices}
      tableColumns={tableColumns}
      tableTitle="Airport Data Table"
    />
  );
}

export default AirportsPage;
