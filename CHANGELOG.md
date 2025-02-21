# 2025-01-21

Today I was working on fetching the most popular repos from the github api, but I quickly found that it is not possible to do more than a thousand popular repos because that's the limit of Github.

But luckily there is another way to do this. [gharchive.org](https://www.gharchive.org) has an archive of all Github events since 2011. They have everything. They have stars, they have issue creation, repo creation... and many more events which you can all find [here](https://docs.github.com/en/rest/using-the-rest-api/github-event-types?apiVersion=2022-11-28).

My plan now is to get the top 100,000 popular GitHub repos that are recently popular. I can't just look at stars; I need to actually look at activity, right? So gh archive is actually perfect for that.

In order to get a hundred thousand most active GitHub repos, I wanted to look at all the watch events that took place in 2024. All the gh-archive files are JSON.gz files, which are line-separated JSONs that can be streamed. The problem is that one file can easily be 400-500 MB, and CloudSphere unfortunately runs out of CPU.

A regular Cloudflare worker only has 30 seconds of CPU available. You can increase that to up to 15 minutes if you do a scheduled cron job, but I don't want to do it in a scheduled recurring fashion. I only want to do it once, so a cron job wouldn't be very useful.

The only way, after doing a lot of research on the Cloudflare documentation, I've found that there is one way though. We could also split it up in queues and process it by going through a queue. But a queue is also quite annoying because you need to catch the results in the end again and it's just a big hassle.

But there is one other way that I think it is quite cool. I found that durable objects actually allow you to split up a request to a worker into as many requests as you want to as many durable objects that you want, that do a small part of your computation

What I'm doing now is processing any hour into intense separate chunks where every chunk does a range request to the GZ file so that it would only process basically the same time. That way we can do it in parallel, every request is 10%, and because we know these lines are lines separated, this is quite effective because we know that these lines are not that long and if we miss one line, it's not a big deal for my use case.

So doing this in completely parallel will work. That can now be found in the hour-parallel.ts file, and this basically responds with the entire hour but inside of the function, it went into 10 partial requests to durable objects.

Then you can also find another function called day.ts where you will find that it will use my fetchEach function to build up a queue and fetch every hour of a day in one go and then return a JSON for that day.

So now I have JSONs where it counts the amount of new stars for any given repo in a day and I would have all the new stars that were given on any given day. That's the day endpoint.

There is one final endpoint called `week`. If you pass the year, 'w', and the week number, it will respond with all the hours that occurred in that week aggregated. It will do the same amount of fetches as the number of weeks requested. This response in the fetch from that each will be about 50 MB. So it's kind of borderline to do this because if that gets any bigger we could have a problem. But it's still possible it seems, so let's do it. If we run into trouble, we can change this logic to something else later. For now, I think it will work. If it's too large, let's do it using a binding to self, fetching 7x the day endpoint. it matters little, but effectively this will reduce the total size of responses a lot because of intermediate aggregation.
