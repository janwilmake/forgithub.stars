import { fetchEach } from "./fetchEach.js";
import { Env } from "./types.js";

interface HourlyData {
  path: string;
  totalWatches: number;
  repositories: {
    [key: string]: number;
  };
}

interface WeeklyData {
  weekNumber: string; // YYYY-WW format
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalWatches: number;
  repositories: {
    [key: string]: number;
  };
}

function getWeekDates(yearWeek: string): {
  startDate: string;
  endDate: string;
} {
  // Parse YYYY-WW format
  const [year, week] = yearWeek.split("-W").map(Number);

  // Create date for January 1st of the year
  const januaryFirst = new Date(year, 0, 1);

  // Get the day of the week for January 1st (0 = Sunday, 1 = Monday, etc.)
  const dayOfWeek = januaryFirst.getDay();

  // Calculate days to add to get to first week
  const daysToAdd = (week - 1) * 7 - dayOfWeek + 1;

  // Calculate start date
  const startDate = new Date(year, 0, 1 + daysToAdd);

  // Calculate end date (6 days after start date)
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  // Format dates as YYYY-MM-DD
  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

function generateHourlyUrls(startDate: string, endDate: string): string[] {
  const urls: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    // Generate 24 URLs for each day
    for (let hour = 0; hour < 24; hour++) {
      urls.push(`https://stars.uithub.com/api/${dateStr}-${hour}`);
    }
    current.setDate(current.getDate() + 1);
  }

  return urls;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only handle GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const weekParam = url.pathname.slice(1); // Remove leading slash

    // Validate week format (YYYY-W1 to YYYY-W52)
    if (!/^\d{4}-W(0?[1-9]|[1-4][0-9]|5[0-2])$/.test(weekParam)) {
      return new Response("Invalid week format. Use YYYY-W1 to YYYY-W52", {
        status: 400,
      });
    }

    try {
      // Check if we already have this week's data in KV
      const cachedData = await env.GITHUB_STARS_CACHE.get(weekParam);
      if (cachedData) {
        return new Response(cachedData, {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get start and end dates for the week
      const { startDate, endDate } = getWeekDates(weekParam);

      // Generate URLs for each hour of each day in the week
      const urls = generateHourlyUrls(startDate, endDate);
      console.log(
        `Fetching ${urls.length} hourly data points for week ${weekParam}`,
      );

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

      console.log(
        `Successfully fetched ${hourlyData.length} hourly data points`,
      );

      // Aggregate the data
      const aggregatedData: WeeklyData = {
        weekNumber: weekParam,
        startDate,
        endDate,
        totalWatches: 0,
        repositories: {},
      };

      for (const hourData of hourlyData) {
        // Add to total watches
        aggregatedData.totalWatches += hourData.totalWatches;

        // Combine repository data
        for (const [repo, count] of Object.entries(hourData.repositories)) {
          aggregatedData.repositories[repo] =
            (aggregatedData.repositories[repo] || 0) + count;
        }
      }

      // Sort repositories by watch count (descending)
      const sortedRepos = Object.entries(aggregatedData.repositories).sort(
        ([, a], [, b]) => b - a,
      );

      aggregatedData.repositories = Object.fromEntries(sortedRepos);

      // Store in KV
      await env.GITHUB_STARS_CACHE.put(
        weekParam,
        JSON.stringify(aggregatedData),
      );

      return new Response(JSON.stringify(aggregatedData), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

// seems great, but if it's too large, let's do it using a binding to self, fetching 7x the day endpoint. it matters little, but effectively this will reduce the total size of responses a lot because of intermediate aggregation.
