import StackUtils from "stack-utils";

// NOTE: I'd prefer to use a higher level jest lib here, but they're not compatible with Nova's runtime

const stack = new StackUtils({
  cwd: "/",
  internals: StackUtils.nodeInternals(),
});

export function clean(rawStack: string) {
  return rawStack
    .split("\n")
    .map(stack.parseLine.bind(stack))
    .filter(
      (callSite) =>
        callSite &&
        callSite.file &&
        !callSite.file.includes("/node_modules/") &&
        (!nova.workspace.path || callSite.file.startsWith(nova.workspace.path))
    )[0];
}
