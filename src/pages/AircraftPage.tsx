import type { DashboardRow } from "../dashboardBinding";
import DatasetPage, {
  type DatasetMetric,
  type DatasetPieSlice,
  type DatasetTableColumn,
} from "./DatasetPage";

function formatNumber(value: number | null, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }
  return value.toFixed(digits);
}

function buildMetrics(rows: DashboardRow[]): DatasetMetric[] {
  const flightCounts = rows
    .map((row) => row.departingFlightCount)
    .filter((value): value is number => value != null);

  const totalFlights = flightCounts.reduce((sum, value) => sum + value, 0);
  const avgFlights =
    flightCounts.length === 0 ? null : totalFlights / flightCounts.length;
  const carrierCount = new Set(
    rows.map((row) => row.stateCode).filter((code) => code !== "N/A"),
  ).size;

  return [
    { label: "Total Aircraft", value: String(rows.length) },
    { label: "Total Flights", value: totalFlights.toLocaleString() },
    { label: "Avg Flights / Aircraft", value: formatNumber(avgFlights) },
    { label: "Carrier Count", value: String(carrierCount) },
  ];
}

function buildPieSlices(rows: DashboardRow[]): DatasetPieSlice[] {
  const low = rows.filter((row) => (row.departingFlightCount ?? 0) < 1000).length;
  const medium = rows.filter((row) => {
    const value = row.departingFlightCount ?? 0;
    return value >= 1000 && value < 5000;
  }).length;
  const high = rows.filter((row) => (row.departingFlightCount ?? 0) >= 5000).length;

  return [
    { label: "Low Utilization", value: low, color: "#86efac" },
    { label: "Medium Utilization", value: medium, color: "#facc15" },
    { label: "High Utilization", value: high, color: "#3b82f6" },
  ];
}

const tableColumns: DatasetTableColumn[] = [
  { header: "Tail Number", getValue: (row) => row.id },
  { header: "Aircraft", getValue: (row) => row.name },
  { header: "Carrier", getValue: (row) => row.stateCode },
  { header: "Manufacturer", getValue: (row) => row.city },
  {
    header: "Flight Count",
    getValue: (row) => formatNumber(row.departingFlightCount, 0),
  },
  {
    header: "Complete History",
    getValue: (row) => (row.completeHistory ? "Yes" : "No"),
  },
];

function AircraftPage() {
  return (
    <DatasetPage
      datasetId="example-aircraft"
      buildMetrics={buildMetrics}
      buildPieSlices={buildPieSlices}
      tableColumns={tableColumns}
      tableTitle="Aircraft Data Table"
    />
  );
}

export default AircraftPage;
