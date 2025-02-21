# Stars for GitHub

Requirements: use the API at https://archive.forgithub.com and create a cached API to retrieve new stars events, that has the following endpoints:

- `/{date}` - specific date
- `/{year}-{month}` - specific month
- `/{year}-W{week}` - specific week
- `/day` - last 24 hours
- `/week` - last 7 days
- `/month` - last 30 days

# TODO: Top new stars of last 30 days

✅ Created `uithub.gharchive` and `uithub.stars` to count new stars.

Figure out why day, week, and month still don't work. fetchEach seems to be failing. day=24, week=7day, month=30days. Should be possible with https://github.com/janwilmake/fetch-each. prime usecase! However, a queue is also possible.

Also add `/day` and `/week` and `/month` endpoints, use a cloudflare cronjob or durable object with alarm in combination with a queue, so they stay fresh properly.

Apply `?limit=` param after result (limit to N results)

Create OpenAPI

# Useful resources

- https://docs.uithub.com
- https://developers.cloudflare.com/workers/
- https://developers.cloudflare.com/queues/
- https://developers.cloudflare.com/durable-objects/
