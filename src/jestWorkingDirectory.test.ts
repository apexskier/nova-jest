(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
    invoke: jest.fn(),
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

describe("jestWorkingDirectory", () => {
  const { getJestWorkingDir } = require("./jestWorkingDirectory");

  describe("reloads extension when it changes", () => {
    it("globally and for the workspace", () => {
      expect(nova.workspace.config.onDidChange).toBeCalledTimes(1);
      expect(nova.workspace.config.onDidChange).toBeCalledWith(
        "apexskier.jest.config.execWorkingDirectory",
        expect.any(Function)
      );
    });

    it("by calling the reload command", () => {
      const reload = (nova.workspace.config.onDidChange as jest.Mock).mock
        .calls[0][1];
      reload();
      expect(nova.commands.invoke).toBeCalledTimes(1);
      expect(nova.commands.invoke).toBeCalledWith("apexskier.jest.reload");
    });
  });

  describe("returns working directory", () => {
    describe("is valid", () => {
      beforeEach(() => {
        (nova.workspace.config.get as jest.Mock).mockReset();
        (nova.path.normalize as any) = jest.fn((str) => str);
      });

      afterEach(() => {
        expect(nova.path.normalize).toBeCalledTimes(1);
      });

      it("defaults to workspace", () => {
        (nova.workspace.path as any) = "/workspace";
        expect(getJestWorkingDir()).toBe("/workspace");
      });

      it("uses the workspace config", () => {
        (nova.workspace.config.get as any) = jest.fn(() => "/workspaceconfig");
        expect(getJestWorkingDir()).toBe("/workspaceconfig");
      });

      it("resolved relatively to the workspace", () => {
        (nova.workspace.path as any) = "/workspace";
        (nova.workspace.config.get as any) = jest.fn(
          () => "../workspaceconfig"
        );
        expect(getJestWorkingDir()).toBe("/workspace/../workspaceconfig");
      });
    });

    describe("is null when there's no workspace path and", () => {
      beforeEach(() => {
        (nova.workspace.path as any) = null;
      });

      it("no config", () => {
        expect(getJestWorkingDir()).toBe(null);
      });

      it("a relative config path", () => {
        (nova.workspace.config.get as any) = jest.fn(
          () => "../workspaceconfig"
        );
        expect(getJestWorkingDir()).toBe(null);
      });
    });
  });
});
