import { preferences } from "nova-extension-utils";

function isGitProject(): boolean {
  return nova.workspace.contains(nova.workspace.relativizePath("/.git"));
}

// Get the Jest Watch mode flag
export function getJestWatchMode(): string {
  const configJestOnlyChanged = preferences.getOverridableBoolean(
    "apexskier.jest.config.onlyChanged"
  );

  // If option enabled, ensure that project is a git repository
  return configJestOnlyChanged && isGitProject() ? "--watch" : "--watchAll";
}
