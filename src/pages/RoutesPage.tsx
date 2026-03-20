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
  const trafficValues = rows.map((row) => row.departingFlightCount).filter((v): v is number => v != null);

  const avgDep = depValues.length === 0
    ? null
    : depValues.reduce((sum, value) => sum + value, 0) / depValues.length;
  const avgArr = arrValues.length === 0
    ? null
    : arrValues.reduce((sum, value) => sum + value, 0) / arrValues.length;
  const avgTraffic = trafficValues.length === 0
    ? null
    : trafficValues.reduce((sum, value) => sum + value, 0) / trafficValues.length;

  return [
    { label: "Total Routes", value: String(rows.length) },
    { label: "Avg Route Dep Delay", value: formatNumber(avgDep, " min") },
    { label: "Avg Route Arr Delay", value: formatNumber(avgArr, " min") },
    { label: "Avg Flights / Route", value: formatNumber(avgTraffic) },
  ];
}

function buildPieSlices(rows: DashboardRow[]): DatasetPieSlice[] {
  const lowTraffic = rows.filter((row) => (row.departingFlightCount ?? 0) < 200).length;
  const mediumTraffic = rows.filter((row) => {
    const value = row.departingFlightCount ?? 0;
    return value >= 200 && value < 800;
  }).length;
  const highTraffic = rows.filter((row) => (row.departingFlightCount ?? 0) >= 800).length;

  return [
    { label: "Low Traffic", value: lowTraffic, color: "#60a5fa" },
    { label: "Medium Traffic", value: mediumTraffic, color: "#f59e0b" },
    { label: "High Traffic", value: highTraffic, color: "#2563eb" },
  ];
}

const tableColumns: DatasetTableColumn[] = [
  { header: "Route ID", getValue: (row) => row.id },
  { header: "Route", getValue: (row) => row.name },
  { header: "Origin Airport", getValue: (row) => row.stateCode },
  { header: "Origin City", getValue: (row) => row.city },
  { header: "Flights Count", getValue: (row) => formatNumber(row.departingFlightCount) },
  { header: "Avg Dep Delay", getValue: (row) => formatNumber(row.averageDepDelay, " min") },
  { header: "Avg Arr Delay", getValue: (row) => formatNumber(row.averageArrDelay, " min") },
];

function RoutesPage() {
  return (
    <DatasetPage
      datasetId="example-route"
      buildMetrics={buildMetrics}
      buildPieSlices={buildPieSlices}
      tableColumns={tableColumns}
      tableTitle="Route Data Table"
    />
  );
}

export default RoutesPage;
