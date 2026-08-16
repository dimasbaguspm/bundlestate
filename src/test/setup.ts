import "@testing-library/jest-dom/vitest";
// Dexie needs a real IndexedDB implementation under jsdom — fake-indexeddb
// installs `indexedDB`, `IDBKeyRange`, `IDBCursor` etc. as globals.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without `globals: true`, so @testing-library/react cannot
// auto-register its afterEach cleanup — do it explicitly here.
afterEach(() => cleanup());