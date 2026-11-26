/**
 * Marks a build of the djbclark fork so About can tell it from the upstream release of the same
 * version. Only the fork's build branch carries this file. The number counts fork desktop builds:
 * 1 was the first 0.17.1 install, so the next build is 2. Raise it in the commit that starts each
 * new build. The package version stays as upstream's, because the app and daemon compare it.
 */
export const FORK_BUILD = { name: "djbclark", build: 4 } as const;

export function formatForkBuild(fork: { name: string; build: number } = FORK_BUILD): string {
  return `${fork.name} fork ${fork.build}`;
}

/** The About version line: upstream's version, then the fork marker. */
export function formatVersionWithForkBuild(versionText: string): string {
  return `${versionText} · ${formatForkBuild()}`;
}
