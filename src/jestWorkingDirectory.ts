function reload() {
  nova.commands.invoke("apexskier.jest.reload");
}
nova.workspace.config.onDidChange(
  "apexskier.jest.config.execWorkingDirectory",
  reload
);

export function getJestWorkingDir(): string | null {
  let jestWorkingDir =
    nova.workspace.config.get(
      "apexskier.jest.config.execWorkingDirectory",
      "string"
    ) || nova.workspace.path;
  if (!jestWorkingDir) {
    return null;
  }
  if (!nova.path.isAbsolute(jestWorkingDir)) {
    if (!nova.workspace.path) {
      return null;
    }
    jestWorkingDir = nova.path.join(nova.workspace.path, jestWorkingDir);
  }
  return nova.path.normalize(jestWorkingDir);
}
