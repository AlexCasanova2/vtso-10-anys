import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("both public entry points select the display layout", () => {
  for (const path of ["app/page.tsx", "app/pantalla/page.tsx"]) {
    assert.match(source(path), /<EventScreen displayMode\s*\/>/);
  }
});

test("public screen layouts do not depend on the input signal orientation", () => {
  for (const path of ["app/event.css", "app/sorteig/sorteig.css"]) {
    const css = source(path);
    assert.doesNotMatch(css, /@media[^{}]*aspect-ratio/);
    assert.match(css, /@media\s*\(min-width:500px\)/);
  }
  assert.match(source("app/event.css"), /\.campaign-shell\.display-mode \.event-hero\s*\{[^}]*grid-template-columns:1fr/);
});
