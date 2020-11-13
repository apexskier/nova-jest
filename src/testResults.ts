// eslint-disable-next-line no-unused-vars
import type { Test } from "@jest/reporters";
import type {
  // eslint-disable-next-line no-unused-vars
  AggregatedResult,
  // eslint-disable-next-line no-unused-vars
  AssertionResult,
  // eslint-disable-next-line no-unused-vars
  TestResult,
} from "@jest/test-result";
import { cleanPath, lineColToRange, openFile, wrapCommand } from "./novaUtils";
import { clean } from "./stackUtils";

// colors pulled from the jest homepage
const successColor = new Color("hex", [21 / 255, 194 / 255, 19 / 255, 1]);
const failureColor = new Color("rgb", [194 / 255, 19 / 255, 37 / 255, 1]);
const pendingColor = new Color("rgb", [194 / 255, 168 / 255, 19 / 255, 1]);

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

// store an issue collection per test suite, that way errors can be pushed into different files but still be associated
// with a specific test suite so we don't clear issues from other suites.
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

// element is an array of file -> ...ancestorTitles -> test title
interface TestTreeElement {
  segments: ReadonlyArray<string>;
  isLeaf: Boolean;
}

export class TestResultsManager
  implements Disposable, TreeDataProvider<TestTreeElement> {
  private _treeView = new TreeView("apexskier.jest.sidebar.tests", {
    dataProvider: this,
  });
  private _issueCollection = new TestIssueCollections();
  private _storedProcessInfo = new Map<
    string,
    { isRunning: boolean; results?: TestResult }
  >();

  private _compositeDisposable = new CompositeDisposable();

  constructor() {
    this.handleJestLine = this.handleJestLine.bind(this);
    this.getChildren = this.getChildren.bind(this);
    this._getRootElement = this._getRootElement.bind(this);
    this.getTreeItem = this.getTreeItem.bind(this);
    this._openTest = this._openTest.bind(this);

    this._compositeDisposable.add(this._treeView);
    this._compositeDisposable.add(this._issueCollection);
    this._compositeDisposable.add(
      nova.commands.register(
        "apexskier.jest.openTest",
        wrapCommand(this._openTest)
      )
    );
  }

  private async _openTest(workspace: Workspace) {
    const open = openFile.bind(workspace);
    const openableElements = this._treeView.selection.filter(
      ({ segments: [, ...ancestors], isLeaf }) =>
        isLeaf || ancestors.length === 0
    );
    const openFiles: { [file: string]: TextEditor | null } = {};
    await Promise.all(
      openableElements.map(async ({ segments: [path] }) => {
        const editor = await open(path);
        openFiles[path] = editor;
        // clear selection
        if (editor) {
          editor.selectedRange = new Range(0, 0);
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
      const location = this._storedProcessInfo
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
  }

  private _getRootElement(k: string): TestTreeElement {
    return {
      segments: [k],
      isLeaf:
        (this._storedProcessInfo.get(k)!.results?.testResults.length ?? 0) ===
        0,
    };
  }

  // TODO: I haven't yet figured out a reliable way to reload a specific element,
  // avoiding reference equality issues, that avoids spamming multiple reloads,
  // which causes annoying flickering issues
  // a simple mechanism would be a debounce, but there's some more stuff to try.
  // eslint-disable-next-line no-unused-vars
  private _reloadTree(key: TestTreeElement | null) {
    // console.log("reload", key?.segments.join(":"));
    this._treeView.reload(null);
  }

  handleJestLine(line: string) {
    if (!line.trim()) {
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      if (
        line.trim() ==
        "No tests found related to files changed since last commit."
      ) {
        // expected - jest has extra output that doesn't get wrapped in the custom reporter
        // when using only changed file watcher
        return;
      }
      console.warn("Failed to parse jest output");
      console.log(line);
      return;
    }
    const { event, data: rawData } = parsed;

    let toReload: TestTreeElement | null = null;
    switch (event) {
      case "onTestStart": {
        const data: Test = rawData;
        const key = nova.path.normalize(data.path);
        // this needs to happen only after initial load, I think
        if (this._storedProcessInfo.has(key)) {
          toReload = this._getRootElement(key);
        }
        this._storedProcessInfo.set(key, {
          isRunning: true,
          results: this._storedProcessInfo.get(key)?.results,
        });
        break;
      }
      case "onTestResult": {
        const data: TestResult = rawData;
        const key = nova.path.normalize(data.testFilePath);
        if (this._storedProcessInfo.has(key)) {
          toReload = this._getRootElement(key);
        }
        this._storedProcessInfo.set(key, { isRunning: false, results: data });
        const fileURI = `file://${key}`;
        const issueCollection = this._issueCollection.get(fileURI);
        issueCollection.clear();
        for (const result of data.testResults) {
          const severity = resultStatusToIssueSeverity(result.status);
          if (!severity) {
            continue;
          }
          const issue = new Issue();
          issue.message = result.fullName;
          issue.severity = severity;
          if (result.location) {
            issue.line = result.location.line;
            issue.column = result.location.column;
          }
          issueCollection.append(fileURI, [issue]);

          if (Array.isArray(result.failureDetails)) {
            result.failureDetails.map((details: any) => {
              if (typeof details.stack === "string") {
                const callSite = clean(details.stack);
                if (callSite) {
                  const issue = new Issue();
                  issue.message = details.message;
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
      case "onRunComplete": {
        const data: AggregatedResult = rawData;
        const realFiles = data.testResults.map((testResult) =>
          nova.path.normalize(testResult.testFilePath)
        );
        for (const file of this._storedProcessInfo.keys()) {
          if (!realFiles.includes(file)) {
            this._storedProcessInfo.delete(file);
          }
        }
        break;
      }
      default:
        console.warn("unexpected event", event);
    }
    this._reloadTree(toReload);
  }

  /// MARK Disposable

  dispose() {
    this._compositeDisposable.dispose();
  }

  /// MARK TreeDataProvider

  getChildren(element: TestTreeElement | null): Array<TestTreeElement> {
    if (!element) {
      return Array.from(this._storedProcessInfo.keys()).map(
        this._getRootElement
      );
    }
    const [path, ...ancestors] = element.segments;
    if (!path) {
      return [];
    }
    if (this._storedProcessInfo.has(path)) {
      let results =
        this._storedProcessInfo.get(path)?.results?.testResults ?? [];
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
  }

  getTreeItem(element: TestTreeElement) {
    const { segments, isLeaf } = element;
    const elementData = this._storedProcessInfo.get(segments[0]);
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
    if (isTestFile) {
      item.command = "apexskier.jest.openTest";
      item.path = segments[0];
      if (results?.failureMessage) {
        item.descriptiveText = results.failureMessage;
        item.tooltip = results.failureMessage;
        item.color = failureColor;
      } else {
        item.color = successColor;
      }
      if (isRunning) {
        item.color = pendingColor;
      }
    } else if (isLeaf) {
      item.command = "apexskier.jest.openTest";
      const testResult = results?.testResults.find(
        (r) => r.title === item.name
      );
      if (testResult) {
        if (testResult.failureMessages.length > 0) {
          item.descriptiveText = testResult.failureMessages[0];
          item.tooltip = testResult.failureMessages[0];
          item.color = failureColor;
        } else {
          item.tooltip = testResult.fullName;
          item.color = successColor;
        }
        if (isRunning) {
          item.color = pendingColor;
        }
      } else {
        console.warn("Failed to find results", item.name);
      }
    } else {
      item.image = "__builtin.path";
    }
    item.identifier = element.segments.join("__JEST_EXTENSION__");
    return item;
  }

  getParent(element: TestTreeElement) {
    return {
      segments: element.segments.slice(0, -1),
      isLeaf: false,
    };
  }
}
