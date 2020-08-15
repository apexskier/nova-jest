import { wrapCommand } from "./novaUtils";
import { InformationView } from "./informationView";

nova.commands.register(
  "apexskier.jest.openWorkspaceConfig",
  wrapCommand(function openWorkspaceConfig(workspace: Workspace) {
    workspace.openConfig("apexskier.jest");
  })
);

nova.config.onDidChange("apexskier.jest.config.execPath", reload);
nova.workspace.config.onDidChange("apexskier.jest.config.execPath", reload);

const compositeDisposable = new CompositeDisposable();

async function reload() {
  deactivate();
  console.log("reloading...");
  await asyncActivate();
}

const informationView = new InformationView(reload);

async function npmBin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const process = new Process("/usr/bin/env", {
      args: ["npm", "bin"],
      cwd: nova.workspace.path || nova.extension.path,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let result = "";
    process.onStdout((o) => {
      result += o;
    });
    process.onStderr((e) => console.warn("npm bin:", e.trimRight()));
    process.onDidExit((status) => {
      if (status === 0) {
        resolve(result.trim());
      } else {
        reject(new Error("failed to npm bin"));
      }
    });
    process.start();
  });
}

async function asyncActivate() {
  informationView.status = "Activating...";

  const npmBinDir = await npmBin();

  // this determines which version of typescript is being run
  // it should be project specific, so find the best option in this order:
  // - explicitly configured
  // - best guess (installed in the main node_modules)
  // - within plugin (no choice of version)
  let jestExecPath: string;
  const configJestExecPath =
    nova.workspace.config.get("apexskier.jest.config.execPath", "string") ??
    nova.config.get("apexskier.jest.config.execPath", "string");
  if (configJestExecPath) {
    if (nova.path.isAbsolute(configJestExecPath)) {
      jestExecPath = configJestExecPath;
    } else if (nova.workspace.path) {
      jestExecPath = nova.path.join(nova.workspace.path, configJestExecPath);
    } else {
      nova.workspace.showErrorMessage(
        "Save your workspace before using a relative Jest executable path."
      );
      return;
    }
  } else {
    jestExecPath = nova.path.join(npmBinDir, "jest");
  }
  // Note: I don't check file access here because I'm not using filesystem entitlements
  console.info("using jest at:", jestExecPath);

  const versionProcess = new Process(jestExecPath, {
    args: ["--version"],
    stdio: ["ignore", "pipe", "ignore"],
  });
  versionProcess.onStdout((versionString) => {
    informationView.tsVersion = versionString.trim();
  });
  versionProcess.start();

  informationView.status = "Running";

  informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
}

export function activate() {
  console.log("activating...");
  asyncActivate().catch((err) => {
    console.error("Failed to activate");
    console.error(err);
  });
}

export function deactivate() {
  compositeDisposable.dispose();
  informationView.status = "Deactivated";
}
