import { wrapCommand, cleanPath } from "./novaUtils";

(global as any).nova = {
  workspace: {
    path: "/workspace",
    showErrorMessage: jest.fn(),
  },
  environment: {
    HOME: "/home",
  },
};

describe("novaUtils", () => {
  describe("wrapCommand", () => {
    it("catches errors and displays them to the user", () => {
      const err = new Error("an error");
      const command = jest.fn(() => {
        throw err;
      });
      const wrapped = wrapCommand(command);
      expect(() => wrapped()).not.toThrow();
      expect(command).toHaveBeenCalledTimes(1);
      expect(
        (global as any).nova.workspace.showErrorMessage
      ).toHaveBeenCalledWith(err);
    });

    it("wraps a command", () => {
      const result = Symbol("abc");
      const command = jest.fn(() => result);
      const wrapped = wrapCommand(command);
      wrapped("a", "b", "c");
      expect(command).toBeCalledWith("a", "b", "c");
    });
  });

  describe("cleanPath", () => {
    it("normalizes paths", () => {
      expect(cleanPath("/test/to/../to")).toBe("");
    });

    it("replaces HOME with ~", () => {
      expect(cleanPath("/home/a/b/c")).toBe("~/a/b/c");
    });

    it("replaces workspace dir with .", () => {
      expect(cleanPath("/workspace/a/b/c")).toBe("./a/b/c");
    });
  });
});
