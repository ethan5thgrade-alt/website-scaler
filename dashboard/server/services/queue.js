import { getDb } from '../database.js';
import { broadcast } from './websocket.js';

class JobQueue {
  constructor() {
    this.processing = false;
    this.handlers = new Map();
    this.queue = [];
  }

  register(jobType, handler) {
    this.handlers.set(jobType, handler);
  }

  enqueue(jobType, data, priority = 0) {
    this.queue.push({ jobType, data, priority, createdAt: Date.now() });
    this.queue.sort((a, b) => b.priority - a.priority);
    broadcast('queue_update', { size: this.queue.length });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      const handler = this.handlers.get(job.jobType);

      if (handler) {
        try {
          await handler(job.data);
        } catch (err) {
          console.error(`[Queue] Job ${job.jobType} failed:`, err.message);
          broadcast('queue_error', {
            jobType: job.jobType,
            error: err.message,
          });
        }
      }
    }

    this.processing = false;
  }

  get size() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
  }
}

export const jobQueue = new JobQueue();
