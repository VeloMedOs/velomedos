export const EXCLUDE_PATH_PREFIXES: string[];
export const EXCLUDE_FILES: Set<string>;
export function filenameToPath(rel: string): string;
export function isPublicRouteFile(rel: string): boolean;
export function discoverStaticPaths(filenames: string[]): string[];
export const PATH_HINTS: Record<string, { changefreq: string; priority: string }>;
export const DEFAULT_HINT: { changefreq: string; priority: string };
export function hintFor(path: string): { changefreq: string; priority: string };
export function expandDynamic(input?: {
  services?: ReadonlyArray<{ slug: string }>;
  cities?: ReadonlyArray<{ slug: string }>;
  resources?: ReadonlyArray<{ slug: string }>;
}): Array<{ path: string; changefreq: string; priority: string }>;