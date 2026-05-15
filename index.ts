// Minimal stub — probe is about lockfile-format detection, not runtime behavior.
// The package.json declares hono and elysia; this import surface confirms both
// appear in the dep tree when Mend resolves them.
import { Hono } from "hono";
import { Elysia } from "elysia";

// These exports are never executed in the probe environment.
// They exist so bundlers / tree-shakers cannot drop the imports.
export { Hono, Elysia };