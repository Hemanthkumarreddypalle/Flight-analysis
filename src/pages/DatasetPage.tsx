import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getDashboardBindingById,
  type DashboardRow,
} from "../dashboardBinding";
import {
  loadRelatedDataSections,
  mergeRelatedDataSections,
  type RelatedDataSection,
} from "../linkedData";
import Layout from "../Layout";
import css from "./DatasetPage.module.css";

export type DatasetMetric = {
  label: string;
  value: string;
};

export type DatasetPieSlice = {
  label: string;
  value: number;
  color: string;
};

export type DatasetTableColumn = {
  header: string;
  getValue: (row: DashboardRow) => string;
};

type DatasetPageProps = {
  datasetId: string;
  buildMetrics: (rows: DashboardRow[]) => DatasetMetric[];
  buildPieSlices: (rows: DashboardRow[]) => DatasetPieSlice[];
  tableColumns: DatasetTableColumn[];
  tableTitle: string;
};

type BarPoint = {
  label: string;
  value: number;
};

const TABLE_PAGE_SIZE = 10;
const ALL_FILTER_VALUE = "__all__";
const RELATED_SELECTION_SAMPLE_LIMIT = 3;

type NumericRange = {
  min: number;
  max: number;
};

type DatasetFilterValues = {
  categoryFilter: string;
  locationFilter: string;
  historyFilter: "all" | "complete" | "incomplete";
  depDelayMin: number | null;
  depDelayMax: number | null;
  arrDelayMin: number | null;
  arrDelayMax: number | null;
  volumeMin: number | null;
  volumeMax: number | null;
};

type FilterApplicationOptions = {
  ignoreCategory?: boolean;
  ignoreLocation?: boolean;
  ignoreHistory?: boolean;
  ignoreDepDelay?: boolean;
  ignoreArrDelay?: boolean;
  ignoreVolume?: boolean;
};

type AnalysisModalState = {
  title: string;
  subtitle: string;
  description: string;
  insights: string[];
  records: DashboardRow[];
  sourceRow: DashboardRow | null;
  loadingRelated: boolean;
  error: string | null;
  sections: RelatedDataSection[];
};

type PageInteractionState = {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  rowIds: string[];
  loadAllRelated: boolean;
};

type PageRelatedState = {
  key: string | null;
  loading: boolean;
  error: string | null;
  note: string | null;
  sections: RelatedDataSection[];
};

function parseFilterNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function getNumericRange(values: Array<number | null>): NumericRange | null {
  const numericValues = values.filter((value): value is number => value != null);
  if (numericValues.length === 0) {
    return null;
  }
  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  };
}

function countByValue(values: string[]): Map<string, number> {
  const counter = new Map<string, number>();
  values.forEach((value) => {
    counter.set(value, (counter.get(value) ?? 0) + 1);
  });
  return counter;
}

function applyDatasetFilters(
  rows: DashboardRow[],
  filterValues: DatasetFilterValues,
  options: FilterApplicationOptions = {},
): DashboardRow[] {
  return rows.filter((row) => {
    if (
      !options.ignoreCategory &&
      filterValues.categoryFilter !== ALL_FILTER_VALUE &&
      row.stateCode !== filterValues.categoryFilter
    ) {
      return false;
    }

    if (
      !options.ignoreLocation &&
      filterValues.locationFilter !== ALL_FILTER_VALUE &&
      row.city !== filterValues.locationFilter
    ) {
      return false;
    }

    if (!options.ignoreHistory) {
      if (filterValues.historyFilter === "complete" && !row.completeHistory) {
        return false;
      }

      if (filterValues.historyFilter === "incomplete" && row.completeHistory) {
        return false;
      }
    }

    if (!options.ignoreDepDelay) {
      if (
        filterValues.depDelayMin != null &&
        (row.averageDepDelay == null || row.averageDepDelay < filterValues.depDelayMin)
      ) {
        return false;
      }

      if (
        filterValues.depDelayMax != null &&
        (row.averageDepDelay == null || row.averageDepDelay > filterValues.depDelayMax)
      ) {
        return false;
      }
    }

    if (!options.ignoreArrDelay) {
      if (
        filterValues.arrDelayMin != null &&
        (row.averageArrDelay == null || row.averageArrDelay < filterValues.arrDelayMin)
      ) {
        return false;
      }

      if (
        filterValues.arrDelayMax != null &&
        (row.averageArrDelay == null || row.averageArrDelay > filterValues.arrDelayMax)
      ) {
        return false;
      }
    }

    if (!options.ignoreVolume) {
      if (
        filterValues.volumeMin != null &&
        (row.departingFlightCount == null ||
          row.departingFlightCount < filterValues.volumeMin)
      ) {
        return false;
      }

      if (
        filterValues.volumeMax != null &&
        (row.departingFlightCount == null ||
          row.departingFlightCount > filterValues.volumeMax)
      ) {
        return false;
      }
    }

    return true;
  });
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

function buildRelatedDataErrorMessage(error: unknown): string {
  const message = (error as Error).message ?? "Unknown error";
  return `Failed to load linked data: ${message}`;
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || Number.isNaN(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}${suffix}`;
}

function averageValue(values: Array<number | null>): number | null {
  const numericValues = values.filter((value): value is number => value != null);
  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function sumValue(values: Array<number | null>): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function getTopGroup(rows: DashboardRow[], getValue: (row: DashboardRow) => string): string | null {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const key = getValue(row);
    if (key.trim() === "" || key === "N/A") {
      return;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  let topValue: string | null = null;
  let topCount = -1;

  counts.forEach((count, key) => {
    if (count > topCount) {
      topValue = key;
      topCount = count;
    }
  });

  return topValue;
}

function buildSelectionInsights(rows: DashboardRow[]): string[] {
  const avgDep = averageValue(rows.map((row) => row.averageDepDelay));
  const avgArr = averageValue(rows.map((row) => row.averageArrDelay));
  const totalVolume = sumValue(rows.map((row) => row.departingFlightCount));
  const completeCount = rows.filter((row) => row.completeHistory).length;
  const topCity = getTopGroup(rows, (row) => row.city);
  const topCategory = getTopGroup(rows, (row) => row.stateCode);

  return [
    `${rows.length.toLocaleString()} records are included in this selection.`,
    `Average departure delay is ${formatMetricValue(avgDep, " min")} and average arrival delay is ${formatMetricValue(avgArr, " min")}.`,
    `Total traffic or capacity across the selection is ${totalVolume.toLocaleString()}.`,
    `${completeCount.toLocaleString()} records are marked with complete history.`,
    topCity != null ? `Top location in this selection is ${topCity}.` : "No dominant location is available for this selection.",
    topCategory != null ? `Top category in this selection is ${topCategory}.` : "No dominant category is available for this selection.",
  ];
}

function buildRowInsights(row: DashboardRow): string[] {
  return [
    `Category: ${row.stateCode}.`,
    `Location: ${row.city}.`,
    `Departure delay: ${formatMetricValue(row.averageDepDelay, " min")}.`,
    `Arrival delay: ${formatMetricValue(row.averageArrDelay, " min")}.`,
    `Traffic or capacity: ${(row.departingFlightCount ?? 0).toLocaleString()}.`,
    row.completeHistory ? "This record has complete history." : "This record does not have complete history.",
  ];
}

function isInteractionMatch(
  interaction: PageInteractionState | null,
  title: string,
  subtitle: string,
): boolean {
  return interaction?.title === title && interaction.subtitle === subtitle;
}

function buildInteractionKey(
  title: string,
  subtitle: string,
  rowIds: string[],
): string {
  return `${subtitle}:${title}:${rowIds.join("|")}`;
}

function getPieSliceRows(
  datasetId: string,
  sliceLabel: string,
  rows: DashboardRow[],
): DashboardRow[] {
  if (datasetId === "example-airport") {
    if (sliceLabel.startsWith("Low Delay")) {
      return rows.filter((row) => (row.averageDepDelay ?? 0) < 5);
    }
    if (sliceLabel.startsWith("Medium Delay")) {
      return rows.filter((row) => {
        const value = row.averageDepDelay ?? 0;
        return value >= 5 && value < 15;
      });
    }
    if (sliceLabel.startsWith("High Delay")) {
      return rows.filter((row) => (row.averageDepDelay ?? 0) >= 15);
    }
  }

  if (datasetId === "example-route") {
    if (sliceLabel === "Low Traffic") {
      return rows.filter((row) => (row.departingFlightCount ?? 0) < 200);
    }
    if (sliceLabel === "Medium Traffic") {
      return rows.filter((row) => {
        const value = row.departingFlightCount ?? 0;
        return value >= 200 && value < 800;
      });
    }
    if (sliceLabel === "High Traffic") {
      return rows.filter((row) => (row.departingFlightCount ?? 0) >= 800);
    }
  }

  if (datasetId === "example-flight") {
    if (sliceLabel === "On Time") {
      return rows.filter((row) => (row.averageDepDelay ?? 0) <= 0);
    }
    if (sliceLabel === "Minor Delay") {
      return rows.filter((row) => {
        const value = row.averageDepDelay ?? 0;
        return value > 0 && value <= 15;
      });
    }
    if (sliceLabel === "Major Delay") {
      return rows.filter((row) => (row.averageDepDelay ?? 0) > 15);
    }
  }

  if (datasetId === "example-aircraft") {
    if (sliceLabel === "Low Utilization") {
      return rows.filter((row) => (row.departingFlightCount ?? 0) < 1000);
    }
    if (sliceLabel === "Medium Utilization") {
      return rows.filter((row) => {
        const value = row.departingFlightCount ?? 0;
        return value >= 1000 && value < 5000;
      });
    }
    if (sliceLabel === "High Utilization") {
      return rows.filter((row) => (row.departingFlightCount ?? 0) >= 5000);
    }
  }

  if (datasetId === "aircra") {
    return rows.filter((row) => {
      const status = row.stateCode === "N/A" ? "Unknown" : row.stateCode;
      return status === sliceLabel;
    });
  }

  return rows;
}

function DatasetPage({
  datasetId,
  buildMetrics,
  buildPieSlices,
  tableColumns,
  tableTitle,
}: DatasetPageProps) {
  const activeBinding = useMemo(
    () => getDashboardBindingById(datasetId),
    [datasetId],
  );

  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready to load from Foundry.");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState(ALL_FILTER_VALUE);
  const [locationFilter, setLocationFilter] = useState(ALL_FILTER_VALUE);
  const [historyFilter, setHistoryFilter] = useState<"all" | "complete" | "incomplete">(
    "all",
  );
  const [depDelayMin, setDepDelayMin] = useState("");
  const [depDelayMax, setDepDelayMax] = useState("");
  const [arrDelayMin, setArrDelayMin] = useState("");
  const [arrDelayMax, setArrDelayMax] = useState("");
  const [volumeMin, setVolumeMin] = useState("");
  const [volumeMax, setVolumeMax] = useState("");
  const [analysisModal, setAnalysisModal] = useState<AnalysisModalState | null>(null);
  const [pageInteraction, setPageInteraction] = useState<PageInteractionState | null>(null);
  const [pageRelatedState, setPageRelatedState] = useState<PageRelatedState>({
    key: null,
    loading: false,
    error: null,
    note: null,
    sections: [],
  });

  const loadRows = useCallback(async (force = false) => {
    if (activeBinding == null) {
      setRows([]);
      setStatus("Dataset not found.");
      return;
    }

    const cachedRows = !force ? activeBinding.peekRows() : null;
    if (cachedRows != null) {
      setRows(cachedRows.rows);
      setCurrentPage(1);
      setLastUpdated(
        cachedRows.loadedAt != null
          ? new Date(cachedRows.loadedAt).toLocaleString()
          : null,
      );

      if (cachedRows.rows.length === 0) {
        setStatus(
          "Connected to Foundry, but 0 rows were returned. Check object permissions, data availability, or object type binding.",
        );
      } else {
        setStatus(`Loaded ${cachedRows.rows.length} rows from cache.`);
      }
      return;
    }

    setLoading(true);
    setStatus(`Loading ${activeBinding.objectApiName} from Palantir Foundry...`);

    try {
      const fetched = await activeBinding.loadRows({ force });
      setRows(fetched);
      setCurrentPage(1);
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
    if (activeBinding == null) {
      return;
    }
    setSearch("");
    setCategoryFilter(ALL_FILTER_VALUE);
    setLocationFilter(ALL_FILTER_VALUE);
    setHistoryFilter("all");
    setDepDelayMin("");
    setDepDelayMax("");
    setArrDelayMin("");
    setArrDelayMax("");
    setVolumeMin("");
    setVolumeMax("");
    setCurrentPage(1);
    setAnalysisModal(null);
    setPageInteraction(null);
    setPageRelatedState({
      key: null,
      loading: false,
      error: null,
      note: null,
      sections: [],
    });
    void loadRows();
  }, [activeBinding, loadRows]);

  useEffect(() => {
    if (analysisModal == null) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setAnalysisModal(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [analysisModal]);

  const searchedRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (normalizedSearch === "") {
      return rows;
    }

    return rows.filter((row) => {
      return (
        row.id.toLowerCase().includes(normalizedSearch) ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.stateCode.toLowerCase().includes(normalizedSearch) ||
        row.city.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [rows, search]);

  const filterValues = useMemo<DatasetFilterValues>(() => {
    return {
      categoryFilter,
      locationFilter,
      historyFilter,
      depDelayMin: parseFilterNumber(depDelayMin),
      depDelayMax: parseFilterNumber(depDelayMax),
      arrDelayMin: parseFilterNumber(arrDelayMin),
      arrDelayMax: parseFilterNumber(arrDelayMax),
      volumeMin: parseFilterNumber(volumeMin),
      volumeMax: parseFilterNumber(volumeMax),
    };
  }, [
    categoryFilter,
    locationFilter,
    historyFilter,
    depDelayMin,
    depDelayMax,
    arrDelayMin,
    arrDelayMax,
    volumeMin,
    volumeMax,
  ]);

  const rowsForCategoryOptions = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues, { ignoreCategory: true });
  }, [searchedRows, filterValues]);

  const rowsForLocationOptions = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues, { ignoreLocation: true });
  }, [searchedRows, filterValues]);

  const rowsForDepDelayRange = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues, { ignoreDepDelay: true });
  }, [searchedRows, filterValues]);

  const rowsForArrDelayRange = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues, { ignoreArrDelay: true });
  }, [searchedRows, filterValues]);

  const rowsForVolumeRange = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues, { ignoreVolume: true });
  }, [searchedRows, filterValues]);

  const categoryOptions = useMemo(() => {
    return uniqueSorted(rowsForCategoryOptions.map((row) => row.stateCode));
  }, [rowsForCategoryOptions]);

  const categoryCountMap = useMemo(() => {
    return countByValue(rowsForCategoryOptions.map((row) => row.stateCode));
  }, [rowsForCategoryOptions]);

  const locationOptions = useMemo(() => {
    return uniqueSorted(rowsForLocationOptions.map((row) => row.city));
  }, [rowsForLocationOptions]);

  const locationCountMap = useMemo(() => {
    return countByValue(rowsForLocationOptions.map((row) => row.city));
  }, [rowsForLocationOptions]);

  const depDelayRange = useMemo(() => {
    return getNumericRange(rowsForDepDelayRange.map((row) => row.averageDepDelay));
  }, [rowsForDepDelayRange]);

  const arrDelayRange = useMemo(() => {
    return getNumericRange(rowsForArrDelayRange.map((row) => row.averageArrDelay));
  }, [rowsForArrDelayRange]);

  const volumeRange = useMemo(() => {
    return getNumericRange(rowsForVolumeRange.map((row) => row.departingFlightCount));
  }, [rowsForVolumeRange]);

  const filteredRows = useMemo(() => {
    return applyDatasetFilters(searchedRows, filterValues);
  }, [searchedRows, filterValues]);

  const selectedRowIds = useMemo(() => {
    return pageInteraction != null ? new Set(pageInteraction.rowIds) : null;
  }, [pageInteraction]);

  const interactiveRows = useMemo(() => {
    if (selectedRowIds == null) {
      return filteredRows;
    }

    return filteredRows.filter((row) => selectedRowIds.has(row.id));
  }, [filteredRows, selectedRowIds]);

  useEffect(() => {
    if (
      categoryFilter !== ALL_FILTER_VALUE &&
      !categoryOptions.includes(categoryFilter)
    ) {
      setCategoryFilter(ALL_FILTER_VALUE);
      setCurrentPage(1);
    }
  }, [categoryFilter, categoryOptions]);

  useEffect(() => {
    if (
      locationFilter !== ALL_FILTER_VALUE &&
      !locationOptions.includes(locationFilter)
    ) {
      setLocationFilter(ALL_FILTER_VALUE);
      setCurrentPage(1);
    }
  }, [locationFilter, locationOptions]);

  useEffect(() => {
    if (depDelayRange == null && (depDelayMin !== "" || depDelayMax !== "")) {
      setDepDelayMin("");
      setDepDelayMax("");
      setCurrentPage(1);
    }
  }, [depDelayRange, depDelayMin, depDelayMax]);

  useEffect(() => {
    if (arrDelayRange == null && (arrDelayMin !== "" || arrDelayMax !== "")) {
      setArrDelayMin("");
      setArrDelayMax("");
      setCurrentPage(1);
    }
  }, [arrDelayRange, arrDelayMin, arrDelayMax]);

  useEffect(() => {
    if (volumeRange == null && (volumeMin !== "" || volumeMax !== "")) {
      setVolumeMin("");
      setVolumeMax("");
      setCurrentPage(1);
    }
  }, [volumeRange, volumeMin, volumeMax]);

  const activeFilterCount = useMemo(() => {
    const numericFilters = [
      depDelayMin,
      depDelayMax,
      arrDelayMin,
      arrDelayMax,
      volumeMin,
      volumeMax,
    ].filter((value) => value.trim() !== "").length;

    let count = numericFilters;
    if (categoryFilter !== ALL_FILTER_VALUE) {
      count += 1;
    }
    if (locationFilter !== ALL_FILTER_VALUE) {
      count += 1;
    }
    if (historyFilter !== "all") {
      count += 1;
    }

    return count;
  }, [
    categoryFilter,
    locationFilter,
    historyFilter,
    depDelayMin,
    depDelayMax,
    arrDelayMin,
    arrDelayMax,
    volumeMin,
    volumeMax,
  ]);

  const clearFilters = useCallback(() => {
    setCategoryFilter(ALL_FILTER_VALUE);
    setLocationFilter(ALL_FILTER_VALUE);
    setHistoryFilter("all");
    setDepDelayMin("");
    setDepDelayMax("");
    setArrDelayMin("");
    setArrDelayMax("");
    setVolumeMin("");
    setVolumeMax("");
    setCurrentPage(1);
  }, []);

  const closeAnalysisModal = useCallback(() => {
    setAnalysisModal(null);
  }, []);

  const clearPageInteraction = useCallback(() => {
    setPageInteraction(null);
    setCurrentPage(1);
    setPageRelatedState({
      key: null,
      loading: false,
      error: null,
      note: null,
      sections: [],
    });
  }, []);

  const loadPageRelatedData = useCallback(
    async (
      selectionKey: string,
      selectionRows: DashboardRow[],
      options?: {
        loadAllRelated?: boolean;
      },
    ) => {
      const rowsForRelated = options?.loadAllRelated
        ? selectionRows
        : selectionRows.slice(0, RELATED_SELECTION_SAMPLE_LIMIT);

      setPageRelatedState({
        key: selectionKey,
        loading: rowsForRelated.length > 0 && activeBinding != null,
        error: null,
        note: null,
        sections: [],
      });

      if (activeBinding == null || rowsForRelated.length === 0) {
        return;
      }

      try {
        const sectionGroups = await Promise.all(
          rowsForRelated.map(async (row) => {
            const sourceObject = await activeBinding.fetchObjectById(row.id);
            return await loadRelatedDataSections(datasetId, sourceObject);
          }),
        );

        const mergedSections = mergeRelatedDataSections(sectionGroups);
        const scopeNote = !options?.loadAllRelated &&
          selectionRows.length > RELATED_SELECTION_SAMPLE_LIMIT
          ? `Linked data is sampled from ${RELATED_SELECTION_SAMPLE_LIMIT} matching records for speed.`
          : null;

        setPageRelatedState((currentState) => {
          if (currentState.key !== selectionKey) {
            return currentState;
          }

          return {
            key: selectionKey,
            loading: false,
            error: null,
            note: scopeNote,
            sections: mergedSections,
          };
        });
      } catch (error) {
        setPageRelatedState((currentState) => {
          if (currentState.key !== selectionKey) {
            return currentState;
          }

          return {
            key: selectionKey,
            loading: false,
            error: buildRelatedDataErrorMessage(error),
            note: null,
            sections: [],
          };
        });
      }
    },
    [activeBinding, datasetId],
  );

  const openSelectionAnalysis = useCallback(
    async (
      title: string,
      subtitle: string,
      description: string,
      selectionRows: DashboardRow[],
      options?: {
        loadAllRelated?: boolean;
      },
    ) => {
      const selectionKey = buildInteractionKey(
        title,
        subtitle,
        selectionRows.map((row) => row.id),
      );

      if (pageInteraction?.key === selectionKey) {
        clearPageInteraction();
        closeAnalysisModal();
        return;
      }

      setPageInteraction({
        key: selectionKey,
        title,
        subtitle,
        description,
        rowIds: selectionRows.map((row) => row.id),
        loadAllRelated: options?.loadAllRelated === true,
      });
      setCurrentPage(1);
      void loadPageRelatedData(selectionKey, selectionRows, options);

      const rowsForRelated = options?.loadAllRelated
        ? selectionRows
        : selectionRows.slice(0, RELATED_SELECTION_SAMPLE_LIMIT);

      setAnalysisModal({
        title,
        subtitle,
        description,
        insights: buildSelectionInsights(selectionRows),
        records: selectionRows.slice(0, 8),
        sourceRow: null,
        loadingRelated: rowsForRelated.length > 0 && activeBinding != null,
        error: null,
        sections: [],
      });

      if (activeBinding == null || rowsForRelated.length === 0) {
        return;
      }

      try {
        const sectionGroups = await Promise.all(
          rowsForRelated.map(async (row) => {
            const sourceObject = await activeBinding.fetchObjectById(row.id);
            return await loadRelatedDataSections(datasetId, sourceObject);
          }),
        );

        const mergedSections = mergeRelatedDataSections(sectionGroups);
        const scopeNote = !options?.loadAllRelated &&
          selectionRows.length > RELATED_SELECTION_SAMPLE_LIMIT
          ? ` Linked data is sampled from ${RELATED_SELECTION_SAMPLE_LIMIT} matching records for speed.`
          : "";

        setAnalysisModal({
          title,
          subtitle,
          description: `${description}${scopeNote}`,
          insights: buildSelectionInsights(selectionRows),
          records: selectionRows.slice(0, 8),
          sourceRow: null,
          loadingRelated: false,
          error: null,
          sections: mergedSections,
        });
      } catch (error) {
        setAnalysisModal({
          title,
          subtitle,
          description,
          insights: buildSelectionInsights(selectionRows),
          records: selectionRows.slice(0, 8),
          sourceRow: null,
          loadingRelated: false,
          error: buildRelatedDataErrorMessage(error),
          sections: [],
        });
      }
    },
    [
      activeBinding,
      clearPageInteraction,
      closeAnalysisModal,
      datasetId,
      loadPageRelatedData,
      pageInteraction,
    ],
  );

  const openRowAnalysis = useCallback(
    async (row: DashboardRow) => {
      if (activeBinding == null) {
        return;
      }

      const selectionKey = buildInteractionKey(
        row.name,
        `${activeBinding.title} record`,
        [row.id],
      );

      if (pageInteraction?.key === selectionKey) {
        clearPageInteraction();
        closeAnalysisModal();
        return;
      }

      setPageInteraction({
        key: selectionKey,
        title: row.name,
        subtitle: `${activeBinding.title} record`,
        description: `Focused record analysis for ${row.id}.`,
        rowIds: [row.id],
        loadAllRelated: true,
      });
      setCurrentPage(1);
      void loadPageRelatedData(selectionKey, [row], { loadAllRelated: true });

      setAnalysisModal({
        title: row.name,
        subtitle: `${activeBinding.title} record`,
        description: `Focused record analysis for ${row.id}.`,
        insights: buildRowInsights(row),
        records: [row],
        sourceRow: row,
        loadingRelated: true,
        error: null,
        sections: [],
      });

      try {
        const sourceObject = await activeBinding.fetchObjectById(row.id);
        const sections = await loadRelatedDataSections(datasetId, sourceObject);

        setAnalysisModal({
          title: row.name,
          subtitle: `${activeBinding.title} record`,
          description: `Focused record analysis for ${row.id}.`,
          insights: buildRowInsights(row),
          records: [row],
          sourceRow: row,
          loadingRelated: false,
          error: null,
          sections,
        });
      } catch (error) {
        setAnalysisModal({
          title: row.name,
          subtitle: `${activeBinding.title} record`,
          description: `Focused record analysis for ${row.id}.`,
          insights: buildRowInsights(row),
          records: [row],
          sourceRow: row,
          loadingRelated: false,
          error: buildRelatedDataErrorMessage(error),
          sections: [],
        });
      }
    },
    [
      activeBinding,
      clearPageInteraction,
      closeAnalysisModal,
      datasetId,
      loadPageRelatedData,
      pageInteraction,
    ],
  );

  const metrics = useMemo(() => buildMetrics(interactiveRows), [buildMetrics, interactiveRows]);

  const pieSlices = useMemo(() => {
    return buildPieSlices(interactiveRows).filter((slice) => slice.value > 0);
  }, [buildPieSlices, interactiveRows]);

  const pieTotal = useMemo(() => {
    return pieSlices.reduce((sum, slice) => sum + slice.value, 0);
  }, [pieSlices]);

  const pieGradient = useMemo(() => {
    if (pieTotal === 0) {
      return "conic-gradient(#dce8f5 0deg 360deg)";
    }

    let current = 0;
    const stops = pieSlices.map((slice) => {
      const start = current;
      const angle = (slice.value / pieTotal) * 360;
      current += angle;
      return `${slice.color} ${start}deg ${current}deg`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [pieSlices, pieTotal]);

  const trafficBars = useMemo<BarPoint[]>(() => {
    return interactiveRows
      .map((row) => ({
        label: row.name === "N/A" ? row.id : row.name,
        value: row.departingFlightCount ?? 0,
      }))
      .filter((point) => point.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [interactiveRows]);

  const trafficMax = useMemo(() => {
    return Math.max(1, ...trafficBars.map((point) => point.value));
  }, [trafficBars]);

  const cityBars = useMemo<BarPoint[]>(() => {
    const cityCount = new Map<string, number>();

    interactiveRows.forEach((row) => {
      const city = row.city === "N/A" ? "Unknown" : row.city;
      cityCount.set(city, (cityCount.get(city) ?? 0) + 1);
    });

    return [...cityCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));
  }, [interactiveRows]);

  const cityMax = useMemo(() => {
    return Math.max(1, ...cityBars.map((point) => point.value));
  }, [cityBars]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(interactiveRows.length / TABLE_PAGE_SIZE));
  }, [interactiveRows.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const tableRows = useMemo(() => {
    const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE;
    return interactiveRows.slice(startIndex, startIndex + TABLE_PAGE_SIZE);
  }, [currentPage, interactiveRows]);

  const rowStart = interactiveRows.length === 0 ? 0 : (currentPage - 1) * TABLE_PAGE_SIZE + 1;
  const rowEnd = Math.min(currentPage * TABLE_PAGE_SIZE, interactiveRows.length);

  if (activeBinding == null) {
    return (
      <Layout>
        <div className={css.dashboard}>
          <section className={css.hero}>
            <h1>Dataset Not Found</h1>
            <p>The requested dataset page does not exist in this SDK.</p>
          </section>
          <Link to="/" className={css.backLink}>
            Back to Home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={css.dashboard}>
        <section className={css.hero}>
          <h1>{activeBinding.title}</h1>
          <p>{activeBinding.description}</p>
        </section>

        <section className={css.filterPanel}>
          <div className={css.filterHeader}>
            <h2>
              Filters
              {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </h2>
            <div className={css.filterActions}>
              <button onClick={() => void loadRows(true)} disabled={loading}>
                {loading ? "Loading..." : "Refresh Data"}
              </button>
              <button
                type="button"
                className={css.clearFilters}
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className={css.filterGrid}>
            <div className={css.filterGroup} data-search="true">
              <label htmlFor="search">Search</label>
              <input
                id="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ID, name, state, or city"
              />
            </div>

            <div className={css.filterGroup}>
              <label htmlFor="categoryFilter">Category</label>
              <select
                id="categoryFilter"
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value={ALL_FILTER_VALUE}>All</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} ({categoryCountMap.get(option) ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className={css.filterGroup}>
              <label htmlFor="locationFilter">Location</label>
              <select
                id="locationFilter"
                value={locationFilter}
                onChange={(event) => {
                  setLocationFilter(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value={ALL_FILTER_VALUE}>All</option>
                {locationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option} ({locationCountMap.get(option) ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div className={css.filterGroup}>
              <label htmlFor="historyFilter">Complete History</label>
              <select
                id="historyFilter"
                value={historyFilter}
                onChange={(event) => {
                  setHistoryFilter(
                    event.target.value as "all" | "complete" | "incomplete",
                  );
                  setCurrentPage(1);
                }}
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="incomplete">Incomplete</option>
              </select>
            </div>

            <div className={css.filterGroup} data-wide="true">
              <span className={css.groupLabel}>Departure Delay</span>
              <div className={css.rangeInputs}>
                <input
                  type="number"
                  step="0.1"
                  value={depDelayMin}
                  onChange={(event) => {
                    setDepDelayMin(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={depDelayRange != null ? `Min ${depDelayRange.min.toFixed(1)}` : "Min"}
                  disabled={depDelayRange == null}
                />
                <input
                  type="number"
                  step="0.1"
                  value={depDelayMax}
                  onChange={(event) => {
                    setDepDelayMax(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={depDelayRange != null ? `Max ${depDelayRange.max.toFixed(1)}` : "Max"}
                  disabled={depDelayRange == null}
                />
              </div>
            </div>

            <div className={css.filterGroup} data-wide="true">
              <span className={css.groupLabel}>Arrival Delay</span>
              <div className={css.rangeInputs}>
                <input
                  type="number"
                  step="0.1"
                  value={arrDelayMin}
                  onChange={(event) => {
                    setArrDelayMin(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={arrDelayRange != null ? `Min ${arrDelayRange.min.toFixed(1)}` : "Min"}
                  disabled={arrDelayRange == null}
                />
                <input
                  type="number"
                  step="0.1"
                  value={arrDelayMax}
                  onChange={(event) => {
                    setArrDelayMax(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={arrDelayRange != null ? `Max ${arrDelayRange.max.toFixed(1)}` : "Max"}
                  disabled={arrDelayRange == null}
                />
              </div>
            </div>

            <div className={css.filterGroup} data-wide="true">
              <span className={css.groupLabel}>Traffic / Capacity</span>
              <div className={css.rangeInputs}>
                <input
                  type="number"
                  step="0.1"
                  value={volumeMin}
                  onChange={(event) => {
                    setVolumeMin(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={volumeRange != null ? `Min ${volumeRange.min.toFixed(1)}` : "Min"}
                  disabled={volumeRange == null}
                />
                <input
                  type="number"
                  step="0.1"
                  value={volumeMax}
                  onChange={(event) => {
                    setVolumeMax(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={volumeRange != null ? `Max ${volumeRange.max.toFixed(1)}` : "Max"}
                  disabled={volumeRange == null}
                />
              </div>
            </div>
          </div>
        </section>

        <p className={css.status}>
          {status}
          {lastUpdated != null ? ` Last updated: ${lastUpdated}.` : ""}
        </p>

        {pageInteraction != null ? (
          <section className={css.selectionBanner}>
            <div className={css.selectionContent}>
              <p className={css.selectionKicker}>Interactive Focus</p>
              <h2>{pageInteraction.title}</h2>
              <p className={css.selectionText}>
                {pageInteraction.description}
              </p>
            </div>
            <div className={css.selectionActions}>
              <span className={css.selectionMeta}>
                {interactiveRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()} rows active
              </span>
              <button
                type="button"
                className={css.clearSelection}
                onClick={clearPageInteraction}
              >
                Clear Selection
              </button>
            </div>
          </section>
        ) : null}

        {pageInteraction != null ? (
          <section className={`${css.panel} ${css.pageRelatedPanel}`}>
            <div className={css.relatedSectionHeader}>
              <h2>Linked Data From Related Pages</h2>
              <span>{pageInteraction.subtitle}</span>
            </div>
            {pageRelatedState.note != null ? (
              <p className={css.sectionText}>{pageRelatedState.note}</p>
            ) : null}
            {pageRelatedState.loading ? (
              <p className={css.empty}>
                Loading linked data from related datasets...
              </p>
            ) : pageRelatedState.error != null ? (
              <p className={css.empty}>{pageRelatedState.error}</p>
            ) : pageRelatedState.sections.length > 0 ? (
              <div className={css.relatedGrid}>
                {pageRelatedState.sections.map((section) => (
                  <article className={css.relatedSection} key={`page-${section.key}`}>
                    <div className={css.relatedSectionHeader}>
                      <h3>{section.label}</h3>
                      <span>{section.items.length} records</span>
                    </div>

                    {section.items.length === 0 ? (
                      <p className={css.empty}>{section.emptyMessage}</p>
                    ) : (
                      <ul className={css.relatedList}>
                        {section.items.map((item) => (
                          <li
                            key={`page-${section.key}-${item.id}`}
                            className={css.relatedItem}
                          >
                            <strong>{item.title}</strong>
                            <span>{item.subtitle}</span>
                            <p>{item.detail}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className={css.empty}>
                No linked cross-dataset records are available for this selection.
              </p>
            )}
          </section>
        ) : null}

        <section className={css.metrics}>
          {metrics.map((metric) => (
            <button
              type="button"
              className={`${css.card} ${css.interactiveCard} ${
                isInteractionMatch(pageInteraction, metric.label, `${activeBinding.title} metric`)
                  ? css.selectedSurface
                  : ""
              }`}
              key={metric.label}
              onClick={() => {
                void openSelectionAnalysis(
                  metric.label,
                  `${activeBinding.title} metric`,
                  `This metric reflects the current filtered dataset snapshot.`,
                  interactiveRows,
                );
              }}
            >
              <h2>{metric.label}</h2>
              <p>{metric.value}</p>
            </button>
          ))}
        </section>

        <section className={css.vizGrid}>
          <article className={css.panel}>
            <h2>Pie Chart</h2>
            <p className={css.sectionText}>
              Legend shows each segment name, share, and record count.
            </p>
            {pieTotal === 0 ? (
              <p className={css.empty}>No chart data available.</p>
            ) : (
              <div className={css.pieWrap}>
                <div
                  className={css.pie}
                  style={{ background: pieGradient }}
                  aria-label="Pie chart"
                />
                <ul className={css.legend}>
                  {pieSlices.map((slice) => {
                    const share = pieTotal === 0 ? 0 : (slice.value / pieTotal) * 100;

                    return (
                    <li key={slice.label}>
                      <button
                        type="button"
                        className={`${css.legendButton} ${
                          isInteractionMatch(pageInteraction, slice.label, `${activeBinding.title} pie segment`)
                            ? css.selectedSurface
                            : ""
                        }`}
                        onClick={() => {
                          const sliceRows = getPieSliceRows(datasetId, slice.label, interactiveRows);
                          const share = interactiveRows.length === 0
                            ? 0
                            : (slice.value / interactiveRows.length) * 100;

                        void openSelectionAnalysis(
                          slice.label,
                          `${activeBinding.title} pie segment`,
                          `${slice.value.toLocaleString()} records fall into this segment, representing ${share.toFixed(1)}% of the current filtered view.`,
                          sliceRows,
                          { loadAllRelated: true },
                        );
                      }}
                    >
                        <span
                          className={css.swatch}
                          style={{ backgroundColor: slice.color }}
                          aria-hidden
                        />
                        <span className={css.legendLabelGroup}>
                          <span className={css.legendLabel}>{slice.label}</span>
                          <span className={css.legendMeta}>{share.toFixed(1)}% of current view</span>
                        </span>
                        <strong>{slice.value}</strong>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </article>

          <article className={css.panel}>
            <h2>Top Traffic</h2>
            {trafficBars.length === 0 ? (
              <p className={css.empty}>No traffic values available.</p>
            ) : (
              <ul className={css.barList}>
                {trafficBars.map((point, index) => (
                  <li key={`${point.label}-${index}`} className={css.barItem}>
                    <button
                      type="button"
                      className={`${css.barButton} ${
                        isInteractionMatch(pageInteraction, point.label, `${activeBinding.title} traffic bar`)
                          ? css.selectedSurface
                          : ""
                      }`}
                      onClick={() => {
                        const matchingRows = interactiveRows.filter((row) => {
                          const label = row.name === "N/A" ? row.id : row.name;
                          return label === point.label;
                        });

                        void openSelectionAnalysis(
                          point.label,
                          `${activeBinding.title} traffic bar`,
                          `${point.value.toLocaleString()} is the traffic or capacity value for this highlighted record.`,
                          matchingRows,
                        );
                      }}
                    >
                      <div className={css.barHeader}>
                        <span title={point.label}>{point.label}</span>
                        <strong>{point.value.toLocaleString()}</strong>
                      </div>
                      <div className={css.barTrack}>
                        <span
                          className={css.barFill}
                          style={{ width: `${(point.value / trafficMax) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={css.panel}>
            <h2>Top Cities</h2>
            {cityBars.length === 0 ? (
              <p className={css.empty}>No city distribution data available.</p>
            ) : (
              <ul className={css.barList}>
                {cityBars.map((point, index) => (
                  <li key={`${point.label}-${index}`} className={css.barItem}>
                    <button
                      type="button"
                      className={`${css.barButton} ${
                        isInteractionMatch(pageInteraction, point.label, `${activeBinding.title} city distribution`)
                          ? css.selectedSurface
                          : ""
                      }`}
                      onClick={() => {
                        const matchingRows = interactiveRows.filter((row) => {
                          const city = row.city === "N/A" ? "Unknown" : row.city;
                          return city === point.label;
                        });

                        void openSelectionAnalysis(
                          point.label,
                          `${activeBinding.title} city distribution`,
                          `${point.value.toLocaleString()} records belong to this city group in the current filtered view.`,
                          matchingRows,
                        );
                      }}
                    >
                      <div className={css.barHeader}>
                        <span title={point.label}>{point.label}</span>
                        <strong>{point.value.toLocaleString()}</strong>
                      </div>
                      <div className={css.barTrack}>
                        <span
                          className={`${css.barFill} ${css.barFillAlt}`}
                          style={{ width: `${(point.value / cityMax) * 100}%` }}
                        />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className={`${css.panel} ${css.tablePanel}`}>
          <h2>{tableTitle}</h2>
          <div className={css.tableMeta}>
            <p>
              Showing {rowStart}-{rowEnd} of {interactiveRows.length} rows
            </p>
            <div className={css.pager}>
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </button>
              <span>
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
          {tableRows.length === 0 ? (
            <p className={css.empty}>No rows available.</p>
          ) : (
            <div className={css.tableWrap}>
              <table className={css.table}>
                <thead>
                  <tr>
                    {tableColumns.map((column) => (
                      <th key={column.header}>{column.header}</th>
                    ))}
                    <th>Linked Data</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`${css.tableRow} ${
                        pageInteraction?.rowIds.includes(row.id) ? css.selectedSurface : ""
                      }`}
                    >
                      {tableColumns.map((column) => (
                        <td key={column.header}>
                          <button
                            type="button"
                            className={css.tableCellButton}
                            onClick={() => {
                              void openRowAnalysis(row);
                            }}
                          >
                            {column.getValue(row)}
                          </button>
                        </td>
                      ))}
                      <td className={css.tableActionCell}>
                        <button
                          type="button"
                          className={css.relatedButton}
                          onClick={() => {
                            void openRowAnalysis(row);
                          }}
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {analysisModal != null ? (
          <div className={css.modalOverlay}>
            <button
              type="button"
              className={css.modalBackdrop}
              aria-label="Close analysis"
              onClick={closeAnalysisModal}
            />
            <section
              className={css.modalDialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="analysis-modal-title"
            >
              <div className={css.modalHeader}>
                <div>
                  <p className={css.modalKicker}>Data Analysis</p>
                  <h2 id="analysis-modal-title">{analysisModal.title}</h2>
                  <p className={css.modalMeta}>
                    {analysisModal.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  className={css.modalClose}
                  onClick={closeAnalysisModal}
                >
                  Close
                </button>
              </div>

              <p className={css.modalDescription}>{analysisModal.description}</p>

              <div className={css.analysisLayout}>
                <article className={css.analysisPanel}>
                  <h3>Key Insights</h3>
                  <ul className={css.insightList}>
                    {analysisModal.insights.map((insight) => (
                      <li key={insight}>{insight}</li>
                    ))}
                  </ul>
                </article>

                <article className={css.analysisPanel}>
                  <div className={css.relatedSectionHeader}>
                    <h3>Matching Records</h3>
                    <span>{analysisModal.records.length} shown</span>
                  </div>
                  {analysisModal.records.length === 0 ? (
                    <p className={css.empty}>No matching records were found for this selection.</p>
                  ) : (
                    <ul className={css.recordList}>
                      {analysisModal.records.map((row) => (
                        <li key={row.id} className={css.recordItem}>
                          <strong>{row.name}</strong>
                          <span>{row.id}</span>
                          <p>
                            {row.stateCode} · {row.city} · {formatMetricValue(row.averageDepDelay, " min")} dep delay
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              {analysisModal.loadingRelated ? (
                <p className={css.empty}>
                  Loading related data from linked datasets...
                </p>
              ) : analysisModal.error != null ? (
                <p className={css.empty}>{analysisModal.error}</p>
              ) : analysisModal.sections.length > 0 ? (
                <div className={css.relatedGrid}>
                  {analysisModal.sections.map((section) => (
                    <article className={css.relatedSection} key={section.key}>
                      <div className={css.relatedSectionHeader}>
                        <h3>{section.label}</h3>
                        <span>{section.items.length} records</span>
                      </div>

                      {section.items.length === 0 ? (
                        <p className={css.empty}>{section.emptyMessage}</p>
                      ) : (
                        <ul className={css.relatedList}>
                          {section.items.map((item) => (
                            <li
                              key={`${section.key}-${item.id}`}
                              className={css.relatedItem}
                            >
                              <strong>{item.title}</strong>
                              <span>{item.subtitle}</span>
                              <p>{item.detail}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              ) : analysisModal.sourceRow != null ? (
                <p className={css.empty}>
                  No linked object sets are configured for this record.
                </p>
              ) : (
                <p className={css.empty}>
                  No linked cross-dataset records are available for this selection.
                </p>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
}

export default DatasetPage;
