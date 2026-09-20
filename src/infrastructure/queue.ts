import { Queue } from 'bullmq';
import { redis, requireRedis } from './redis.ts';

export const publicationQueue = new Queue('affiliate-publications', {
  connection: requireRedis(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800, count: 5000 }
  },
});

async function waitForRedis(timeoutMs = Number(process.env.REDIS_QUEUE_READY_TIMEOUT_MS || 5000)) {
  if (!redis) throw new Error('REDIS_URL não configurada. Configure REDIS_URL e inicie o Redis antes de publicar.');
  const started = Date.now();

  while (redis.status !== 'ready') {
    if (redis.status === 'end') {
      try { await redis.connect(); } catch {}
    }
    if (Date.now() - started >= timeoutMs) {
      throw new Error(`Redis indisponível para a fila (status: ${redis.status || 'unknown'}). Verifique REDIS_URL e se o Redis está em execução.`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  try {
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout ao verificar Redis.')), timeoutMs)),
    ]);
  } catch (error) {
    throw new Error(`Redis indisponível para a fila: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function checkPublicationQueue() {
  await waitForRedis();
  const client = publicationQueue;
  await client.waitUntilReady();
  return { available: true };
}

export async function enqueuePublication(input: { publicationId:string; destinationId:string; offerId:string; scheduledAt?:string }) {
  await waitForRedis();
  const scheduledAtMs=input.scheduledAt ? new Date(input.scheduledAt).getTime() : Date.now();
  if(!Number.isFinite(scheduledAtMs)) throw new Error('scheduledAt inválido.');
  const delay=Math.max(0,scheduledAtMs-Date.now());
  try {
    return await publicationQueue.add('publish',input,{jobId:`publication:${input.publicationId}`,delay});
  } catch (error) {
    throw new Error(`Não foi possível adicionar a publicação à fila Redis: ${error instanceof Error ? error.message : String(error)}`);
  }
}
