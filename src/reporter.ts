import type {
  Reporter,
  Test,
  ReporterOnStartOptions,
  Context,
} from "@jest/reporters";
import type {
  AggregatedResult,
  TestCaseResult,
  TestResult,
} from "@jest/test-result";

export default class NovaExtensionReporter implements Reporter {
  // optional
  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ) {
    console.log(JSON.stringify({ event: "onTestResult", data: testResult }));
  }
  // // optional
  // onTestFileResult(
  //   test: Test,
  //   testResult: TestResult,
  //   aggregatedResult: AggregatedResult
  // ) {
  //   console.log("onTestFileResult");
  // }
  // optional
  onTestCaseResult(test: Test, testCaseResult: TestCaseResult) {
    // console.log("testCaseResult");
  }

  onRunStart(results: AggregatedResult, options: ReporterOnStartOptions) {
    // console.log("onRunStart");
    // console.log(results)
  }
  // optional
  onTestStart(test: Test) {
    console.log(JSON.stringify({ event: "onTestStart", data: test }));
  }
  // // optional
  // onTestFileStart(test: Test) {
  //   console.log("onTestFileStart");
  // }
  onRunComplete(contexts: Set<Context>, results: AggregatedResult) {
    // console.log("onRunComplete");
  }

  getLastError() {
    // noop, this never ends
  }
}
