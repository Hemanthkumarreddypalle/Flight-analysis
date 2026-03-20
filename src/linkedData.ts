import type {
  DashboardLinkedLink,
  DashboardLinkedObject,
  DashboardLinkedObjectSet,
  DashboardSingleLinkAccessor,
} from "./dashboardBinding";

export type RelatedDataItem = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
};

export type RelatedDataSection = {
  key: string;
  label: string;
  items: RelatedDataItem[];
  emptyMessage: string;
};

export function mergeRelatedDataSections(sectionGroups: RelatedDataSection[][]): RelatedDataSection[] {
  const merged = new Map<string, RelatedDataSection>();

  sectionGroups.flat().forEach((section) => {
    const existing = merged.get(section.key);

    if (existing == null) {
      merged.set(section.key, {
        ...section,
        items: [...section.items],
      });
      return;
    }

    const seenIds = new Set(existing.items.map((item) => item.id));
    const mergedItems = [...existing.items];

    section.items.forEach((item) => {
      if (!seenIds.has(item.id)) {
        mergedItems.push(item);
        seenIds.add(item.id);
      }
    });

    merged.set(section.key, {
      ...existing,
      items: mergedItems,
    });
  });

  return [...merged.values()];
}

type JsonRecord = Record<string, unknown>;

function toRecord(value: unknown): JsonRecord {
  return (value ?? {}) as JsonRecord;
}

function pickString(source: JsonRecord, keys: string[], fallback = "N/A"): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }

  return fallback;
}

function pickNumber(source: JsonRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }
  }

  return null;
}

function formatCountLabel(value: number | null, noun: string): string {
  if (value == null) {
    return noun;
  }

  return `${value.toLocaleString()} ${noun}`;
}

function mapAirportItem(value: unknown): RelatedDataItem {
  const source = toRecord(value);
  const airportId = pickString(source, ["airportId"]);
  const airportName = pickString(source, ["displayAirportName", "airport"], airportId);
  const city = pickString(
    source,
    ["displayAirportCityNameFull", "displayCityMarketNameFull"],
    "",
  );
  const state = pickString(source, ["airportStateCode", "airportStateName"], "");
  const depCount = pickNumber(source, ["departingFlightCount"]);

  return {
    id: airportId,
    title: airportName,
    subtitle: [airportId, city, state].filter((part) => part !== "").join(" · "),
    detail: formatCountLabel(depCount, "departures"),
  };
}

function mapRouteItem(value: unknown): RelatedDataItem {
  const source = toRecord(value);
  const routeId = pickString(source, ["routeId"]);
  const title = pickString(source, ["routeTitle"], routeId);
  const origin = pickString(source, ["originAirportId", "originDisplayAirportName"], "");
  const destination = pickString(
    source,
    ["destAirportId", "destinationDisplayAirportName"],
    "",
  );
  const flights = pickNumber(source, ["flightsCount"]);

  return {
    id: routeId,
    title,
    subtitle: [origin, destination].filter((part) => part !== "").join(" -> "),
    detail: formatCountLabel(flights, "flights"),
  };
}

function mapFlightItem(value: unknown): RelatedDataItem {
  const source = toRecord(value);
  const flightId = pickString(source, ["flightId"]);
  const title = pickString(source, ["flightTitle", "flightNumber"], flightId);
  const origin = pickString(source, ["originAirportId", "originDisplayAirportName"], "");
  const destination = pickString(
    source,
    ["destAirportId", "destinationDisplayAirportName"],
    "",
  );
  const depDelay = pickNumber(source, ["depDelay"]);

  return {
    id: flightId,
    title,
    subtitle: [origin, destination].filter((part) => part !== "").join(" -> "),
    detail:
      depDelay == null ? "Delay not available" : `${depDelay.toFixed(1)} min departure delay`,
  };
}

function mapAircraftItem(value: unknown): RelatedDataItem {
  const source = toRecord(value);
  const tailNum = pickString(source, ["tailNum"]);
  const title = pickString(source, ["title", "model"], tailNum);
  const carrier = pickString(source, ["carrierIataCode", "carrierName"], "");
  const manufacturer = pickString(source, ["manufacturer"], "");
  const flightCount = pickNumber(source, ["flightCount"]);

  return {
    id: tailNum,
    title,
    subtitle: [tailNum, carrier, manufacturer].filter((part) => part !== "").join(" · "),
    detail: formatCountLabel(flightCount, "linked flights"),
  };
}

function isObjectSetLink(
  value: DashboardLinkedLink | undefined,
): value is DashboardLinkedObjectSet {
  return value != null && "fetchPage" in value;
}

function isSingleLink(
  value: DashboardLinkedLink | undefined,
): value is DashboardSingleLinkAccessor {
  return value != null && "fetchOne" in value;
}

async function fetchAllLinkedItems(link: DashboardLinkedObjectSet): Promise<DashboardLinkedObject[]> {
  const items: DashboardLinkedObject[] = [];
  let nextPageToken: string | undefined;

  while (true) {
    const page = await link.fetchPage({
      $pageSize: 100,
      $includeAllBaseObjectProperties: true,
      ...(nextPageToken != null ? { $nextPageToken: nextPageToken } : {}),
    });

    items.push(...page.data);

    if (page.nextPageToken == null) {
      break;
    }

    nextPageToken = page.nextPageToken;
  }

  return items;
}

async function buildSetSection(
  source: DashboardLinkedObject,
  key: string,
  label: string,
  emptyMessage: string,
  mapItem: (value: unknown) => RelatedDataItem,
): Promise<RelatedDataSection> {
  const link = source.$link?.[key];
  if (!isObjectSetLink(link)) {
    return { key, label, items: [], emptyMessage };
  }

  const items = await fetchAllLinkedItems(link);
  return {
    key,
    label,
    items: items.map(mapItem),
    emptyMessage,
  };
}

async function buildSingleSection(
  source: DashboardLinkedObject,
  key: string,
  label: string,
  emptyMessage: string,
  mapItem: (value: unknown) => RelatedDataItem,
): Promise<RelatedDataSection> {
  const link = source.$link?.[key];
  if (!isSingleLink(link)) {
    return { key, label, items: [], emptyMessage };
  }

  try {
    const item = await link.fetchOne({
      $includeAllBaseObjectProperties: true,
    });

    return {
      key,
      label,
      items: [mapItem(item)],
      emptyMessage,
    };
  } catch {
    return { key, label, items: [], emptyMessage };
  }
}

export async function loadRelatedDataSections(
  datasetId: string,
  source: DashboardLinkedObject,
): Promise<RelatedDataSection[]> {
  if (datasetId === "example-airport") {
    return await Promise.all([
      buildSetSection(
        source,
        "departingRoutes",
        "Departing Routes",
        "No departing routes are linked to this airport.",
        mapRouteItem,
      ),
      buildSetSection(
        source,
        "arrivingRoutes",
        "Arriving Routes",
        "No arriving routes are linked to this airport.",
        mapRouteItem,
      ),
      buildSetSection(
        source,
        "departingFlights",
        "Departing Flights",
        "No departing flights are linked to this airport.",
        mapFlightItem,
      ),
      buildSetSection(
        source,
        "arrivingFlights",
        "Arriving Flights",
        "No arriving flights are linked to this airport.",
        mapFlightItem,
      ),
    ]);
  }

  if (datasetId === "example-route") {
    return await Promise.all([
      buildSingleSection(
        source,
        "departureAirport",
        "Departure Airport",
        "No departure airport is linked to this route.",
        mapAirportItem,
      ),
      buildSingleSection(
        source,
        "destinationAirport",
        "Destination Airport",
        "No destination airport is linked to this route.",
        mapAirportItem,
      ),
      buildSetSection(
        source,
        "flights",
        "Flights",
        "No flights are linked to this route.",
        mapFlightItem,
      ),
    ]);
  }

  if (datasetId === "example-flight") {
    return await Promise.all([
      buildSingleSection(
        source,
        "departureAirport",
        "Departure Airport",
        "No departure airport is linked to this flight.",
        mapAirportItem,
      ),
      buildSingleSection(
        source,
        "arrivalAirport",
        "Arrival Airport",
        "No arrival airport is linked to this flight.",
        mapAirportItem,
      ),
      buildSingleSection(
        source,
        "route",
        "Route",
        "No route is linked to this flight.",
        mapRouteItem,
      ),
      buildSingleSection(
        source,
        "aircraft",
        "Aircraft",
        "No aircraft is linked to this flight.",
        mapAircraftItem,
      ),
    ]);
  }

  if (datasetId === "example-aircraft") {
    return await Promise.all([
      buildSetSection(
        source,
        "flights",
        "Flights",
        "No flights are linked to this aircraft.",
        mapFlightItem,
      ),
    ]);
  }

  return [];
}
