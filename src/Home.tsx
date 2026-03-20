import { useCallback, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { $Actions, $Objects, $Queries, ExampleAirport } from "@god/sdk";
import type { Osdk, PageResult } from "@osdk/client";
import client from "./client";
import css from "./Home.module.css";
import Layout from "./Layout";

type AirportSummary = {
  airportId: string;
  displayAirportName: string | undefined;
  airportStateCode: string | undefined;
  averageDepDelay: number | undefined;
};

function toAirportSummary(
  airport: Osdk.Instance<ExampleAirport>,
): AirportSummary {
  return {
    airportId: airport.airportId,
    displayAirportName: airport.displayAirportName,
    airportStateCode: airport.airportStateCode,
    averageDepDelay: airport.averageDepDelay,
  };
}

function Home() {
  const objectApiNames = Object.keys($Objects);
  const actionApiNames = Object.keys($Actions);
  const queryApiNames = Object.keys($Queries);

  const [airportId, setAirportId] = useState("JFK");
  const [status, setStatus] = useState("Ready to load data.");
  const [results, setResults] = useState<AirportSummary[]>([]);
  const [objectCounts, setObjectCounts] = useState<Record<string, number | string>>({});

  // Dynamically fetch the total count for all objects in your Ontology
  useEffect(() => {
    let isMounted = true;

    async function fetchCounts() {
      // Loop sequentially through every dataset exported in your SDK
      for (const [apiName, objType] of Object.entries($Objects)) {
        try {
          // @ts-expect-error - Dynamic aggregation typing is complex, so we ignore the TS error
          const result = await client(objType).aggregate({
            $select: { $count: "unordered" }
          });
          
          if (isMounted) {
            setObjectCounts(prev => ({ ...prev, [apiName]: result.$count }));
          }
        } catch (e) {
          console.error(`Failed to fetch count for ${apiName}:`, e);
          if (isMounted) {
            setObjectCounts(prev => ({ ...prev, [apiName]: "N/A" }));
          }
        }
      }
    }

    fetchCounts();
    return () => { isMounted = false; };
  }, []);

  const handleFetchOne = useCallback(async () => {
    setStatus(`Loading airport with primary key "${airportId}"...`);
    try {
      const object: Osdk.Instance<ExampleAirport> = await client(
        ExampleAirport,
      ).fetchOne(airportId);
      setResults([toAirportSummary(object)]);
      setStatus("Loaded 1 object with fetchOne.");
    } catch (e) {
      setStatus(
        `fetchOne failed: ${(e as Error).message ?? "Unknown error"}`,
      );
    }
  }, [airportId]);

  const handleFetchPage = useCallback(async () => {
    setStatus("Loading two pages of airports...");
    try {
      const firstPage: PageResult<Osdk.Instance<ExampleAirport>> = await client(
        ExampleAirport,
      ).fetchPage({ $pageSize: 30 });

      if (firstPage.nextPageToken == null) {
        setResults(firstPage.data.map(toAirportSummary));
        setStatus(`Loaded ${firstPage.data.length} object(s) from one page.`);
        return;
      }

      const secondPage: PageResult<Osdk.Instance<ExampleAirport>> =
        await client(ExampleAirport).fetchPage({
          $pageSize: 30,
          $nextPageToken: firstPage.nextPageToken,
        });

      const merged = [...firstPage.data, ...secondPage.data];
      setResults(merged.map(toAirportSummary));
      setStatus(`Loaded ${merged.length} objects from two pages.`);
    } catch (e) {
      setStatus(
        `fetchPage failed: ${(e as Error).message ?? "Unknown error"}`,
      );
    }
  }, []);

  const handleFetchOrdered = useCallback(async () => {
    setStatus("Loading airports ordered by displayAirportName...");
    try {
      const page: PageResult<Osdk.Instance<ExampleAirport>> = await client(
        ExampleAirport,
      ).fetchPage({
        $orderBy: { displayAirportName: "asc" },
        $pageSize: 30,
      });

      setResults(page.data.map(toAirportSummary));
      setStatus(`Loaded ${page.data.length} ordered object(s).`);
    } catch (e) {
      setStatus(
        `Ordered fetch failed: ${(e as Error).message ?? "Unknown error"}`,
      );
    }
  }, []);

  const handleFetchFiltered = useCallback(async () => {
    setStatus("Loading filtered airports (displayAirportName is null)...");
    try {
      const page: PageResult<Osdk.Instance<ExampleAirport>> = await client(
        ExampleAirport,
      )
        .where({
          displayAirportName: { $isNull: true },
        })
        .fetchPage({
          $pageSize: 30,
        });

      setResults(page.data.map(toAirportSummary));
      setStatus(`Loaded ${page.data.length} filtered object(s).`);
    } catch (e) {
      setStatus(
        `Filtered fetch failed: ${(e as Error).message ?? "Unknown error"}`,
      );
    }
  }, []);

  // Dynamically map all available objects to their own KPI card
  const colorPresets = [
    { bg: "#e0f2fe", text: "#0284c7", icon: "📊" },
    { bg: "#dcfce7", text: "#15803d", icon: "📑" },
    { bg: "#f3e8ff", text: "#7e22ce", icon: "📈" },
    { bg: "#fef3c7", text: "#b45309", icon: "🗂️" },
    { bg: "#ffedd5", text: "#c2410c", icon: "📋" },
  ];

  const kpiData = objectApiNames.map((apiName, index) => {
    const theme = colorPresets[index % colorPresets.length];
    const countValue = objectCounts[apiName];
    const displayValue = countValue !== undefined 
      ? (typeof countValue === "number" ? countValue.toLocaleString() : countValue)
      : "Loading...";

    return {
      title: apiName,
      value: displayValue,
      link: `/${apiName.toLowerCase()}`,
      ...theme,
    };
  });

  return (
    <Layout>
      <div style={{ padding: "1rem 0" }}>
        <h1 style={{ margin: "0 0 0.5rem 0", fontSize: "2rem", color: "#0f172a" }}>Dashboard</h1>
        <p style={{ margin: "0 0 2rem 0", color: "#64748b" }}>Overview of your Flight Ops operations.</p>
        
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1.5rem",
          marginBottom: "3rem"
        }}>
          {kpiData.map((kpi) => (
            <NavLink 
              key={kpi.title} 
              to={kpi.link} 
              style={{
                display: "flex",
                alignItems: "center",
                padding: "1.5rem",
                backgroundColor: kpi.bg,
                borderRadius: "12px",
                textDecoration: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginRight: "1rem" }}>{kpi.icon}</div>
              <div>
                <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: kpi.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {kpi.title}
                </h3>
                <p style={{ margin: "0.25rem 0 0 0", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
                  {kpi.value}
                </p>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
      
      <hr style={{ border: "0", height: "1px", backgroundColor: "#e2e8f0", marginBottom: "2rem" }} />
      
      <h2 style={{ color: "#0f172a", marginTop: 0 }}>Developer SDK Tools</h2>
      <p style={{ color: "#64748b" }}>
        Test your Ontology SDK connections below.
      </p>
      <div className={css.methods}>
        <div>
          <h2>Objects ({objectApiNames.length})</h2>
          {objectApiNames.map((objectApiName) => (
            <pre key={objectApiName}>
              client.ontology.objects.{objectApiName}
            </pre>
          ))}
        </div>
        <div>
          <h2>Actions ({actionApiNames.length})</h2>
          {actionApiNames.map((actionApiName) => (
            <pre key={actionApiName}>
              client.ontology.actions.{actionApiName}
            </pre>
          ))}
        </div>
        <div>
          <h2>Queries ({queryApiNames.length})</h2>
          {queryApiNames.map((queryApiName) => (
            <pre key={queryApiName}>
              client.ontology.queries.{queryApiName}
            </pre>
          ))}
        </div>
      </div>

      <h2>Loading Data ([Example] Airport)</h2>
      <p>
        Primary key:
        {" "}
        <input
          value={airportId}
          onChange={(event) => setAirportId(event.target.value)}
          placeholder="Airport Id, e.g. JFK"
        />
      </p>
      <div className={css.methods}>
        <button onClick={handleFetchOne}>fetchOne</button>
        <button onClick={handleFetchPage}>fetchPage (2 pages)</button>
        <button onClick={handleFetchOrdered}>fetchPage + orderBy</button>
        <button onClick={handleFetchFiltered}>where + fetchPage</button>
      </div>
      <p>{status}</p>
      <pre>{JSON.stringify(results, null, 2)}</pre>
    </Layout>
  );
}

export default Home;
