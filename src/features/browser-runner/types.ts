import type { BrowserExtractMode, BrowserRun, BrowserRunResult, BrowserRunTable } from "@/types";

export type { BrowserExtractMode, BrowserRun, BrowserRunResult, BrowserRunTable };

export interface ExtractedPageContent {
  title: string | null;
  text: string | null;
  html: string | null;
  tables: BrowserRunTable[];
  metadata: Record<string, unknown>;
}
