/* eslint-disable no-unused-vars */

import type {
  Reporter,
  Test,
  ReporterOnStartOptions,
  Context,
} from "@jest/reporters";
import type { AggregatedResult, TestResult } from "@jest/test-result";

export default class NovaExtensionReporter implements Reporter {
  // optional
  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ) {
    console.log(JSON.stringify({ event: "onTestResult", data: testResult }));
  }

  onRunStart(results: AggregatedResult, options: ReporterOnStartOptions) {}
  onTestStart(test: Test) {
    console.log(JSON.stringify({ event: "onTestStart", data: test }));
  }
  onRunComplete(contexts: Set<Context>, results: AggregatedResult) {
    console.log(JSON.stringify({ event: "onRunComplete", data: results }));
  }

  getLastError() {
    // noop, this never ends
  }
}
