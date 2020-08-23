import NovaExtensionReporter from "./reporter";

describe("NovaExtensionReporter", () => {
  it("cleans stack traces", () => {
    const reporter = new NovaExtensionReporter();

    global.console.log = jest.fn();

    reporter.onTestResult({} as any, { data: "data" } as any, {} as any);
    reporter.onTestStart({ data: "data" } as any);

    expect(console.log).toBeCalledTimes(2);
    expect((console.log as jest.Mock).mock.calls[0][0]).toMatchInlineSnapshot(
      `"{\\"event\\":\\"onTestResult\\",\\"data\\":{\\"data\\":\\"data\\"}}"`
    );
    expect((console.log as jest.Mock).mock.calls[1][0]).toMatchInlineSnapshot(
      `"{\\"event\\":\\"onTestStart\\",\\"data\\":{\\"data\\":\\"data\\"}}"`
    );
  });
});
