import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dashboardBindings,
  defaultDashboardBindingId,
  type DashboardRow,
} from "./dashboardBinding";
import css from "./Home.module.css";
import Layout from "./Layout";

type SortMode = "depDelay" | "arrDelay" | "name";

function formatMetric(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}${suffix}`;
}

function buildLoadErrorMessage(error: unknown): string {
  const message = (error as Error).message ?? "Unknown error";

  if (message.includes("Failed to fetch")) {
    return [
      "Failed to load Foundry data: request did not reach Foundry.",
      "Restart the dev server so Vite proxy changes are active.",
      "Verify .env.development has VITE_FOUNDRY_API_URL=http://localhost:8080 and VITE_FOUNDRY_PROXY_TARGET set.",
      "Then sign in again and refresh.",
    ].join(" ");
  }

  return `Failed to load Foundry data: ${message}`;
}

function Home() {
  const [bindingId, setBindingId] = useState(defaultDashboardBindingId);

  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to load from Foundry.");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("depDelay");

  const activeBinding = useMemo(() => {
    return (
      dashboardBindings.find((binding) => binding.id === bindingId) ??
      dashboardBindings[0]
    );
  }, [bindingId]);

  const loadRows = useCallback(async () => {
    if (activeBinding == null) {
      setRows([]);
      setStatus("No dashboard binding is configured.");
      return;
    }

    setLoading(true);
    setStatus(`Loading ${activeBinding.objectApiName} from Palantir Foundry...`);

    try {
      const fetched = await activeBinding.loadRows();
      setRows(fetched);
      setLastUpdated(new Date().toLocaleString());
      if (fetched.length === 0) {
        setStatus(
          "Connected to Foundry, but 0 rows were returned. Check object permissions, data availability, or object type binding.",
        );
      } else {
        setStatus(`Loaded ${fetched.length} rows from Foundry.`);
      }
    } catch (e) {
      setStatus(buildLoadErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [activeBinding]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const stateOptions = useMemo(() => {
    const stateSet = new Set(
      rows.map((row) => row.stateCode).filter((state) => state !== "N/A"),
    );
    return ["ALL", ...Array.from(stateSet).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const matchesState = stateFilter === "ALL" || row.stateCode === stateFilter;

      const matchesSearch =
        normalizedSearch === "" ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.id.toLowerCase().includes(normalizedSearch) ||
        row.city.toLowerCase().includes(normalizedSearch);

      return matchesState && matchesSearch;
    });

    filtered.sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }

      const aValue =
        sortMode === "depDelay"
          ? (a.averageDepDelay ?? Number.NEGATIVE_INFINITY)
          : (a.averageArrDelay ?? Number.NEGATIVE_INFINITY);
      const bValue =
        sortMode === "depDelay"
          ? (b.averageDepDelay ?? Number.NEGATIVE_INFINITY)
          : (b.averageArrDelay ?? Number.NEGATIVE_INFINITY);

      return bValue - aValue;
    });

    return filtered;
  }, [rows, search, sortMode, stateFilter]);

  const metrics = useMemo(() => {
    const depValues = filteredRows
      .map((row) => row.averageDepDelay)
      .filter((v): v is number => v != null);
    const arrValues = filteredRows
      .map((row) => row.averageArrDelay)
      .filter((v): v is number => v != null);

    const averageDepDelay =
      depValues.length > 0
        ? depValues.reduce((sum, val) => sum + val, 0) / depValues.length
        : null;
    const averageArrDelay =
      arrValues.length > 0
        ? arrValues.reduce((sum, val) => sum + val, 0) / arrValues.length
        : null;

    const withHistory = filteredRows.filter((row) => row.completeHistory).length;

    const stateCounts = new Map<string, number>();
    for (const row of filteredRows) {
      const current = stateCounts.get(row.stateCode) ?? 0;
      stateCounts.set(row.stateCode, current + 1);
    }

    let topState = "N/A";
    let topStateCount = 0;
    for (const [state, count] of stateCounts.entries()) {
      if (count > topStateCount) {
        topState = state;
        topStateCount = count;
      }
    }

    return {
      totalRows: filteredRows.length,
      averageDepDelay,
      averageArrDelay,
      withHistory,
      topState,
      topStateCount,
    };
  }, [filteredRows]);

  const topDelayRows = useMemo(() => {
    return filteredRows.filter((row) => row.averageDepDelay != null).slice(0, 8);
  }, [filteredRows]);

  const maxDepDelay = useMemo(() => {
    return topDelayRows.reduce(
      (max, row) => Math.max(max, row.averageDepDelay ?? 0),
      0,
    );
  }, [topDelayRows]);

  const topArrivalRows = useMemo(() => {
    return filteredRows.filter((row) => row.averageArrDelay != null).slice(0, 8);
  }, [filteredRows]);

  const maxArrDelay = useMemo(() => {
    return topArrivalRows.reduce(
      (max, row) => Math.max(max, row.averageArrDelay ?? 0),
      0,
    );
  }, [topArrivalRows]);

  return (
    <Layout>
      <div className={css.dashboard}>
        <section className={css.hero}>
          <h1>{activeBinding?.title ?? "Dashboard"}</h1>
          <p>{activeBinding?.description ?? "No binding configured."}</p>
        </section>

        <section className={css.controls}>
          <div className={css.control}>
            <label htmlFor="binding">Dataset</label>
            <select
              id="binding"
              value={bindingId}
              onChange={(event) => setBindingId(event.target.value)}
            >
              {dashboardBindings.map((binding) => (
                <option key={binding.id} value={binding.id}>
                  {binding.title} ({binding.objectApiName})
                </option>
              ))}
            </select>
          </div>

          <div className={css.control}>
            <label htmlFor="search">Search</label>
            <input
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ID, name, or city"
            />
          </div>

          <div className={css.control}>
            <label htmlFor="state-filter">State</label>
            <select
              id="state-filter"
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
            >
              {stateOptions.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div className={css.control}>
            <label htmlFor="sort-mode">Sort</label>
            <select
              id="sort-mode"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="depDelay">Departure delay (desc)</option>
              <option value="arrDelay">Arrival delay (desc)</option>
              <option value="name">Name (asc)</option>
            </select>
          </div>

          <div className={css.actions}>
            <button onClick={() => void loadRows()} disabled={loading}>
              {loading ? "Loading..." : "Refresh Data"}
            </button>
          </div>
        </section>

        <p className={css.status}>
          {status}
          {lastUpdated != null ? ` Last updated: ${lastUpdated}.` : ""}
        </p>

        <section className={css.metrics}>
          <article className={css.card}>
            <h2>Total Rows</h2>
            <p>{metrics.totalRows}</p>
          </article>
          <article className={css.card}>
            <h2>Avg Departure Delay</h2>
            <p>{formatMetric(metrics.averageDepDelay, " min")}</p>
          </article>
          <article className={css.card}>
            <h2>Avg Arrival Delay</h2>
            <p>{formatMetric(metrics.averageArrDelay, " min")}</p>
          </article>
          <article className={css.card}>
            <h2>Complete History</h2>
            <p>{metrics.withHistory}</p>
          </article>
          <article className={css.card}>
            <h2>Top State</h2>
            <p>
              {metrics.topState}
              {" · "}
              {metrics.topStateCount}
            </p>
          </article>
        </section>

        <section className={css.mainGrid}>
          <article className={css.panel}>
            <h2>Top Departure Delays</h2>
            {topDelayRows.length === 0 ? (
              <p className={css.empty}>No delay data available.</p>
            ) : (
              <ul className={css.barList}>
                {topDelayRows.map((row) => {
                  const value = row.averageDepDelay ?? 0;
                  const width =
                    maxDepDelay > 0 ? `${(value / maxDepDelay) * 100}%` : "0%";

                  return (
                    <li key={row.id} className={css.barItem}>
                      <div className={css.barHeader}>
                        <span>{row.id}</span>
                        <span>{formatMetric(value, " min")}</span>
                      </div>
                      <div className={css.barTrack}>
                        <div className={css.barFill} style={{ width }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>

          <article className={css.panel}>
            <h2>Top Arrival Delays</h2>
            {topArrivalRows.length === 0 ? (
              <p className={css.empty}>No arrival delay data available.</p>
            ) : (
              <ul className={css.barList}>
                {topArrivalRows.map((row) => {
                  const value = row.averageArrDelay ?? 0;
                  const width =
                    maxArrDelay > 0 ? `${(value / maxArrDelay) * 100}%` : "0%";

                  return (
                    <li key={row.id} className={css.barItem}>
                      <div className={css.barHeader}>
                        <span>{row.id}</span>
                        <span>{formatMetric(value, " min")}</span>
                      </div>
                      <div className={css.barTrack}>
                        <div className={css.barFillArrival} style={{ width }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        </section>
      </div>
    </Layout>
  );
}

export default Home;
