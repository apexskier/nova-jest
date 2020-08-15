export function wrapCommand(
  command: (...args: any[]) => void
): (...args: any[]) => void {
  return function wrapped(...args: any[]) {
    try {
      command(...args);
    } catch (err) {
      nova.workspace.showErrorMessage(err);
    }
  };
}
