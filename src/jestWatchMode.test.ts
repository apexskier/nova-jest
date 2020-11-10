import { getJestWatchMode } from "./jestWatchMode";

(global as any).nova = Object.assign(nova, {
  config: {
    get: () => false,
  },
  workspace: {
    relativizePath: () => __dirname,
    config: {
      get: () => "inherit",
    },
    // `contains` used to check presence of a `.git` folder, ensuring a Git project
    contains: () => true,
  },
});

describe("'watch' mode setting", () => {
  it("uses 'watchAll' mode if option is disabled", () => {
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses 'watchAll' mode if option is enabled but project is not a git repository", () => {
    (nova as any).config.get = () => true;
    (nova as any).workspace.contains = () => false;
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses 'watchAll' mode if project is a git repository but option is disabled", () => {
    (nova as any).config.get = () => false;
    (nova as any).workspace.contains = () => true;
    expect(getJestWatchMode()).toBe("--watchAll");
  });

  it("uses watch mode if option is enabled and project is a git repository", () => {
    (nova as any).config.get = () => true;
    (nova as any).workspace.contains = () => true;
    expect(getJestWatchMode()).toBe("--watch");
  });

  describe("workspace option overrides global option", () => {
    it("inherit option - disabled", () => {
      (nova as any).config.get = () => false;
      (nova as any).workspace.contains = () => true;
      (nova as any).workspace.config.get = () => "inherit";
      expect(getJestWatchMode()).toBe("--watchAll");
    });

    it("inherit option - enabled", () => {
      (nova as any).config.get = () => true;
      (nova as any).workspace.contains = () => true;
      (nova as any).workspace.config.get = () => "inherit";
      expect(getJestWatchMode()).toBe("--watch");
    });

    it("overrides global option - disabled", () => {
      (nova as any).config.get = () => false;
      (nova as any).workspace.contains = () => true;
      (nova as any).workspace.config.get = () => "true";
      expect(getJestWatchMode()).toBe("--watch");
    });

    it("overrides global option - enabled", () => {
      (nova as any).config.get = () => true;
      (nova as any).workspace.contains = () => true;
      (nova as any).workspace.config.get = () => "false";
      expect(getJestWatchMode()).toBe("--watchAll");
    });
  });
});
