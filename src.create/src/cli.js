#!/usr/bin/env node
/**
 * beebsidtools create CLI — filesystem boundary for the in-memory pipeline.
 *
 *   create convert <in.sid...> [options] [-o outdir|out.ssd]
 *   create ssd <in.sid...> [options] [-o out.ssd]
 *   create patches
 *
 * SSD preview runs inside createSsd({ preview }) (headless jsbeeb stage).
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { basename, dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createSsd, convertSids } from "./index.js";
import { builtinPatches, patchPhase } from "./lib/patchRegistry.js";
import {
  writePreviewFiles,
  UI_SECONDS_PER_TUNE,
} from "./preview/node/capture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const BEEBSIDTOOLS = join(HERE, "../..");

const DEFAULT_PLAYER_OUT = join(BEEBSIDTOOLS, "src.player/out");
const DEFAULT_HEX = join(
  BEEBSIDTOOLS,
  "src.player/src/platform/elk/resources/hexdigs.bin",
);

function usage(code = 1) {
  console.log(`Usage:
  create convert <in.sid...> [--ssd] [--title=NAME] [--sidplay=path]
           [--sidpelk] [--hex=path] [--patch=id] [--no-patch]
           [--page=HH] [--sid-dest=HHHH] [--force|--no-force]
           [--keep-zp|--no-keep-zp] [--zp=LO-HI]
           [--no-preview] [--record-audio] [-o outdir|out.ssd]
  create ssd <in.sid...> [same options] [-o out.ssd]
  create patches
  create --version

  Multiple .sid inputs are converted in order, then packed into one SSD
  when using "ssd", --ssd, or -o *.ssd.
  Patches run pre-/post-relocate automatically (see create patches).
  Relocate defaults are page $1A, SID $FC20, --force, --keep-zp (BeebSID /
  SIDPLAY). Override on convert to experiment; a different page or SID dest
  will not play in the bundled player.
  SSD create skips a tune that fails convert (reloc, size, unpatched RSID)
  and packs the rest. Headless preview via createSsd({ preview }) → menu.png
  (skip with --no-preview). --record-audio adds ~${UI_SECONDS_PER_TUNE}s FastSID clips per tune.
`);
  process.exit(code);
}

function parseHex(s, name) {
  const t = String(s).trim();
  if (!t || /[^0-9a-fA-F]/.test(t)) {
    console.error(`Invalid ${name}: ${s}`);
    usage();
  }
  return parseInt(t, 16);
}

function takeOpt(args, i, a, name) {
  if (a.startsWith(`${name}=`)) return { value: a.slice(name.length + 1), i };
  if (a === name) {
    const value = args[i + 1];
    if (!value) usage();
    return { value, i: i + 1 };
  }
  return null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "-h" || args[0] === "--help") usage(0);
  if (args[0] === "-v" || args[0] === "--version") {
    const pkg = JSON.parse(
      readFileSync(join(BEEBSIDTOOLS, "package.json"), "utf8"),
    );
    console.log(`BeebSID Tools ${pkg.version}`);
    process.exit(0);
  }

  const cmd = args.shift();
  const flags = new Set();
  const positional = [];
  let out = null;
  /** @type {true|string|false} */
  let patch = true;
  let title = null;
  let sidplayPath = null;
  let hexPath = null;
  /** @type {Record<string, unknown>} */
  const reloc = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const pageOpt = takeOpt(args, i, a, "--page");
    const sidDestOpt = takeOpt(args, i, a, "--sid-dest");
    const zpOpt = takeOpt(args, i, a, "--zp");
    if (a === "--no-patch") {
      patch = false;
    } else if (a === "--patch") {
      patch = true;
    } else if (a.startsWith("--patch=")) {
      patch = a.slice("--patch=".length);
      if (!patch) usage();
    } else if (pageOpt) {
      reloc.page = parseHex(pageOpt.value, "--page");
      i = pageOpt.i;
    } else if (sidDestOpt) {
      reloc.sidDest = parseHex(sidDestOpt.value, "--sid-dest");
      i = sidDestOpt.i;
    } else if (zpOpt) {
      const parts = zpOpt.value.split("-");
      if (parts.length !== 2) {
        console.error(`Invalid --zp (use LO-HI hex): ${zpOpt.value}`);
        usage();
      }
      reloc.zpFirst = parseHex(parts[0], "--zp");
      reloc.zpLast = parseHex(parts[1], "--zp");
      i = zpOpt.i;
    } else if (a === "--force") {
      reloc.force = true;
    } else if (a === "--no-force") {
      reloc.force = false;
    } else if (a === "--keep-zp") {
      reloc.keepZp = true;
    } else if (a === "--no-keep-zp") {
      reloc.keepZp = false;
    } else if (a === "--ssd") {
      flags.add("ssd");
    } else if (a === "--sidpelk") {
      flags.add("sidpelk");
    } else if (a === "--no-preview") {
      flags.add("no-preview");
    } else if (a === "--record-audio") {
      flags.add("record-audio");
    } else if (a.startsWith("--title=")) {
      title = a.slice("--title=".length);
    } else if (a === "--title") {
      title = args[++i];
      if (!title) usage();
    } else if (a.startsWith("--sidplay=")) {
      sidplayPath = a.slice("--sidplay=".length);
    } else if (a === "--sidplay") {
      sidplayPath = args[++i];
      if (!sidplayPath) usage();
    } else if (a.startsWith("--hex=")) {
      hexPath = a.slice("--hex=".length);
    } else if (a === "--hex") {
      hexPath = args[++i];
      if (!hexPath) usage();
    } else if (a === "-o" || a === "--out") {
      out = args[++i];
      if (!out) usage();
    } else if (a.startsWith("-")) {
      console.error(`Unknown option: ${a}`);
      usage();
    } else {
      positional.push(a);
    }
  }

  return { cmd, flags, positional, out, patch, title, sidplayPath, hexPath, reloc };
}

function resolvePlayerFile(name, explicit, fallbacks) {
  if (explicit) {
    const p = resolve(explicit);
    if (!existsSync(p)) throw new Error(`Missing ${p}`);
    return p;
  }
  for (const p of fallbacks) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `Missing ${name} — build player (npm run build:player) or pass --sidplay=`,
  );
}

function loadAssets({ sidplayPath, hexPath, includeSidpelk }) {
  const sidplay = resolvePlayerFile("sidpl.o", sidplayPath, [
    join(DEFAULT_PLAYER_OUT, "sidpl.o"),
  ]);
  const assets = { sidplay: readFileSync(sidplay) };

  if (includeSidpelk) {
    const pelk = resolvePlayerFile("sidpelk.o", null, [
      join(DEFAULT_PLAYER_OUT, "sidpelk.o"),
    ]);
    assets.sidpelk = readFileSync(pelk);
  }

  if (hexPath) {
    assets.hex = readFileSync(resolve(hexPath));
  } else if (existsSync(DEFAULT_HEX)) {
    assets.hex = readFileSync(DEFAULT_HEX);
  }

  return { assets, sidplayPath: sidplay };
}

function writeTuneOutputs(outDir, tune) {
  const baseName = tune.baseName;
  if (tune.relSid) writeFileSync(join(outDir, `${baseName}.rel.sid`), tune.relSid);
  if (tune.brkText != null)
    writeFileSync(join(outDir, `${baseName}.brk`), tune.brkText);
  if (tune.relocErr != null)
    writeFileSync(join(outDir, `${baseName}.err`), tune.relocErr);
  if (tune.patchedSid)
    writeFileSync(join(outDir, `${baseName}.patched.sid`), tune.patchedSid);
  if (tune.bbcSid) writeFileSync(join(outDir, `${baseName}.bbcsid`), tune.bbcSid);
  if (tune.vars) writeFileSync(join(outDir, `${baseName}.vars`), tune.vars);
}

function loadSidInputs(paths) {
  return paths.map((p) => {
    const abs = resolve(p);
    if (!existsSync(abs)) throw new Error(`Missing SID: ${abs}`);
    return {
      sid: readFileSync(abs),
      baseName: basename(abs, ".sid"),
    };
  });
}

/** @returns {false|{ audio: boolean, secondsPerTune: number }} */
function previewOptsFromFlags(flags) {
  const wantAudio = flags.has("record-audio");
  const wantMenu = !flags.has("no-preview");
  if (!wantMenu && !wantAudio) return false;
  return { audio: wantAudio, secondsPerTune: UI_SECONDS_PER_TUNE };
}

async function cmdConvert(opts) {
  const { flags, positional, out, patch, title, sidplayPath, hexPath, reloc } = opts;
  if (positional.length === 0) usage();

  const inputs = loadSidInputs(positional);
  const outIsSsd = out && extname(out).toLowerCase() === ".ssd";
  const wantSsd = flags.has("ssd") || outIsSsd || inputs.length > 1;

  const first = inputs[0].baseName;
  let outDir;
  let ssdPath = null;
  if (outIsSsd) {
    ssdPath = resolve(out);
    outDir = dirname(ssdPath);
  } else if (out) {
    outDir = resolve(out);
    if (wantSsd) ssdPath = join(outDir, `${first}.ssd`);
  } else {
    outDir = resolve(join(process.cwd(), "out", first));
    if (wantSsd) ssdPath = join(outDir, `${first}.ssd`);
  }
  mkdirSync(outDir, { recursive: true });

  if (!wantSsd) {
    const { tunes, log } = await convertSids(inputs, { patch, reloc });
    for (const tune of tunes) writeTuneOutputs(outDir, tune);
    for (const line of log) console.error(line);
    if (tunes.length === 1) {
      console.log(`Wrote ${join(outDir, `${tunes[0].baseName}.bbcsid`)}`);
    } else {
      console.log(`Wrote ${outDir} (${tunes.length} tunes)`);
    }
    return;
  }

  const includeSidpelk = flags.has("sidpelk");
  const { assets } = loadAssets({ sidplayPath, hexPath, includeSidpelk });
  const previewFlags = previewOptsFromFlags(flags);
  let preview = false;
  if (previewFlags) {
    const { previewSsdStage } = await import("./preview/node/stage.js");
    preview = {
      stage: previewSsdStage({
        audio: previewFlags.audio,
        secondsPerTune: previewFlags.secondsPerTune,
      }),
    };
  }

  const result = await createSsd(inputs, {
    assets,
    patch,
    reloc,
    title: title ?? "BEEBSID",
    includeSidpelk,
    preview,
    onLog: (line) => console.error(line),
  });

  for (const tune of result.tunes) writeTuneOutputs(outDir, tune);

  writeFileSync(ssdPath, result.ssd);
  console.log(`Wrote ${ssdPath}`);

  if (result.preview) {
    const writePng = !flags.has("no-preview");
    const { pngPath, audioPaths } = writePreviewFiles(outDir, result.preview, {
      writePng,
    });
    if (writePng) {
      console.log(`Preview ${pngPath} (menu: ${result.preview.tune0 || "ok"})`);
    }
    for (const p of audioPaths) console.log(`Audio ${p}`);
  }
}

async function cmdSsd(opts) {
  opts.flags.add("ssd");
  return cmdConvert(opts);
}

async function cmdPatches() {
  const patches = builtinPatches;
  if (patches.length === 0) {
    console.log("(no patches)");
    return;
  }
  for (const p of patches) {
    console.log(`${p.id}\t${patchPhase(p)}\t${p.title ?? ""}\t${p._file}`);
    for (const h of p.matchSha256) console.log(`  sha256:${h}`);
  }
}

const parsed = parseArgs(process.argv);

try {
  if (parsed.cmd === "convert") await cmdConvert(parsed);
  else if (parsed.cmd === "ssd") await cmdSsd(parsed);
  else if (parsed.cmd === "patches") await cmdPatches();
  else {
    console.error(`Unknown command: ${parsed.cmd}`);
    usage();
  }
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
