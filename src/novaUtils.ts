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

// https://stackoverflow.com/a/6969486
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

export function cleanPath(path: string) {
  const hr = new RegExp("^" + escapeRegExp(nova.environment["HOME"]));
  const decodedPath = decodeURIComponent(path);
  if (!nova.workspace.path) {
    return decodedPath.replace(hr, "~");
  }
  const wr = new RegExp("^" + escapeRegExp(nova.workspace.path));
  return decodedPath.replace(wr, ".").replace(hr, "~");
}

export async function openFile(this: Workspace | null, uri: string) {
  const workspace = this ?? nova.workspace;
  let newEditor = await workspace.openFile(uri);
  if (newEditor) {
    return newEditor;
  }
  console.warn("failed first open attempt, retrying once", uri);
  // try one more time, this doesn't resolve if the file isn't already open. Need to file a bug
  newEditor = await nova.workspace.openFile(uri);
  if (newEditor) {
    return newEditor;
  }
  return null;
}

// this could really use some tests
export function lineColToRange(
  document: TextDocument,
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  }
): Range {
  let fullContents: string;
  try {
    fullContents = document.getTextInRange(new Range(0, document.length));
  } catch (err) {
    if (
      (err as Error).message.includes(
        "Range exceeds bounds of the document's text"
      )
    ) {
      console.warn(err);
      console.warn("document length:", document.length);
    }
    throw err;
  }
  let rangeStart: number | null = null;
  let rangeEnd: number | null = null;
  let chars = 0;
  const lines = fullContents.split(document.eol);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineLength = lines[lineIndex].length + document.eol.length;
    if (range.start.line === lineIndex) {
      if (range.start.character > lineLength) {
        throw new Error("range out of bounds of start line");
      }
      rangeStart = chars + range.start.character;
    }
    if (range.end.line === lineIndex) {
      if (range.end.character > lineLength) {
        throw new Error("range out of bounds of end line");
      }
      rangeEnd = chars + range.end.character;
      break;
    }
    chars += lineLength;
  }
  if (rangeStart == null || rangeEnd == null) {
    throw new Error("range out of bounds of document");
  }
  return new Range(rangeStart, rangeEnd);
}
