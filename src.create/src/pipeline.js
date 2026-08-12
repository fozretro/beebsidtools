/**
 * Run an ordered list of stages over a shared context.
 *
 * Each stage is `(ctx) => ctx | Promise<ctx>` and should return a new/updated
 * context object (immutable-style). Stages are named for logging.
 *
 * Pass `onLog: (line: string) => void` on the initial context (or via
 * createContext / createSsd opts) to receive lines as they are pushed.
 */

/**
 * @typedef {object} CreateContext
 * @property {string} [baseName]
 * @property {Buffer} [inputSid]
 * @property {Buffer} [relSid]
 * @property {string} [brkText]
 * @property {string} [relocErr]
 * @property {Buffer} [patchedSid]
 * @property {Buffer} [ripInput]  SID bytes fed to rip (rel or patched)
 * @property {Buffer} [bbcSid]
 * @property {string} [vars]
 * @property {Array<{sid:Buffer,baseName?:string,title?:string,patch?:true|string|false}>} [inputs]
 * @property {Array<object>} [tunes]  converted tune results (multi-SID)
 * @property {{sidplay:Buffer,sidpelk?:Buffer,hex?:Buffer}} [assets]
 * @property {Buffer} [ssd]
 * @property {Buffer} [menu]
 * @property {string[]} log
 * @property {(line: string) => void} [onLog]
 * @property {Record<string, unknown>} meta
 */

/**
 * Ensure ctx.log.push forwards to onLog (re-bind after stages spread ctx).
 * @param {CreateContext} ctx
 */
export function attachLogSink(ctx) {
  const lines = Array.isArray(ctx.log) ? ctx.log : [];
  const onLog = ctx.onLog;
  ctx.log = lines;
  if (typeof onLog !== "function") return ctx;

  lines.push = function pushLogged(...args) {
    for (const line of args) {
      Array.prototype.push.call(lines, line);
      try {
        onLog(String(line));
      } catch {
        /* ignore listener errors */
      }
    }
    return lines.length;
  };
  return ctx;
}

/** Yield so onLog / UI / sockets can flush (Node + browser). */
function yieldEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {Array<{ name: string, run: (ctx: CreateContext) => CreateContext | Promise<CreateContext> }>} stages
 * @param {CreateContext} initial
 */
export async function runPipeline(stages, initial) {
  let ctx = attachLogSink({
    log: [],
    meta: {},
    ...initial,
  });

  for (const stage of stages) {
    ctx.log.push(`→ ${stage.name}`);
    // Let onLog flush (sockets / UI) before CPU-heavy stage work.
    await yieldEventLoop();
    ctx = await stage.run(ctx);
    ctx.log = ctx.log ?? [];
    ctx.meta = ctx.meta ?? {};
    ctx.onLog = initial.onLog ?? ctx.onLog;
    attachLogSink(ctx);
    await yieldEventLoop();
  }

  ctx.log.push("✓ done");
  return ctx;
}

export function createContext(partial = {}) {
  return attachLogSink({
    log: [],
    meta: {},
    ...partial,
  });
}
