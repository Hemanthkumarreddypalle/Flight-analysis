import { ExampleAirport } from "@god/sdk";
import client from "./client";
import type { Osdk } from "@osdk/client";

/**
 * Fetches every ExampleAirport row by traversing all pages.
 */
export async function fetchAllAirports(
  pageSize = 100,
): Promise<Osdk.Instance<ExampleAirport>[]> {
  const all: Osdk.Instance<ExampleAirport>[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await client(ExampleAirport).fetchPage({
      $pageSize: pageSize,
      $includeAllBaseObjectProperties: true,
      ...(nextPageToken != null ? { $nextPageToken: nextPageToken } : {}),
    });

    all.push(...page.data);
    nextPageToken = page.nextPageToken ?? undefined;
  } while (nextPageToken != null);

  return all;
}
