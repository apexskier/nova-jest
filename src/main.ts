import type {
  Reporter,
  Test,
  ReporterOnStartOptions,
  Context,
} from "@jest/reporters";
import type {
  AggregatedResult,
  TestCaseResult,
  AssertionResult,
  TestResult,
} from "@jest/test-result";
import { wrapCommand, cleanPath, openFile, lineColToRange } from "./novaUtils";
import { InformationView } from "./informationView";

nova.commands.register(
  "apexskier.jest.openWorkspaceConfig",
  wrapCommand(function openWorkspaceConfig(workspace: Workspace) {
    workspace.openConfig("apexskier.jest");
  })
);

nova.config.onDidChange("apexskier.jest.config.execPath", reload);
nova.workspace.config.onDidChange("apexskier.jest.config.execPath", reload);

const compositeDisposable = new CompositeDisposable();

async function reload() {
  deactivate();
  console.log("reloading...");
  await asyncActivate();
}

const informationView = new InformationView(reload);

async function npmBin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const process = new Process("/usr/bin/env", {
      args: ["npm", "bin"],
      cwd: nova.workspace.path || nova.extension.path,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let result = "";
    process.onStdout((o) => {
      result += o;
    });
    process.onStderr((e) => console.warn("npm bin:", e.trimRight()));
    process.onDidExit((status) => {
      if (status === 0) {
        resolve(result.trim());
      } else {
        reject(new Error("failed to npm bin"));
      }
    });
    process.start();
  });
}

function resultStatusToIssueSeverity(
  status: AssertionResult["status"]
): IssueSeverity {
  switch (status) {
    case "passed":
      return IssueSeverity.Info;
    case "failed":
      return IssueSeverity.Error;
    case "skipped":
      return IssueSeverity.Warning;
    case "pending":
      return IssueSeverity.Warning;
    case "todo":
      return IssueSeverity.Warning;
    case "disabled":
      return IssueSeverity.Warning;
  }
}

async function asyncActivate() {
  informationView.status = "Activating...";

  const npmBinDir = await npmBin();

  // this determines how to run jest
  // it should be project specific, so find the best option in this order:
  // - explicitly configured
  // - best guess (installed in the main node_modules)
  // - within plugin (no choice of version)
  let jestExecPath: string;
  const configJestExecPath =
    nova.workspace.config.get("apexskier.jest.config.execPath", "string") ??
    nova.config.get("apexskier.jest.config.execPath", "string");
  if (configJestExecPath) {
    if (nova.path.isAbsolute(configJestExecPath)) {
      jestExecPath = configJestExecPath;
    } else if (nova.workspace.path) {
      jestExecPath = nova.path.join(nova.workspace.path, configJestExecPath);
    } else {
      nova.workspace.showErrorMessage(
        "Save your workspace before using a relative Jest executable path."
      );
      return;
    }
  } else {
    jestExecPath = nova.path.join(npmBinDir, "jest");
  }
  // Note: I don't check file access here because I'm not using filesystem entitlements
  console.info("using jest at:", jestExecPath);

  // get the jest version to display in the sidebar
  const versionProcess = new Process(jestExecPath, {
    args: ["--version"],
    stdio: ["ignore", "pipe", "ignore"],
  });
  versionProcess.onStdout((versionString) => {
    informationView.tsVersion = versionString.trim();
  });
  versionProcess.start();
  await new Promise((resolve) => versionProcess.onDidExit(resolve));

  compositeDisposable.add(
    (nova.assistants.registerIssueAssistant as any)(
      "*",
      {
        provideIssues() {
          // provideIssues(editor: TextEditor) {
          return [];
        },
      },
      {
        event: "onSave",
      }
    )
  );

  if (!nova.workspace.path) {
    informationView.status = "No workspace";
    informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
    return;
  }

  const tracker = new Map<string, TestResult>();

  // element is an array of file -> ...ancestorTitles -> test title
  interface TestTreeElement {
    segments: ReadonlyArray<string>;
    isLeaf: Boolean;
  }
  const sidebarProvider: TreeDataProvider<TestTreeElement> = {
    getChildren(element): Array<TestTreeElement> {
      if (!element) {
        return Array.from(tracker.keys()).map((k) => ({
          segments: [k],
          isLeaf: tracker.get(k)!.testResults.length === 0,
        }));
      }
      const [path, ...ancestors] = element.segments;
      if (!path) {
        return [];
      }
      if (tracker.has(path)) {
        let results = tracker.get(path)?.testResults ?? [];
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
      const results = tracker.get(segments[0]);
      if (!results) {
        return new TreeItem("Running");
      }
      const isTestFile = segments.length == 1;
      const title = isTestFile
        ? cleanPath(segments[0])
        : segments[segments.length - 1];
      const collapsedState = isLeaf
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Expanded;
      const item = new TreeItem(title, collapsedState);
      if (isTestFile) {
        item.image = "__builtin.path"
        if (results.failureMessage) {
          item.descriptiveText = results.failureMessage;
          item.tooltip = results.failureMessage;
          item.color = new Color("rgb", [1, 0, 0, 1]);
        }
      } else {
        if (isLeaf) {
          const testResult = results.testResults.find(
            (r) => r.title === item.name
          );
          if (testResult) {
            if (testResult.failureMessages.length > 0) {
              item.descriptiveText = testResult.failureMessages[0];
              
              item.tooltip = testResult.failureMessages[0];
              item.color = new Color("rgb", [1, 0, 0, 1]);
            } else {
              item.tooltip = testResult.fullName
            }
          } else {
            console.warn("Failed to find results", item.name)
          }
        }
      }
      item.identifier = element.segments.join("__JEST_EXTENSION__");
      return item;
    },
    getParent(element) {
      return { segments: element.segments.slice(0, -1), isLeaf: false };
    },
  };

  const testResultsTreeView = new TreeView("apexskier.jest.sidebar.tests", {
    dataProvider: sidebarProvider,
  });
  compositeDisposable.add(testResultsTreeView);

  testResultsTreeView.onDidChangeSelection((elements) => {
    const element = elements[0]
    const { segments: [path, ...ancestors], isLeaf } = element;
    let results = tracker.get(path);
    if (results && isLeaf) {
      const testResult = results.testResults.find(
        (r) => r.title === ancestors[ancestors.length - 1]
      );
      if (!testResult) {
        return;
      }
      (async () => {
      const editor = await openFile(path);
      if (!editor) {
        nova.workspace.showWarningMessage("Couldn't open path");
        return;
      }
      if (!testResult.location) {
        return;
      }
      const pos = {
        line: testResult.location.line,
        character: testResult.location.column
      }
      const range = lineColToRange(editor.document, {start: pos, end: pos})
      editor.addSelectionForRange(range);
      editor.scrollToPosition(range.start);
    })()
    }
  });

  const issueAssistant: IssueAssistant = {
    provideIssues(editor) {
      if (editor.document.isRemote) {
        console.warn("remote documents not supported");
        return [];
      }
      if (!editor.document.path) {
        return [];
      }
      const pathParts = nova.path.split(editor.document.path);
      const volumeLessEditorPath = nova.path.join(
        pathParts[0],
        ...nova.path.split(editor.document.path).slice(3)
      );
      return (
        tracker.get(volumeLessEditorPath)?.testResults.map((result) => {
          const issue = new Issue();
          issue.message = result.title;
          issue.severity = resultStatusToIssueSeverity(result.status);
          if (result.location) {
            issue.line = result.location.line;
            issue.column = result.location.column;
          }
          return issue;
        }) ?? []
      );
    },
  };
  compositeDisposable.add(
    (nova.assistants.registerIssueAssistant as any)("*", issueAssistant, {
      event: "onSave",
    })
  );

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
  jestProcess.onStdout((line) => {
    if (!line.trim()) {
      return;
    }
    const { event, data: rawData } = JSON.parse(line);
    switch (event) {
      case "onTestStart": {
        const data: Test = rawData;
        tracker.delete(nova.path.normalize(data.path));
        break;
      }
      case "onTestResult": {
        const data: TestResult = rawData;
        tracker.set(nova.path.normalize(data.testFilePath), data);
        break;
      }
      default:
        console.warn("unexpected event", event);
    }
    testResultsTreeView.reload();
  });
  jestProcess.onStderr((line) => {
    console.warn(line.trim());
  });
  jestProcess.start();
  compositeDisposable.add({
    dispose() {
      jestProcess.terminate();
    },
  });

  informationView.status = "Running";

  informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
}

export function activate() {
  console.log("activating...");
  asyncActivate()
    .catch((err) => {
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
