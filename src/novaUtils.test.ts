import { wrapCommand } from "./novaUtils";

(global as any).nova = {
  workspace: {
    showErrorMessage: jest.fn(),
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
});
