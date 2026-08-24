# Hermit jsSID (vendored)

[jsSID 0.9.1](https://github.com/og2t/jsSID) by Mihaly Horvath (Hermit).
WTFPL — keep the author credit. Used only by the Disc Creator HVSC browser
to preview original C64 `.sid` files (not the BeebSID FastSID chip).

Source: `source/jsSID.js` from the og2t/jsSID tree.

Local change: the constructor exposes `audioCtx` and `scriptNode` so the HVSC
browser can tap an AnalyserNode for the waveform. Playback is unchanged.
