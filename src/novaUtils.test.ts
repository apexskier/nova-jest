import { wrapCommand, cleanPath, lineColToRange } from "./novaUtils";

(global as any).nova = {
  workspace: {
    path: "/workspace",
    showErrorMessage: jest.fn(),
  },
  environment: {
    HOME: "/home",
  },
};

class Range {
  // eslint-disable-next-line no-unused-vars
  constructor(readonly start: number, readonly end: number) {}
}
(global as any).Range = Range;

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
    it("replaces HOME with ~", () => {
      expect(cleanPath("/home/a/b/c")).toBe("~/a/b/c");
    });

    it("replaces workspace dir with .", () => {
      expect(cleanPath("/workspace/a/b/c")).toBe("./a/b/c");
    });
  });

  describe("lineColToRange", () => {
    const mockDocument: TextDocument = {
      getTextInRange() {
        return `A TextDocument represents an open text document in the application. Text document objects are not directly mutable, requiring a TextEditor object to make modifications. Text documents are not one-to-one to text editors, since multiple editors may be open for a single document.

PROPERTIES

uri
Returns the document’s unique URI, as a String. The URI is guaranteed to exist for all documents, but may change if the document is moved. Unsaved documents have a URI with an unsaved:// scheme.

This property is readonly.`;
      },
      eol: `
`,
    } as any;

    const validCases: Array<[
      {
        start: { line: number; character: number };
        end: { line: number; character: number };
      },
      Range
    ]> = [
      [
        {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
        new Range(0, 0),
      ],
      [
        {
          start: { line: 7, character: 0 },
          end: { line: 7, character: 25 },
        },
        new Range(491, 516),
      ],
    ];
    it.each(validCases)(
      "converts line + character ranges to nova form ranges, %#",
      (param, result) => {
        expect(lineColToRange(mockDocument, param)).toEqual(result);
      }
    );

    const invalidCases: Array<{
      start: { line: number; character: number };
      end: { line: number; character: number };
    }> = [
      {
        start: { line: -1, character: 0 },
        end: { line: 0, character: 0 },
      },
      {
        start: { line: 0, character: 0 },
        end: { line: -1, character: 0 },
      },
      {
        start: { line: 10, character: 0 },
        end: { line: 10, character: 25 },
      },
      {
        start: { line: 0, character: 0 },
        end: { line: 3, character: 1000 },
      },
    ];
    it.each(invalidCases)("throws errors for invalid ranges, %#", (param) => {
      expect(() => lineColToRange(mockDocument, param)).toThrow();
    });
  });
});
