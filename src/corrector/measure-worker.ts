/**
 * Worker-thread entry for batch icon measurement. One message in, one
 * message out, keyed by `id`; the pool (`measure-pool.ts`) owns dispatch
 * and lifecycle. Kept deliberately dumb — all the logic lives in the
 * shared `measureShift`, so a worker result is byte-identical to an
 * in-thread one.
 */

import { parentPort } from 'node:worker_threads';

import { measureShift } from './measure.js';

export interface MeasureRequest {
  readonly id: number;
  readonly svg: string;
  readonly width: number;
  readonly height: number;
}

export interface MeasureResponse {
  readonly id: number;
  readonly dx: number;
  readonly dy: number;
  readonly clipDetected: boolean;
}

const port = parentPort;
if (port !== null) {
  port.on('message', (msg: MeasureRequest) => {
    const shift = measureShift(msg.svg, {
      width: msg.width,
      height: msg.height,
    });
    const response: MeasureResponse = { id: msg.id, ...shift };
    port.postMessage(response);
  });
}
