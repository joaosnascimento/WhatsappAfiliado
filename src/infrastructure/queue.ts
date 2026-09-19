import { Queue } from 'bullmq';
import { requireRedis } from './redis.ts';

export const publicationQueue = new Queue('affiliate-publications', {
  connection: requireRedis(),
  defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 604800, count: 5000 } },
});

export async function enqueuePublication(input: { publicationId: string; destinationId: string; offerId: string; scheduledAt?: string }) {
  const scheduledAtMs = input.scheduledAt ? new Date(input.scheduledAt).getTime() : Date.now();
  if (!Number.isFinite(scheduledAtMs)) throw new Error('scheduledAt inválido.');
  const delay = Math.max(0, scheduledAtMs - Date.now());
  return publicationQueue.add('publish', input, {
    jobId: `publication:${input.publicationId}`,
    delay,
  });
}
