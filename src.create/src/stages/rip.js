import { ripSid } from "../lib/ripsid.js";

/** Rip relocated (optionally patched) SID + .brk → .bbcsid (in-memory). */
export function ripStage() {
  return {
    name: "Encoding as BeebSID tune",
    async run(ctx) {
      const sid = ctx.ripInput ?? ctx.patchedSid ?? ctx.relSid;
      if (!sid) throw new Error("rip: no SID input (ripInput/relSid)");
      if (!ctx.brkText) throw new Error("rip: ctx.brkText required");

      const { bbcSid, vars } = ripSid(sid, ctx.brkText);
      return {
        ...ctx,
        bbcSid,
        vars,
      };
    },
  };
}
