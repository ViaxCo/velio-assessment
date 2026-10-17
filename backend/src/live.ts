import type { Response } from "express";
import { Redis } from "ioredis";
import { availabilityLatency, openStreams } from "./metrics.ts";

const CHANNEL = "availability";
const HEARTBEAT_MS = 15_000;

export type AvailabilityEvent = {
  activityId: string;
  spotsTaken: number;
  capacity: number;
  version: number;
  committedAt: number;
};

type Stream = { res: Response; activityId?: string };

export function createLive(redisUrl: string) {
  const publisher = new Redis(redisUrl);
  const subscriber = new Redis(redisUrl);
  const streams = new Set<Stream>();

  const ready = subscriber.subscribe(CHANNEL);
  subscriber.on("message", (_channel, message: string) => {
    const event: AvailabilityEvent = JSON.parse(message);
    for (const stream of streams) {
      if (stream.activityId && stream.activityId !== event.activityId) continue;
      stream.res.write(`data: ${message}\n\n`);
      availabilityLatency.observe((Date.now() - event.committedAt) / 1000);
    }
  });

  return {
    ready,

    async publish(event: AvailabilityEvent) {
      try {
        await publisher.publish(CHANNEL, JSON.stringify(event));
      } catch (error) {
        console.error("Failed to publish availability", error);
      }
    },

    open(res: Response, activityId?: string) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 2000\n\n");
      const stream = { res, activityId };
      const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
      streams.add(stream);
      openStreams.inc();
      res.on("close", () => {
        clearInterval(heartbeat);
        streams.delete(stream);
        openStreams.dec();
      });
    },

    async close() {
      for (const { res } of streams) res.end();
      await Promise.all([publisher.quit(), subscriber.quit()]);
    },
  };
}

export type Live = ReturnType<typeof createLive>;
