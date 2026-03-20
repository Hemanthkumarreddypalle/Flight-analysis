import {
  Aircra,
  ExampleAircraft,
  ExampleAirport,
  ExampleFlight,
  ExampleRoute,
} from "@god/sdk";
import client from "./client";

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

type JsonRecord = Record<string, unknown>;

export type DashboardLinkedObject = JsonRecord & {
  $link?: Record<string, DashboardLinkedLink>;
};

export type DashboardLinkedPageResult = {
  data: DashboardLinkedObject[];
  nextPageToken?: string;
};

export type DashboardLinkedObjectSet = {
  fetchPage: (params: {
    $pageSize: number;
    $nextPageToken?: string;
    $includeAllBaseObjectProperties?: boolean;
  }) => Promise<DashboardLinkedPageResult>;
};

export type DashboardSingleLinkAccessor = {
  fetchOne: (params?: {
    $includeAllBaseObjectProperties?: boolean;
  }) => Promise<DashboardLinkedObject>;
};

export type DashboardLinkedLink =
  | DashboardLinkedObjectSet
  | DashboardSingleLinkAccessor;

export type DashboardBinding = {
  id: string;
  objectApiName: string;
  title: string;
  description: string;
  thumbnailText: string;
  loadRows: (options?: DashboardRequestOptions) => Promise<DashboardRow[]>;
  peekRows: () => DashboardCachedRowsSnapshot | null;
  fetchObjectById: (
    id: string,
    options?: DashboardRequestOptions,
  ) => Promise<DashboardLinkedObject>;
};

export type DashboardRequestOptions = {
  force?: boolean;
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
  thumbnailText: string;
  objectDef: unknown;
  fields: ObjectFieldMap;
};

type DynamicPageResult = { data: unknown[]; nextPageToken?: string };
type DynamicObjectClient = {
  fetchPage: (params: {
    $pageSize: number;
    $nextPageToken?: string;
    $select?: readonly string[];
    $includeAllBaseObjectProperties?: boolean;
  }) => Promise<DynamicPageResult>;
  fetchOne: (
    primaryKey: string,
    params?: {
      $includeAllBaseObjectProperties?: boolean;
    },
  ) => Promise<DashboardLinkedObject>;
};

type DashboardRowsCacheEntry = {
  rows?: DashboardRow[];
  loadedAt?: number;
  inflight?: Promise<DashboardRow[]>;
};

type DashboardObjectCacheEntry = {
  object?: DashboardLinkedObject;
  loadedAt?: number;
  inflight?: Promise<DashboardLinkedObject>;
};

export type DashboardCachedRowsSnapshot = {
  rows: DashboardRow[];
  loadedAt?: number;
};

const rowsCache = new Map<string, DashboardRowsCacheEntry>();
const objectCache = new Map<string, DashboardObjectCacheEntry>();

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

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

function getRowSelectFields(fields: ObjectFieldMap): string[] {
  return [...new Set(Object.values(fields).filter((field) =>
    field !== noBooleanField && field !== noNumberField
  ))];
}

export function createBinding(config: DashboardBindingConfig): DashboardBinding {
  return {
    id: config.id,
    objectApiName: config.objectApiName,
    title: config.title,
    description: config.description,
    thumbnailText: config.thumbnailText,
    loadRows: (options) => loadRowsForConfig(config, options),
    peekRows: () => peekRowsForConfig(config),
    fetchObjectById: (id, options) => fetchObjectForConfig(config, id, options),
  };
}

function getObjectClient(config: DashboardBindingConfig): DynamicObjectClient {
  return (client as unknown as (objectDef: unknown) => DynamicObjectClient)(
    config.objectDef,
  );
}

function peekRowsForConfig(config: DashboardBindingConfig): DashboardCachedRowsSnapshot | null {
  const cacheEntry = rowsCache.get(config.id);

  if (cacheEntry?.rows == null) {
    return null;
  }

  return {
    rows: cacheEntry.rows,
    loadedAt: cacheEntry.loadedAt,
  };
}

async function loadRowsForConfig(
  config: DashboardBindingConfig,
  options: DashboardRequestOptions = {},
): Promise<DashboardRow[]> {
  const cacheEntry = rowsCache.get(config.id);

  if (!options.force && cacheEntry?.rows != null) {
    return cacheEntry.rows;
  }

  if (!options.force && cacheEntry?.inflight != null) {
    return cacheEntry.inflight;
  }

  const loadPromise = loadRowsFromFoundry(config);
  rowsCache.set(config.id, {
    ...cacheEntry,
    inflight: loadPromise,
  });

  try {
    const rows = await loadPromise;
    rowsCache.set(config.id, {
      rows,
      loadedAt: Date.now(),
    });
    return rows;
  } catch (error) {
    if (cacheEntry != null) {
      rowsCache.set(config.id, cacheEntry);
    } else {
      rowsCache.delete(config.id);
    }
    throw error;
  }
}

async function loadRowsFromFoundry(config: DashboardBindingConfig): Promise<DashboardRow[]> {
  const selectedRows = await loadRowsWithRequestMode(config, "selected");

  // Some object types can behave inconsistently with narrow field selection.
  // If that returns no rows, retry once with base properties before surfacing an empty state.
  if (selectedRows.length === 0) {
    return await loadRowsWithRequestMode(config, "allBase");
  }

  return selectedRows;
}

async function loadRowsWithRequestMode(
  config: DashboardBindingConfig,
  mode: "selected" | "allBase",
): Promise<DashboardRow[]> {
  const rows: DashboardRow[] = [];
  let nextPageToken: string | undefined;
  const rowSelectFields = getRowSelectFields(config.fields);

  while (true) {
    const page = await getObjectClient(config).fetchPage({
      $pageSize: 100,
      ...(mode === "selected"
        ? { $select: rowSelectFields }
        : { $includeAllBaseObjectProperties: true }),
      ...(nextPageToken != null ? { $nextPageToken: nextPageToken } : {}),
    });

    rows.push(...page.data.map((item: unknown) => mapRow(toRecord(item), config.fields)));

    if (page.nextPageToken == null) {
      break;
    }

    nextPageToken = page.nextPageToken;
  }

  return rows;
}

async function fetchObjectForConfig(
  config: DashboardBindingConfig,
  id: string,
  options: DashboardRequestOptions = {},
): Promise<DashboardLinkedObject> {
  const cacheKey = `${config.id}:${id}`;
  const cacheEntry = objectCache.get(cacheKey);

  if (!options.force && cacheEntry?.object != null) {
    return cacheEntry.object;
  }

  if (!options.force && cacheEntry?.inflight != null) {
    return cacheEntry.inflight;
  }

  const loadPromise = getObjectClient(config).fetchOne(id, {
    $includeAllBaseObjectProperties: true,
  });

  objectCache.set(cacheKey, {
    ...cacheEntry,
    inflight: loadPromise,
  });

  try {
    const object = await loadPromise;
    objectCache.set(cacheKey, {
      object,
      loadedAt: Date.now(),
    });
    return object;
  } catch (error) {
    if (cacheEntry != null) {
      objectCache.set(cacheKey, cacheEntry);
    } else {
      objectCache.delete(cacheKey);
    }
    throw error;
  }
}

const noBooleanField = "__no_boolean_field__";
const noNumberField = "__no_number_field__";

const objectBindingConfigs: DashboardBindingConfig[] = [
  {
    id: "example-airport",
    objectApiName: "ExampleAirport",
    title: "Airport",
    description: "Airport-level delay and traffic metrics.",
    thumbnailText: "AP",
    objectDef: ExampleAirport,
    fields: {
      id: "airportId",
      name: "displayAirportName",
      stateCode: "airportStateCode",
      city: "displayAirportCityNameFull",
      averageDepDelay: "averageDepDelay",
      averageArrDelay: "averageArrDelay",
      departingFlightCount: "departingFlightCount",
      completeHistory: "completeFlightHistory",
    },
  },
  {
    id: "example-route",
    objectApiName: "ExampleRoute",
    title: "Route",
    description: "Route-level averages between origin and destination airports.",
    thumbnailText: "RT",
    objectDef: ExampleRoute,
    fields: {
      id: "routeId",
      name: "routeTitle",
      stateCode: "originAirportId",
      city: "originDisplayAirportCityNameFull",
      averageDepDelay: "averageDepDelay",
      averageArrDelay: "averageArrDelay",
      departingFlightCount: "flightsCount",
      completeHistory: "completeFlightHistory",
    },
  },
  {
    id: "example-flight",
    objectApiName: "ExampleFlight",
    title: "Flight",
    description: "Flight-level records with departure and arrival delay.",
    thumbnailText: "FL",
    objectDef: ExampleFlight,
    fields: {
      id: "flightId",
      name: "flightTitle",
      stateCode: "carrierCode",
      city: "originDisplayAirportCityNameFull",
      averageDepDelay: "depDelay",
      averageArrDelay: "arrDelay",
      departingFlightCount: "flights",
      completeHistory: noBooleanField,
    },
  },
  {
    id: "example-aircraft",
    objectApiName: "ExampleAircraft",
    title: "Aircraft",
    description: "Aircraft catalog with flight-count metrics.",
    thumbnailText: "AC",
    objectDef: ExampleAircraft,
    fields: {
      id: "tailNum",
      name: "title",
      stateCode: "carrierIataCode",
      city: "manufacturer",
      averageDepDelay: noNumberField,
      averageArrDelay: noNumberField,
      departingFlightCount: "flightCount",
      completeHistory: "completeFlightHistory",
    },
  },
  {
    id: "aircra",
    objectApiName: "Aircra",
    title: "Fleet",
    description: "Custom aircraft records from your ontology.",
    thumbnailText: "FT",
    objectDef: Aircra,
    fields: {
      id: "aircraftId",
      name: "aircraftName",
      stateCode: "status",
      city: "baseLocation",
      averageDepDelay: noNumberField,
      averageArrDelay: noNumberField,
      departingFlightCount: "capacity",
      completeHistory: noBooleanField,
    },
  },
];

const singleObjectBindings: DashboardBinding[] = objectBindingConfigs.map(createBinding);
export const dashboardBindings: DashboardBinding[] = singleObjectBindings;

export function getDashboardBindingById(id: string): DashboardBinding | undefined {
  return dashboardBindings.find((binding) => binding.id === id);
}

export const defaultDashboardBindingId = dashboardBindings[0]?.id ?? "";
