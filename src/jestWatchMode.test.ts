import { getJestWatchMode } from "./jestWatchMode";

(global as any).nova = Object.assign(nova, {
  config: {
    get: () => false,
  },
  workspace: {
    relativizePath: () => __dirname,
  },
});

describe("watch mode setting", () => {
  it("uses watchAll mode if option is disabled", () => {
    (nova as any).config.get = () => false;
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses watchAll mode if option is enabled but project is not a git repository", () => {
    (nova as any).config.get = () => true;
    (nova as any).workspace.contains = () => false;
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses watchAll mode if project is a git repository but option is disabled", () => {
    (nova as any).config.get = () => false;
    (nova as any).workspace.contains = () => true;
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses watch mode if option is enabled and project is a git repository", () => {
    (nova as any).config.get = () => true;
    (nova as any).workspace.contains = () => true;
    expect(getJestWatchMode()).toBe("--watch");
  });
});
