const isGitProject = (): boolean => {
  return nova.workspace.contains(nova.workspace.relativizePath("/.git"));
};

function getWorkspaceSetting(): boolean | null {
  const setting = nova.workspace.config.get(
    "apexskier.jest.config.onlyChanged",
    "string"
  );

  switch (setting) {
    case "true":
      return true;
    case "false":
      return false;
    default:
      return null;
  }
}

// Get the Jest Watch mode flag
export function getJestWatchMode(): string {
  const configJestOnlyChanged =
    getWorkspaceSetting() ??
    nova.config.get("apexskier.jest.config.onlyChanged", "boolean");

  // If option enabled, ensure that project is a git repository
  return configJestOnlyChanged && isGitProject() ? "--watch" : "--watchAll";
}
