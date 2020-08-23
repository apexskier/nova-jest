// eslint-disable-next-line no-unused-vars
import type { Test } from "@jest/reporters";
// eslint-disable-next-line no-unused-vars
import type { AssertionResult, TestResult } from "@jest/test-result";
import { clean } from "./stackUtils";
import { wrapCommand, cleanPath, openFile, lineColToRange } from "./novaUtils";
import { InformationView } from "./informationView";
import { getJestExecPath } from "./jestExecPath";

nova.commands.register(
  "apexskier.jest.openWorkspaceConfig",
  wrapCommand(function openWorkspaceConfig(workspace: Workspace) {
    workspace.openConfig("apexskier.jest");
  })
);

nova.commands.register("apexskier.jest.reload", reload);

const compositeDisposable = new CompositeDisposable();

async function reload() {
  deactivate();
  console.log("reloading...");
  await asyncActivate();
}

const informationView = new InformationView();

function resultStatusToIssueSeverity(
  status: AssertionResult["status"]
): IssueSeverity | null {
  switch (status) {
    case "passed":
      return null;
    case "failed":
      return IssueSeverity.Error;
    case "skipped":
      return IssueSeverity.Hint;
    case "pending":
      return IssueSeverity.Hint;
    case "todo":
      return IssueSeverity.Hint;
    case "disabled":
      return IssueSeverity.Hint;
  }
}

// colors pulled from
const successColor = new Color("hex", [21 / 255, 194 / 255, 19 / 255, 1]);
const failureColor = new Color("rgb", [194 / 255, 19 / 255, 37 / 255, 1]);
const pendingColor = new Color("rgb", [194 / 255, 168 / 255, 19 / 255, 1]);

async function getJestVersion(jestExecPath: string) {
  return new Promise<string>((resolve, reject) => {
    const process = new Process(jestExecPath, {
      args: ["--version"],
      stdio: ["ignore", "pipe", "ignore"],
    });
    let str = "";
    process.onStdout((versionString) => {
      str += versionString.trim();
    });
    process.onDidExit((status) => {
      if (status === 0) {
        resolve(str);
      } else {
        reject(status);
      }
    });
    process.start();
  });
}

async function asyncActivate() {
  informationView.status = "Activating...";

  // this determines how to run jest
  // it should be project specific, so find the best option in this order:
  // - explicitly configured
  // - best guess (installed in the main node_modules)
  // - within plugin (no choice of version)

  const jestExecPath = await getJestExecPath();
  if (!jestExecPath) {
    informationView.status = "Can't find Jest";
    return;
  }
  console.info("using jest at:", jestExecPath);

  // get the jest version to display in the sidebar
  void getJestVersion(jestExecPath).then((version) => {
    informationView.jestVersion = version;
  });

  if (!nova.workspace.path) {
    informationView.status = "No workspace";
    informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
    return;
  }

  // jest process will continually run
  const jestProcess = new Process(jestExecPath, {
    args: [
      "--watchAll",
      "--testLocationInResults",
      "--reporters",
      nova.path.join(nova.extension.path, "Scripts/reporter.dist.js"),
    ],
    env: {
      CI: "true",
    },
    cwd: nova.workspace.path,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // NOTE: We could emit in JSON (https://jestjs.io/docs/en/cli#--json) but that's going to be slower as all tests will need to pass before we can show results
  jestProcess.onStdout(handleJestLine);
  jestProcess.onStderr((line) => {
    console.warn(line.trim());
  });
  jestProcess.start();
  compositeDisposable.add({
    dispose() {
      jestProcess.terminate();
    },
  });

  const storedProcessInfo = new Map<
    string,
    { isRunning: boolean; results?: TestResult }
  >();

  // element is an array of file -> ...ancestorTitles -> test title
  interface TestTreeElement {
    segments: ReadonlyArray<string>;
    isLeaf: Boolean;
  }
  function getRootElement(k: string): TestTreeElement {
    return {
      segments: [k],
      isLeaf:
        (storedProcessInfo.get(k)!.results?.testResults.length ?? 0) === 0,
    };
  }
  const sidebarProvider: TreeDataProvider<TestTreeElement> = {
    getChildren(element): Array<TestTreeElement> {
      if (!element) {
        return Array.from(storedProcessInfo.keys()).map(getRootElement);
      }
      const [path, ...ancestors] = element.segments;
      if (!path) {
        return [];
      }
      if (storedProcessInfo.has(path)) {
        let results = storedProcessInfo.get(path)?.results?.testResults ?? [];
        if (!results) {
          return [];
        }
        ancestors.forEach((ancestor, i) => {
          results = results.filter((r) => r.ancestorTitles[i] == ancestor);
        });
        const nextLevelAncestors: Array<string> = [];
        const children: Array<TestTreeElement> = [];
        for (const r of results) {
          if (r.ancestorTitles.length > ancestors.length) {
            const nextLevelAncestor = r.ancestorTitles[ancestors.length];
            if (!nextLevelAncestors.includes(nextLevelAncestor)) {
              nextLevelAncestors.push(nextLevelAncestor);
              children.push({
                segments: [...element.segments, nextLevelAncestor],
                isLeaf: false,
              });
            }
          } else {
            children.push({
              segments: [...element.segments, r.title],
              isLeaf: true,
            });
          }
        }
        return children;
      }
      return [];
    },
    getTreeItem(element) {
      const { segments, isLeaf } = element;
      const elementData = storedProcessInfo.get(segments[0]);
      if (!elementData) {
        return new TreeItem("...");
      }
      const { results, isRunning } = elementData;
      const isTestFile = segments.length == 1;
      const title = isTestFile
        ? cleanPath(segments[0])
        : segments[segments.length - 1];
      const collapsedState = isLeaf
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed;
      const item = new TreeItem(title, collapsedState);
      item.command = "apexskier.jest.openTest";
      if (isTestFile) {
        item.path = segments[0];
        if (results?.failureMessage) {
          item.descriptiveText = results.failureMessage;
          item.tooltip = results.failureMessage;
          (item as any).color = failureColor;
        } else {
          (item as any).color = successColor;
        }
        if (isRunning) {
          (item as any).color = pendingColor;
        }
      } else if (isLeaf) {
        const testResult = results?.testResults.find(
          (r) => r.title === item.name
        );
        if (testResult) {
          if (testResult.failureMessages.length > 0) {
            item.descriptiveText = testResult.failureMessages[0];
            item.tooltip = testResult.failureMessages[0];
            (item as any).color = failureColor;
          } else {
            item.tooltip = testResult.fullName;
            (item as any).color = successColor;
          }
          if (isRunning) {
            (item as any).color = pendingColor;
          }
        } else {
          console.warn("Failed to find results", item.name);
        }
      } else {
        item.image = "__builtin.path";
      }
      item.identifier = element.segments.join("__JEST_EXTENSION__");
      return item;
    },
    getParent(element) {
      return {
        segments: element.segments.slice(0, -1),
        isLeaf: false,
      };
    },
  };

  const testResultsTreeView = new TreeView("apexskier.jest.sidebar.tests", {
    dataProvider: sidebarProvider,
  });
  compositeDisposable.add(testResultsTreeView);

  compositeDisposable.add(
    nova.commands.register(
      "apexskier.jest.openTest",
      wrapCommand(async function openTest(workspace: Workspace) {
        const open = openFile.bind(workspace);
        const openableElements = testResultsTreeView.selection.filter(
          ({ segments: [, ...ancestors], isLeaf }) =>
            isLeaf || ancestors.length === 0
        );
        const openFiles: { [file: string]: TextEditor | null } = {};
        await Promise.all(
          openableElements.map(async ({ segments: [path] }) => {
            openFiles[path] = await open(path);
            // clear selection
            if (openFiles[path]) {
              (openFiles[path] as any).selectedRange = new Range(0, 0);
            }
          })
        );
        for (const element of openableElements) {
          const {
            segments: [path, ...ancestors],
          } = element;
          const editor = openFiles[path];
          if (!editor) {
            continue;
          }
          const location = storedProcessInfo
            .get(path)
            ?.results?.testResults.find(
              (r) => r.title === ancestors[ancestors.length - 1]
            )?.location;
          if (!location) {
            continue;
          }
          const pos = { line: location.line, character: location.column };
          const range = lineColToRange(editor.document, {
            start: pos,
            end: pos,
          });
          editor.addSelectionForRange(range);
          editor.scrollToPosition(range.start);
        }
      })
    )
  );

  // store an issue collection per test suite, that way errors can be pushed into different files but still be associated
  // with a specific test suite so we don't clear issues from other suites.
  // TODO: there's probably a bug if a jest test file gets renamed or deleted - it won't be deleted here
  // I probably need to listen for the full test suite completion and need to delete all tests that aren't present
  class TestIssueCollections implements Disposable {
    private _collections = new Map<string, IssueCollection>();
    get(suite: string): IssueCollection {
      if (!this._collections.has(suite)) {
        this._collections.set(suite, new IssueCollection());
      }
      return this._collections.get(suite)!;
    }
    dispose() {
      for (const collection of this._collections.values()) {
        collection.dispose();
      }
    }
  }
  const jestIssueCollections = new TestIssueCollections();
  compositeDisposable.add(jestIssueCollections);

  // TODO: I haven't yet figured out a reliable way to reload a specific element,
  // avoiding reference equality issues, that avoids spamming multiple reloads,
  // which causes annoying flickering issues
  // a simple mechanism would be a debounce, but there's some mores stuff to try.
  function reloadTree(key: TestTreeElement | null) {
    console.log("reload", key?.segments.join(":"));
    testResultsTreeView.reload(null);
  }

  function handleJestLine(line: string) {
    if (!line.trim()) {
      return;
    }
    const { event, data: rawData } = JSON.parse(line);

    let toReload: TestTreeElement | null = null;
    switch (event) {
      case "onTestStart": {
        const data: Test = rawData;
        const key = nova.path.normalize(data.path);
        // this needs to happen only after initial load, I think
        if (storedProcessInfo.has(key)) {
          toReload = getRootElement(key);
        }
        storedProcessInfo.set(key, {
          isRunning: true,
          results: storedProcessInfo.get(key)?.results,
        });
        break;
      }
      case "onTestResult": {
        const data: TestResult = rawData;
        const key = nova.path.normalize(data.testFilePath);
        if (storedProcessInfo.has(key)) {
          toReload = getRootElement(key);
        }
        storedProcessInfo.set(key, { isRunning: false, results: data });
        const fileURI = `file://${key}`;
        // if (nova.inDevMode()) {
        //   console.log("data", JSON.stringify(data, null, "  "));
        // }
        const issueCollection = jestIssueCollections.get(fileURI);
        issueCollection.clear();
        for (const result of data.testResults) {
          const severity = resultStatusToIssueSeverity(result.status);
          if (!severity) {
            continue;
          }
          const issue = new Issue();
          // if (nova.inDevMode()) {
          //   console.log("result", JSON.stringify(result, null, "  "));
          // }
          (issue as any).message = result.fullName;
          issue.source = result.title;
          issue.severity = severity;
          if (result.location) {
            issue.line = result.location.line;
            issue.column = result.location.column;
          }
          issueCollection.append(fileURI, [issue]);

          if (Array.isArray(result.failureDetails)) {
            result.failureDetails.map((details: any) => {
              // if (nova.inDevMode()) {
              //   console.log("details", JSON.stringify(details, null, "  "));
              // }
              if (typeof details.stack === "string") {
                const callSite = clean(details.stack);
                if (callSite) {
                  const issue = new Issue();
                  (issue as any).message = details.message;
                  issue.code = result.fullName;
                  issue.severity = IssueSeverity.Error;
                  issue.line = callSite.line;
                  issue.column = callSite.column;
                  issueCollection.append(`file://${callSite.file}`, [issue]);
                }
              }
            });
          }
        }
        break;
      }
      default:
        console.warn("unexpected event", event);
    }
    reloadTree(toReload);
  }

  informationView.status = "Running";

  informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
}

// This isn't handled by Nova as async, but it's setup as async for tests
export async function activate() {
  console.log("activating...");
  return asyncActivate()
    .catch((err) => {
      informationView.status = "Not active";
      console.error("Failed to activate");
      console.error(err);
    })
    .then(() => {
      console.log("activated");
    });
}

export function deactivate() {
  compositeDisposable.dispose();
  informationView.status = "Deactivated";
}
