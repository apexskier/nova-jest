import type {
  // eslint-disable-next-line no-unused-vars
  AggregatedResult,
  // eslint-disable-next-line no-unused-vars
  AssertionResult,
  // eslint-disable-next-line no-unused-vars
  TestResult,
} from "@jest/test-result";
// eslint-disable-next-line no-unused-vars
import type * as testResultsModule from "./testResults";

jest.mock("./stackUtils", () => ({
  clean: jest.fn(),
}));

(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
  },
  path: {
    normalize: jest.fn((s) => "normalized__" + s),
  },
  workspace: {
    path: "/workspace",
  },
});

const ColorMock: jest.Mock<Partial<Color>> = jest.fn();
(global as any).Color = ColorMock;

const CompositeDisposableMock: jest.Mock<
  Partial<CompositeDisposable>
> = jest
  .fn()
  .mockImplementation(() => ({ add: jest.fn(), dispose: jest.fn() }));
(global as any).CompositeDisposable = CompositeDisposableMock;

function mockTreeViewImplementation() {
  return {
    reload: jest.fn(),
    onDidChangeSelection: jest.fn(),
    dispose: jest.fn(),
    visible: true,
  };
}
const TreeViewTypedMock: jest.Mock<
  TreeView<unknown>
> = jest.fn().mockImplementation(mockTreeViewImplementation);
const TreeViewMock: jest.Mock<Partial<TreeView<unknown>>> = TreeViewTypedMock;
(global as any).TreeView = TreeViewMock;

class MockTreeItem {
  // eslint-disable-next-line no-unused-vars
  constructor(readonly name: unknown, readonly state: unknown) {}
}
(global as any).TreeItem = MockTreeItem;

const IssueCollectionMock: jest.Mock<
  Partial<IssueCollection>
> = jest.fn().mockImplementation(() => ({
  clear: jest.fn(),
  append: jest.fn(),
}));
(global as any).IssueCollection = IssueCollectionMock;

(global as any).IssueSeverity = { Error: "Error", Hint: "Hint" };

const IssueMock: jest.Mock<Partial<Issue>> = jest.fn();
(global as any).Issue = IssueMock;

(global as any).TreeItemCollapsibleState = {
  None: Symbol("TreeItemCollapsibleState.None"),
  Collapsed: Symbol("TreeItemCollapsibleState.Collapsed"),
};

describe("TestResultsManager", () => {
  const { TestResultsManager } = require("./testResults") as {
    TestResultsManager: typeof testResultsModule.TestResultsManager;
  };

  test("smoke test", () => {
    new TestResultsManager();
  });

  test("Tree View", () => {
    const trm = new TestResultsManager();

    const failingTestResult: Pick<
      AssertionResult,
      | "failureDetails"
      | "failureMessages"
      | "title"
      | "status"
      | "ancestorTitles"
    > = {
      ancestorTitles: ["ancestor", "title"],
      title: "test result",
      status: "failed",
      failureDetails: [{ stack: "askdljfasf", message: "failure message" }],
      failureMessages: ["failure message"],
    };
    const passedTestResult: Pick<
      AssertionResult,
      | "failureDetails"
      | "failureMessages"
      | "title"
      | "status"
      | "ancestorTitles"
    > = {
      ancestorTitles: [],
      title: "test result",
      status: "failed",
      failureDetails: [],
      failureMessages: [],
    };
    const testResults: Pick<TestResult, "testFilePath" | "testResults"> = {
      testFilePath: "fileURI",
      testResults: [failingTestResult as any, passedTestResult as any],
    };
    trm.handleJestLine(
      JSON.stringify({ event: "onTestResult", data: testResults })
    );

    const rootChildren = trm.getChildren(null);
    expect(rootChildren).toMatchInlineSnapshot(`
      Array [
        Object {
          "isLeaf": false,
          "segments": Array [
            "normalized__fileURI",
          ],
        },
      ]
    `);
    expect(trm.getTreeItem(rootChildren[0])).toMatchInlineSnapshot(`
      MockTreeItem {
        "color": mockConstructor {},
        "command": "apexskier.jest.openTest",
        "identifier": "normalized__fileURI",
        "name": "normalized__fileURI",
        "path": "normalized__fileURI",
        "state": Symbol(TreeItemCollapsibleState.Collapsed),
      }
    `);
    const fileChildren = trm.getChildren(rootChildren[0]);
    expect(fileChildren).toMatchInlineSnapshot(`
      Array [
        Object {
          "isLeaf": false,
          "segments": Array [
            "normalized__fileURI",
            "ancestor",
          ],
        },
        Object {
          "isLeaf": true,
          "segments": Array [
            "normalized__fileURI",
            "test result",
          ],
        },
      ]
    `);
    expect(trm.getTreeItem(fileChildren[0])).toMatchInlineSnapshot(`
      MockTreeItem {
        "identifier": "normalized__fileURI__JEST_EXTENSION__ancestor",
        "image": "__builtin.path",
        "name": "ancestor",
        "state": Symbol(TreeItemCollapsibleState.Collapsed),
      }
    `);
    const leaf = trm.getChildren(trm.getChildren(fileChildren[0])[0]);
    expect(leaf).toMatchInlineSnapshot(`
      Array [
        Object {
          "isLeaf": true,
          "segments": Array [
            "normalized__fileURI",
            "ancestor",
            "title",
            "test result",
          ],
        },
      ]
    `);
    expect(trm.getTreeItem(leaf[0])).toMatchInlineSnapshot(`
      MockTreeItem {
        "color": mockConstructor {},
        "command": "apexskier.jest.openTest",
        "descriptiveText": "failure message",
        "identifier": "normalized__fileURI__JEST_EXTENSION__ancestor__JEST_EXTENSION__title__JEST_EXTENSION__test result",
        "name": "test result",
        "state": Symbol(TreeItemCollapsibleState.None),
        "tooltip": "failure message",
      }
    `);
    expect(trm.getChildren(leaf[0])).toHaveLength(0);
  });

  test("Removed test files are cleared", () => {
    const trm = new TestResultsManager();

    const testResult: Pick<
      AssertionResult,
      | "failureDetails"
      | "failureMessages"
      | "title"
      | "status"
      | "ancestorTitles"
    > = {
      ancestorTitles: [],
      title: "test result",
      status: "failed",
      failureDetails: [],
      failureMessages: [],
    };
    trm.handleJestLine(
      JSON.stringify({
        event: "onTestResult",
        data: {
          testFilePath: "fileURI1",
          testResults: [testResult],
        },
      })
    );
    trm.handleJestLine(
      JSON.stringify({
        event: "onTestResult",
        data: {
          testFilePath: "fileURI2",
          testResults: [testResult],
        },
      })
    );
    // 2 files are being tracked
    expect(trm.getChildren(null)).toHaveLength(2);
    // now jest only knows about 1 file
    trm.handleJestLine(
      JSON.stringify({
        event: "onRunComplete",
        data: {
          testResults: [{ testFilePath: "fileURI2" }],
        },
      })
    );
    // and now 1 file is being tracked (and it's the right one)
    expect(trm.getChildren(null)).toHaveLength(1);
    expect(trm.getChildren(null)[0].segments[0]).toBe("normalized__fileURI2");
  });

  test("Handles bad output", () => {
    const trm = new TestResultsManager();
    const globalWarn = global.console.warn;
    global.console.warn = jest.fn();
    const globalLog = global.console.log;
    global.console.log = jest.fn();

    const line = "not real json";
    trm.handleJestLine(line);

    expect(global.console.warn).toBeCalledTimes(1);
    global.console.warn = globalWarn;
    expect(global.console.log).toBeCalledTimes(1);
    expect(global.console.log).toBeCalledWith(line);
    global.console.log = globalLog;
  });

  test("Ignores first-run no tests errors.", () => {
    const trm = new TestResultsManager();
    const globalWarn = global.console.warn;
    global.console.warn = jest.fn();

    trm.handleJestLine(
      "No tests found related to files changed since last commit.\n  "
    );

    expect(global.console.warn).not.toBeCalled();
    global.console.warn = globalWarn;
  });
});
