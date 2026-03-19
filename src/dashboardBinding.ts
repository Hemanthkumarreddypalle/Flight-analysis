import client from "./client";
import { fetchAllAirports } from "./fetchAllAirports";

export type DashboardRow = {
  id: string;
  name: string;
  stateCode: string;
  city: string;
  averageDepDelay: number | null;
  averageArrDelay: number | null;
  departingFlightCount: number | null;
  completeHistory: boolean;
};

export type DashboardBinding = {
  id: string;
  objectApiName: string;
  title: string;
  description: string;
  loadRows: () => Promise<DashboardRow[]>;
};

type ObjectFieldMap = {
  id: string;
  name: string;
  stateCode: string;
  city: string;
  averageDepDelay: string;
  averageArrDelay: string;
  departingFlightCount: string;
  completeHistory: string;
};

export type DashboardBindingConfig = {
  id: string;
  objectApiName: string;
  title: string;
  description: string;
  objectDef: unknown;
  fields: ObjectFieldMap;
};

type JsonRecord = Record<string, unknown>;
type DynamicPageResult = { data: unknown[]; nextPageToken?: string };
type DynamicObjectClient = {
  fetchPage: (params: {
    $pageSize: number;
    $nextPageToken?: string;
    $includeAllBaseObjectProperties?: boolean;
  }) => Promise<DynamicPageResult>;
};

function toRecord(value: unknown): JsonRecord {
  return (value ?? {}) as JsonRecord;
}

function pickString(source: JsonRecord, key: string, fallback: string): string {
  const value = source[key];
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function pickNumber(source: JsonRecord, key: string): number | null {
  const value = source[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  return null;
}

function pickBoolean(source: JsonRecord, key: string): boolean {
  return source[key] === true;
}

function mapRow(source: JsonRecord, fields: ObjectFieldMap): DashboardRow {
  const id = pickString(source, fields.id, "N/A");

  return {
    id,
    name: pickString(source, fields.name, id),
    stateCode: pickString(source, fields.stateCode, "N/A"),
    city: pickString(source, fields.city, "N/A"),
    averageDepDelay: pickNumber(source, fields.averageDepDelay),
    averageArrDelay: pickNumber(source, fields.averageArrDelay),
    departingFlightCount: pickNumber(source, fields.departingFlightCount),
    completeHistory: pickBoolean(source, fields.completeHistory),
  };
}

export function createBinding(config: DashboardBindingConfig): DashboardBinding {
  return {
    id: config.id,
    objectApiName: config.objectApiName,
    title: config.title,
    description: config.description,
    async loadRows(): Promise<DashboardRow[]> {
      const rows: DashboardRow[] = [];
      let nextPageToken: string | undefined;
      const getObjectClient = client as unknown as (
        objectDef: unknown,
      ) => DynamicObjectClient;

      while (true) {
        const page = await getObjectClient(config.objectDef).fetchPage({
          $pageSize: 100,
          $includeAllBaseObjectProperties: true,
          ...(nextPageToken != null ? { $nextPageToken: nextPageToken } : {}),
        });

        rows.push(...page.data.map((item: unknown) => mapRow(toRecord(item), config.fields)));

        if (page.nextPageToken == null) {
          break;
        }

        nextPageToken = page.nextPageToken;
      }

      return rows;
    },
  };
}

const exampleAirportFieldMap: ObjectFieldMap = {
  id: "airportId",
  name: "displayAirportName",
  stateCode: "airportStateCode",
  city: "displayAirportCityNameFull",
  averageDepDelay: "averageDepDelay",
  averageArrDelay: "averageArrDelay",
  departingFlightCount: "departingFlightCount",
  completeHistory: "completeFlightHistory",
};

export const dashboardBindings: DashboardBinding[] = [
  {
    id: "example-airport",
    objectApiName: "ExampleAirport",
    title: "Palantir Airport Dashboard",
    description:
      "Live ontology data from ExampleAirport, rendered as KPI cards, rankings, and a searchable table.",
    loadRows: async () => {
      const all = await fetchAllAirports();
      return all.map((item) => mapRow(toRecord(item), exampleAirportFieldMap));
    },
  },
  // Add your real ontology object binding here after SDK regeneration.
  // Example:
  // createBinding({
  //   id: "my-object",
  //   objectApiName: "MyObject",
  //   title: "My Object Dashboard",
  //   description: "Metrics for MyObject from Foundry.",
  //   objectDef: MyObject,
  //   fields: {
  //     id: "myPrimaryKey",
  //     name: "displayName",
  //     stateCode: "regionCode",
  //     city: "cityName",
  //     averageDepDelay: "someNumericMetric",
  //     averageArrDelay: "anotherNumericMetric",
  //     departingFlightCount: "volumeMetric",
  //     completeHistory: "isComplete",
  //   },
  // }),
];

export const defaultDashboardBindingId = dashboardBindings[0]?.id ?? "";
