import { clean } from "./stackUtils";

jest.mock("stack-utils", () => {
  function StackUtils() {
    return {
      parseLine: jest.fn((l) => {
        const match = l.trim().match(/.+ \((.+):(\d+):(\d+)\)/);
        const [, file] = match ?? [];
        return { file };
      }),
    };
  }
  StackUtils.nodeInternals = () => [];
  return { default: StackUtils };
});

describe("stackUtils", () => {
  const mockStack = `
    Error:
      at Suite.<anonymous> (/foobar/src/stackUtils.test.ts:12:14)
      at Suite.<anonymous> (/workspace/src/stackUtils.test.ts:12:14)
      at addSpecsToSuite (/workspace/node_modules/jest-jasmine2/build/jasmine/Env.js:444:51)
      at Env.describe (/workspace/node_modules/jest-jasmine2/build/jasmine/Env.js:414:11)
      at describe (/workspace/node_modules/jest-jasmine2/build/jasmine/jasmineLight.js:88:18)
      at Object.<anonymous> (/workspace/src/stackUtils.test.ts:11:1)
  `;

  it("cleans stack traces", () => {
    (nova as any).workspace = { path: "/workspace" };
    expect(clean(mockStack)).toMatchInlineSnapshot(`
      Object {
        "file": "/workspace/src/stackUtils.test.ts",
      }
    `);
  });

  it("cleans stack traces", () => {
    (nova as any).workspace = { path: undefined };
    expect(clean(mockStack)).toMatchInlineSnapshot(`
      Object {
        "file": "/foobar/src/stackUtils.test.ts",
      }
    `);
  });
});
