jest.mock("./stackUtils", () => ({
  clean: jest.fn(),
}));

(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
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

// function mockTreeViewImplementation() {
//   return {
//     reload: jest.fn(),
//     onDidChangeSelection: jest.fn(),
//     dispose: jest.fn(),
//     visible: true,
//   };
// }
const TreeViewTypedMock: jest.Mock<TreeView<unknown>> = jest.fn();
const TreeViewMock: jest.Mock<Partial<TreeView<unknown>>> = TreeViewTypedMock;
(global as any).TreeView = TreeViewMock;

describe("TestResultsManager", () => {
  const { TestResultsManager } = require("./testResults");

  test("smoke test", () => {
    new TestResultsManager();
  });
});
