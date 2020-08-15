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

export async function openFile(uri: string) {
  let newEditor = await nova.workspace.openFile(uri);
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
  const fullContents = document.getTextInRange(new Range(0, document.length));
  let rangeStart = 0;
  let rangeEnd = 0;
  let chars = 0;
  const lines = fullContents.split(document.eol);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineLength = lines[lineIndex].length + document.eol.length;
    if (range.start.line === lineIndex) {
      rangeStart = chars + range.start.character;
    }
    if (range.end.line === lineIndex) {
      rangeEnd = chars + range.end.character;
      break;
    }
    chars += lineLength;
  }
  return new Range(rangeStart, rangeEnd);
}
