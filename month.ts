import { fetchEach } from "./fetchEach.js";
import { Env } from "./types.js";

interface DailyData {
  [key: string]: number;
}

interface MonthlyData {
  [key: string]: number;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const limit = url.searchParams.get("limit");
    const monthParam = url.pathname.slice(1); // Remove leading slash
    const cacheKey = `month-v1-${monthParam}`;

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return new Response("Invalid month format. Use YYYY-MM", {
        status: 400,
      });
    }

    try {
      // Check if we already have this month's data in KV
      const cachedData = await env.GITHUB_STARS_CACHE.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const entries = Object.entries(parsed);
        const limited =
          limit && !isNaN(Number(limit))
            ? entries.slice(0, Number(limit))
            : entries;
        const obj = Object.fromEntries(limited);
        return new Response(JSON.stringify(obj, undefined, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const [yearStr, monthStr] = monthParam.split("-");
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const daysInMonth = getDaysInMonth(year, month);

      // Create URLs for each day in the month
      const urls = Array.from({ length: daysInMonth }, (_, day) => {
        const dayStr = (day + 1).toString().padStart(2, "0");
        // 25k limit because that makes a total of 30 times 800kb = 24mb
        return `https://stars.forgithub.com/${yearStr}-${monthStr}-${dayStr}?limit=25000`;
      });

      console.log({ urls });

      // Use fetchEach to fetch all days
      const results = await fetchEach<DailyData>(urls, {
        apiKey: "SECRECY",
        basePath: "https://fetch-each.actionschema.com/ep",
        log: (update) => console.log("Fetch progress:", update),
      });

      // Filter successful responses and get their data
      const dailyData = results
        .filter((result) => result.status === 200 && result.result)
        .map((result) => result.result!);

      console.log("DONE", dailyData.length);

      // Aggregate the data
      const aggregatedData: MonthlyData = {};

      for (const dayData of dailyData) {
        // Combine repository data
        for (const [repo, count] of Object.entries(dayData)) {
          aggregatedData[repo] =
            (aggregatedData[repo] || 0) + (count as number);
        }
      }

      // Create array of [key, value] pairs and sort by count
      const sortedEntries = Object.entries(aggregatedData).sort(
        ([, a], [, b]) => b - a,
      );

      // Create object from sorted entries
      const final = Object.fromEntries(sortedEntries);

      // Store in KV
      await env.GITHUB_STARS_CACHE.put(cacheKey, JSON.stringify(final));

      const entries = Object.entries(aggregatedData);
      const limited =
        limit && !isNaN(Number(limit))
          ? entries.slice(0, Number(limit))
          : entries;
      const obj = Object.fromEntries(limited);

      return new Response(JSON.stringify(obj, undefined, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      console.error("Error processing request:", error);
      return new Response("Internal Server Error: " + error.message, {
        status: 500,
      });
    }
  },
};
