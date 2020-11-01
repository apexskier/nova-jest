const isGitProject = (): boolean => {
  return nova.workspace.contains(nova.workspace.relativizePath("/.git"));
};

// Get the Jest Watch mode flag
export function getJestWatchMode(): string {
  const configJestOnlyChanged = nova.config.get(
    "apexskier.jest.config.onlyChanged",
    "boolean"
  );

  // If option enabled, ensure that project is a git repository
  return configJestOnlyChanged && isGitProject() ? "--watch" : "--watchAll";
}
