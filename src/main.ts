import { wrapCommand } from "./novaUtils";
import { InformationView } from "./informationView";
import { getJestExecPath } from "./jestExecPath";
import { TestResultsManager } from "./testResults";

nova.commands.register(
  "apexskier.jest.openWorkspaceConfig",
  wrapCommand(function openWorkspaceConfig(workspace: Workspace) {
    workspace.openConfig("apexskier.jest");
  })
);

nova.commands.register("apexskier.jest.reload", reload);

const compositeDisposable = new CompositeDisposable();

async function reload() {
  deactivate();
  console.log("reloading...");
  await asyncActivate();
}

async function getJestVersion(jestExecPath: string) {
  return new Promise<string>((resolve, reject) => {
    const process = new Process(jestExecPath, {
      args: ["--version"],
      stdio: ["ignore", "pipe", "ignore"],
    });
    let str = "";
    process.onStdout((versionString) => {
      str += versionString.trim();
    });
    process.onDidExit((status) => {
      if (status === 0) {
        resolve(str);
      } else {
        reject(status);
      }
    });
    process.start();
  });
}

async function asyncActivate() {
  const informationView = new InformationView();
  compositeDisposable.add(informationView);

  informationView.status = "Activating...";

  // this determines how to run jest
  // it should be project specific, so find the best option in this order:
  // - explicitly configured
  // - best guess (installed in the main node_modules)
  // - within plugin (no choice of version)

  const jestExecPath = await getJestExecPath();
  if (!jestExecPath) {
    informationView.status = "Can't find Jest";
    return;
  }
  console.info("using jest at:", jestExecPath);

  // get the jest version to display in the sidebar
  void getJestVersion(jestExecPath).then((version) => {
    informationView.jestVersion = version;
  });

  if (!nova.workspace.path) {
    informationView.status = "No workspace";
    informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
    return;
  }

  const testResults = new TestResultsManager();
  compositeDisposable.add(testResults);

  // jest process will continually run
  const jestProcess = new Process(jestExecPath, {
    args: [
      "--watchAll",
      "--testLocationInResults",
      "--reporters",
      nova.path.join(nova.extension.path, "Scripts/reporter.dist.js"),
    ],
    env: {
      CI: "true",
    },
    cwd: nova.workspace.path,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // NOTE: We could emit in JSON (https://jestjs.io/docs/en/cli#--json) but that's going to be slower as all tests will need to pass before we can show results
  compositeDisposable.add(jestProcess.onStdout(testResults.handleJestLine));
  compositeDisposable.add(
    jestProcess.onStderr((line) => {
      console.warn(line.trim());
    })
  );
  compositeDisposable.add(
    jestProcess.onDidExit(() => {
      nova.workspace.showWarningMessage("Jest stopped unexpectedly");
      informationView.status = "Stopped";
    })
  );
  try {
    jestProcess.start();
    compositeDisposable.add({
      dispose() {
        jestProcess.terminate();
      },
    });
    informationView.status = "Running";
  } catch (err) {
    if (err.toString().includes("Could not find an executable for process")) {
      informationView.status = "Jest not found";
    } else {
      throw err;
    }
  }

  informationView.reload(); // this is needed, otherwise the view won't show up properly, possibly a Nova bug
}

// This isn't handled by Nova as async, but it's setup as async for tests
export async function activate() {
  console.log("activating...");
  return asyncActivate()
    .catch((err) => {
      console.error("Failed to activate");
      console.error(err);
    })
    .then(() => {
      console.log("activated");
    });
}

export function deactivate() {
  compositeDisposable.dispose();
}
