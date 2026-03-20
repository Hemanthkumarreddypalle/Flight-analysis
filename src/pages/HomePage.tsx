import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardBindings, type DashboardRow } from "../dashboardBinding";
import Layout from "../Layout";
import css from "./HomePage.module.css";

const datasetRouteById: Record<string, string> = {
  "example-airport": "/airports",
  "example-route": "/routes",
  "example-flight": "/flights",
  "example-aircraft": "/aircraft",
};

type TrendSummary = {
  title: string;
  detail: string;
};

type DatasetInsight = {
  title: string;
  detail: string;
};

function getAverage(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value != null);
  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function formatValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}${suffix}`;
}

function buildTrendSummary(bindingId: string, rows: DashboardRow[]): TrendSummary {
  if (rows.length === 0) {
    return {
      title: "No current trend data",
      detail: "This dataset is live, but no rows are available right now.",
    };
  }

  if (bindingId === "example-airport") {
    const avgDepDelay = getAverage(rows.map((row) => row.averageDepDelay));
    const totalFlights = rows.reduce((sum, row) => sum + (row.departingFlightCount ?? 0), 0);

    return avgDepDelay != null && avgDepDelay > 10
      ? {
          title: "Airport delays are trending high",
          detail: `${formatValue(avgDepDelay, " min")} average departure delay across ${totalFlights.toLocaleString()} tracked departures.`,
        }
      : {
          title: "Airport operations look stable",
          detail: `${formatValue(avgDepDelay, " min")} average departure delay with ${totalFlights.toLocaleString()} tracked departures.`,
        };
  }

  if (bindingId === "example-route") {
    const avgTraffic = getAverage(rows.map((row) => row.departingFlightCount));
    const avgArrDelay = getAverage(rows.map((row) => row.averageArrDelay));

    return {
      title: avgTraffic != null && avgTraffic >= 500
        ? "Routes show strong traffic flow"
        : "Routes are running at moderate volume",
      detail: `${formatValue(avgTraffic)} average flights per route and ${formatValue(avgArrDelay, " min")} average arrival delay.`,
    };
  }

  if (bindingId === "example-flight") {
    const delayedFlights = rows.filter((row) => (row.averageDepDelay ?? 0) > 0).length;
    const delayedShare = (delayedFlights / rows.length) * 100;

    return delayedShare >= 50
      ? {
          title: "Flight punctuality needs attention",
          detail: `${delayedFlights.toLocaleString()} of ${rows.length.toLocaleString()} flights are departing late.`,
        }
      : {
          title: "Flight punctuality is holding",
          detail: `${delayedFlights.toLocaleString()} of ${rows.length.toLocaleString()} flights are departing late.`,
        };
  }

  if (bindingId === "example-aircraft") {
    const totalFlights = rows.reduce((sum, row) => sum + (row.departingFlightCount ?? 0), 0);
    const activeCarriers = new Set(
      rows.map((row) => row.stateCode).filter((value) => value !== "N/A"),
    ).size;

    return {
      title: "Aircraft utilization is building",
      detail: `${totalFlights.toLocaleString()} flights are linked across ${activeCarriers.toLocaleString()} active carriers.`,
    };
  }

  return {
    title: "Business trend available",
    detail: `${rows.length.toLocaleString()} records were reviewed for this analysis.`,
  };
}

const defaultTrendById: Record<string, TrendSummary> = {
  "example-airport": {
    title: "Loading airport trend",
    detail: "Reviewing delay and departure patterns from the airport dataset.",
  },
  "example-route": {
    title: "Loading route trend",
    detail: "Reviewing traffic flow and route-level performance.",
  },
  "example-flight": {
    title: "Loading flight trend",
    detail: "Reviewing punctuality and delay movement across flights.",
  },
  "example-aircraft": {
    title: "Loading aircraft trend",
    detail: "Reviewing aircraft usage and carrier coverage.",
  },
};

function buildDatasetInsight(bindingId: string, rows: DashboardRow[]): DatasetInsight {
  if (rows.length === 0) {
    return {
      title: "No current trend data",
      detail: "This dataset connected successfully, but there are no rows to analyze yet.",
    };
  }

  const trend = buildTrendSummary(bindingId, rows);

  return {
    title: trend.title,
    detail: trend.detail,
  };
}

function createInitialInsight(bindingId: string): DatasetInsight {
  const binding = dashboardBindings.find((item) => item.id === bindingId);
  const cachedRows = binding?.peekRows();

  if (cachedRows != null) {
    return buildDatasetInsight(bindingId, cachedRows.rows);
  }

  return {
    title: defaultTrendById[bindingId]?.title ?? "Loading trend",
    detail:
      defaultTrendById[bindingId]?.detail ??
      "Reviewing live business activity for this dataset.",
  };
}

function HomePage() {
  const visibleBindings = useMemo(
    () =>
      dashboardBindings.filter((binding) =>
        datasetRouteById[binding.id] != null
      ),
    [],
  );
  const totalDatasets = visibleBindings.length;
  const [datasetInsights, setDatasetInsights] = useState<Record<string, DatasetInsight>>(
    () =>
      Object.fromEntries(
        visibleBindings.map((binding) => [
          binding.id,
          createInitialInsight(binding.id),
        ]),
      ),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHomeTrends() {
      const bindingsNeedingLoad = visibleBindings.filter((binding) => binding.peekRows() == null);

      if (bindingsNeedingLoad.length === 0) {
        return;
      }

      const insightEntries = await Promise.all(
        bindingsNeedingLoad.map(async (binding) => {
          try {
            const rows = await binding.loadRows();
            return [binding.id, buildDatasetInsight(binding.id, rows)] as const;
          } catch {
            return [
              binding.id,
              {
                title: "Trend unavailable",
                detail: "This analysis could not be generated right now for the selected dataset.",
              },
            ] as const;
          }
        }),
      );

      if (!cancelled) {
        setDatasetInsights((currentInsights) => ({
          ...currentInsights,
          ...Object.fromEntries(insightEntries),
        }));
      }
    }

    void loadHomeTrends();

    return () => {
      cancelled = true;
    };
  }, [visibleBindings]);

  return (
    <Layout>
      <div className={css.page}>
        <section className={css.headerBar}>
          <img src="/flight-header.svg" alt="Flight" className={css.headerImage} />
          <div className={css.headerText}>
            <p className={css.kicker}>Flight Intelligence</p>
            <h1>Aviation Data Hub</h1>
          </div>
          <div className={css.headerMeta}>
            <span>{totalDatasets} Datasets</span>
            <span>Live Foundry Data</span>
          </div>
        </section>

        <section className={css.grid}>
          {visibleBindings.map((binding, index) => {
            const route = datasetRouteById[binding.id];
            if (route == null) {
              return null;
            }

            return (
              <Link
                key={binding.id}
                className={css.card}
                to={route}
              >
                <div className={css.thumbnail} data-tone={index % 5}>
                  <span>{binding.thumbnailText}</span>
                </div>
                <div className={css.cardBody}>
                  <h2>{binding.title}</h2>
                  <p>{binding.description}</p>
                  <span className={css.cardLinkText}>Open page</span>
                </div>
              </Link>
            );
          })}
        </section>

        <section className={css.trendsSection}>
          <div className={css.sectionHeading}>
            <div>
              <p className={css.sectionKicker}>Key Analysis</p>
              <h2>Trend highlights across the business</h2>
            </div>
            <p className={css.sectionDescription}>
              Select any analysis card below to open the related page and explore the underlying records, charts, and linked insights.
            </p>
          </div>

          <div className={css.trendGrid}>
            {visibleBindings.map((binding, index) => {
              const route = datasetRouteById[binding.id];
              if (route == null) {
                return null;
              }

              const insight = datasetInsights[binding.id];

              return (
                <Link
                  key={`${binding.id}-trend`}
                  to={route}
                  className={css.trendCard}
                >
                  <div className={css.trendCardHeader}>
                    <div className={css.trendCardTitle}>
                      <span className={css.trendIcon} data-tone={index % 5}>
                        {binding.thumbnailText}
                      </span>
                      <div>
                        <h3>{binding.title}</h3>
                        <p>{binding.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className={css.trendCopy}>
                    <strong>{insight.title}</strong>
                    <p>{insight.detail}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default HomePage;
