import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") globalThis.Buffer = Buffer;

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./app.css";

function hideBoot() {
  document.getElementById("boot")?.remove();
}

const holdMs = new URLSearchParams(location.search).has("boot") ? 2000 : 0;

async function start() {
  if (holdMs) await new Promise((r) => setTimeout(r, holdMs));
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  hideBoot();
}

start();
