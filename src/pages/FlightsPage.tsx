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
  const delayed = rows.filter((row) => (row.averageDepDelay ?? 0) > 0).length;

  const avgDep = depValues.length === 0
    ? null
    : depValues.reduce((sum, value) => sum + value, 0) / depValues.length;
  const avgArr = arrValues.length === 0
    ? null
    : arrValues.reduce((sum, value) => sum + value, 0) / arrValues.length;

  return [
    { label: "Total Flights", value: String(rows.length) },
    { label: "Delayed Departures", value: String(delayed) },
    { label: "Avg Dep Delay", value: formatNumber(avgDep, " min") },
    { label: "Avg Arr Delay", value: formatNumber(avgArr, " min") },
  ];
}

function buildPieSlices(rows: DashboardRow[]): DatasetPieSlice[] {
  const onTime = rows.filter((row) => (row.averageDepDelay ?? 0) <= 0).length;
  const minor = rows.filter((row) => {
    const value = row.averageDepDelay ?? 0;
    return value > 0 && value <= 15;
  }).length;
  const major = rows.filter((row) => (row.averageDepDelay ?? 0) > 15).length;

  return [
    { label: "On Time", value: onTime, color: "#16a34a" },
    { label: "Minor Delay", value: minor, color: "#f59e0b" },
    { label: "Major Delay", value: major, color: "#dc2626" },
  ];
}

const tableColumns: DatasetTableColumn[] = [
  { header: "Flight ID", getValue: (row) => row.id },
  { header: "Flight", getValue: (row) => row.name },
  { header: "Carrier", getValue: (row) => row.stateCode },
  { header: "Origin City", getValue: (row) => row.city },
  { header: "Dep Delay", getValue: (row) => formatNumber(row.averageDepDelay, " min") },
  { header: "Arr Delay", getValue: (row) => formatNumber(row.averageArrDelay, " min") },
];

function FlightsPage() {
  return (
    <DatasetPage
      datasetId="example-flight"
      buildMetrics={buildMetrics}
      buildPieSlices={buildPieSlices}
      tableColumns={tableColumns}
      tableTitle="Flight Data Table"
    />
  );
}

export default FlightsPage;
