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
    normalize: jest.fn((s) => s),
  },
  workspace: {
    path: "/workspace",
  },
});

const ColorMock: jest.Mock<Partial<Color>> = jest.fn();
(global as any).Color = ColorMock;

const CompositeDisposableMock: jest.Mock<Partial<
  CompositeDisposable
>> = jest
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
const TreeViewTypedMock: jest.Mock<TreeView<
  unknown
>> = jest.fn().mockImplementation(mockTreeViewImplementation);
const TreeViewMock: jest.Mock<Partial<TreeView<unknown>>> = TreeViewTypedMock;
(global as any).TreeView = TreeViewMock;

class MockTreeItem {
  // eslint-disable-next-line no-unused-vars
  constructor(readonly name: unknown, readonly state: unknown) {}
}
(global as any).TreeItem = MockTreeItem;

const IssueCollectionMock: jest.Mock<Partial<
  IssueCollection
>> = jest.fn().mockImplementation(() => ({
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

  describe("Tree View", () => {
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
            "fileURI",
          ],
        },
      ]
    `);
    expect(trm.getTreeItem(rootChildren[0])).toMatchInlineSnapshot(`
      MockTreeItem {
        "color": mockConstructor {},
        "command": "apexskier.jest.openTest",
        "identifier": "fileURI",
        "name": "fileURI",
        "path": "fileURI",
        "state": Symbol(TreeItemCollapsibleState.Collapsed),
      }
    `);
    const fileChildren = trm.getChildren(rootChildren[0]);
    expect(fileChildren).toMatchInlineSnapshot(`
      Array [
        Object {
          "isLeaf": false,
          "segments": Array [
            "fileURI",
            "ancestor",
          ],
        },
        Object {
          "isLeaf": true,
          "segments": Array [
            "fileURI",
            "test result",
          ],
        },
      ]
    `);
    expect(trm.getTreeItem(fileChildren[0])).toMatchInlineSnapshot(`
      MockTreeItem {
        "identifier": "fileURI__JEST_EXTENSION__ancestor",
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
            "fileURI",
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
        "identifier": "fileURI__JEST_EXTENSION__ancestor__JEST_EXTENSION__title__JEST_EXTENSION__test result",
        "name": "test result",
        "state": Symbol(TreeItemCollapsibleState.None),
        "tooltip": "failure message",
      }
    `);
    expect(trm.getChildren(leaf[0])).toHaveLength(0);
  });
});
