/** This is a doc comment above the imports. it is the first doc comment and it's in the outer loop
 *
 * It has multiple lines
 */

import { Env } from "./types.js";
import day from "./day.js";
import week from "./week.js";
import month from "./month.js";

export default {
  fetch: (request: Request, env: Env) => {
    const path = new URL(request.url).pathname.slice(1);

    if (/^\d{4}-\d{2}-\d{2}$/.test(path)) {
      return day.fetch(request, env);
    }
    if (/^\d{4}-W(0?[1-9]|[1-4][0-9]|5[0-2])$/.test(path)) {
      return week.fetch(request, env);
    }
    if (/^\d{4}-\d{2}$/.test(path)) {
      return month.fetch(request, env);
    }

    if (path === "month") {
      // last 30 days
    }
    if (path === "week") {
      //last 7 days
    }

    // The root should respond with the last 7*24 hours that are found.
    return new Response(
      "Please fetch YYYY-MM-DD-H, YYYY-MM-DD, or YYYY-W1-52",
      { status: 405 },
    );

    // after this api works, share it with the world... maybe add ?amount param. this is soooo much more useful than gharchive. i guess making it open source will lead to people contributing more usecases.
  },
};
