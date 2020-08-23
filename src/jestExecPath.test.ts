(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
    invoke: jest.fn(),
  },
  config: {
    onDidChange: jest.fn(),
    ["get"]: jest.fn(),
  },
  extension: {
    path: "/extension",
  },
  path: {
    join(...args: string[]) {
      return args.join("/");
    },
    isAbsolute: jest.fn((path) => path.startsWith("/")),
  },
  workspace: {
    config: { onDidChange: jest.fn(), ["get"]: jest.fn() },
  },
});

const ProcessMock: jest.Mock<Partial<Process>> = jest.fn();
(global as any).Process = ProcessMock;

describe("jestExecPath", () => {
  beforeEach(() => {
    (nova.workspace.config.get as jest.Mock).mockReset();
    (nova.workspace as any).path = "/workspace";
    (nova.config.get as jest.Mock).mockReset();

    ProcessMock.mockReset().mockImplementation(() => ({
      onStdout: jest.fn((cb) => cb("/npmbin\n")),
      onStderr: jest.fn(),
      onDidExit: jest.fn((cb) => cb(0)),
      start: jest.fn(),
    }));
  });

  const { getJestExecPath } = require("./jestExecPath");

  describe("reloads extension when it changes", () => {
    it("globally and for the workspace", () => {
      expect(nova.config.onDidChange).toBeCalledTimes(1);
      expect(nova.config.onDidChange).toBeCalledWith(
        "apexskier.jest.config.execPath",
        expect.any(Function)
      );
      expect(nova.workspace.config.onDidChange).toBeCalledTimes(1);
      expect(nova.workspace.config.onDidChange).toBeCalledWith(
        "apexskier.jest.config.execPath",
        expect.any(Function)
      );
      // same function
      const onWorkspaceChange = (nova.workspace.config.onDidChange as jest.Mock)
        .mock.calls[0][1];
      const onGlobalChange = (nova.config.onDidChange as jest.Mock).mock
        .calls[0][1];
      expect(onWorkspaceChange).toBe(onGlobalChange);
    });

    it("by calling the reload command", () => {
      const reload = (nova.config.onDidChange as jest.Mock).mock.calls[0][1];
      reload();
      expect(nova.commands.invoke).toBeCalledTimes(1);
      expect(nova.commands.invoke).toBeCalledWith("apexskier.jest.reload");
    });
  });

  describe("returns extension path", () => {
    it("defaults to the workspace's npm installation", async () => {
      expect(await getJestExecPath()).toBe("/npmbin/jest");
    });

    it("uses the workspace config", async () => {
      (nova.workspace.config.get as any) = jest.fn(() => "/workspaceconfig");
      expect(await getJestExecPath()).toBe("/workspaceconfig");
    });

    it("uses the global config", async () => {
      (nova.config.get as any) = jest.fn(() => "/globalconfig");
      expect(await getJestExecPath()).toBe("/globalconfig");
    });

    it("uses the workspace config over the global config", async () => {
      (nova.workspace.config.get as any) = jest.fn(() => "/workspaceconfig");
      (nova.config.get as any) = jest.fn(() => "/globalconfig");
      expect(await getJestExecPath()).toBe("/workspaceconfig");
    });

    it("resolved relatively to the workspace", async () => {
      (nova.workspace.config.get as any) = jest.fn(() => "../workspaceconfig");
      expect(await getJestExecPath()).toBe("/workspace/../workspaceconfig");
    });
  });

  it("warns if the workspace isn't saved, but is configured relatively", async () => {
    (nova.workspace.path as any) = "";
    (nova.workspace.config.get as any) = jest.fn(() => "../workspaceconfig");
    (nova.workspace.showErrorMessage as any) = jest.fn();
    expect(await getJestExecPath()).toBeNull();
    expect(nova.workspace.showErrorMessage as jest.Mock).toBeCalledTimes(1);
    expect(nova.workspace.showErrorMessage as jest.Mock).toBeCalledWith(
      "Save your workspace before using a relative Jest executable path."
    );
  });
});
