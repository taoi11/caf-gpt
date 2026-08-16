/**
 * tests/setup.ts
 *
 * Test setup file - runs before all tests
 *
 * - Sets up global test configuration
 */

import { beforeEach } from "vitest";
import { DocumentRetriever } from "../src/storage/DocumentRetriever";

// ⚡ Bolt: Clear DocumentRetriever cache before each test to prevent test cross-contamination
beforeEach(() => {
  DocumentRetriever.clearCache();
});
