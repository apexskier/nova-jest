import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/reporter.ts",
  plugins: [typescript(), resolve()],
  output: {
    file: "jest.novaextension/Scripts/reporter.dist.js",
    sourcemap: true,
    format: "cjs",
    exports: "default",
  },
};
