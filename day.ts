// import { fetchEach } from "@cfa/fetch-each";
import { Env } from "./types.js";
import { fetchEach } from "./fetchEach.js";

interface HourlyData {
  [key: string]: number;
}

interface DailyData {
  [key: string]: number;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const dateParam = url.pathname.slice(1); // Remove leading slash
    const cacheKey = `v2-${dateParam}`;
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return new Response("Invalid date format. Use YYYY-MM-DD", {
        status: 400,
      });
    }

    try {
      // Check if we already have this date's data in KV
      const cachedData = await env.GITHUB_STARS_CACHE.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const entries = Object.entries(parsed.repositories);
        const limited =
          limit && !isNaN(Number(limit))
            ? entries.slice(0, Number(limit))
            : entries;
        const obj = Object.fromEntries(limited);
        parsed.repositories = obj;
        return new Response(JSON.stringify(parsed, undefined, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Create URLs for each hour (0-23)
      const urls = Array.from(
        { length: 24 },
        (_, hour) => `https://gharchive.uithub.com/api/${dateParam}-${hour}`,
      );

      console.log({ urls });

      // Use fetchEach to fetch all hours
      const results = await fetchEach<HourlyData>(urls, {
        apiKey: "SECRECY",
        basePath: "https://fetch-each.actionschema.com/ep",
        log: (update) => console.log("Fetch progress:", update),
      });

      // Filter successful responses and get their data
      const hourlyData = results
        .filter((result) => result.status === 200 && result.result)
        .map((result) => result.result!);

      console.log("DONE", hourlyData.length);
      // Aggregate the data
      const aggregatedData: DailyData = {};

      for (const hourData of hourlyData) {
        // Combine repository data
        for (const [repo, count] of Object.entries(hourData.repositories)) {
          aggregatedData[repo] = (aggregatedData[repo] || 0) + count;
        }
      }

      // Create array of [key, value] pairs and sort once
      const sortedEntries = Object.entries(aggregatedData).sort(
        ([, a], [, b]) => b - a,
      );

      // Create object directly from sorted entries
      const final = Object.fromEntries(sortedEntries);

      // Store in KV
      await env.GITHUB_STARS_CACHE.put(cacheKey, JSON.stringify(final));

      const entries = Object.entries(final);

      const limited =
        limit && !isNaN(Number(limit))
          ? entries.slice(0, Number(limit))
          : entries;

      const obj = Object.fromEntries(limited);

      return new Response(
        JSON.stringify({ ...aggregatedData, repositories: obj }, undefined, 2),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error: any) {
      console.error("Error processing request:", error);
      return new Response("Internal Server Error:" + error.message, {
        status: 500,
      });
    }
  },
};
