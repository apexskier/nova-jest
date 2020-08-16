import typescript from "rollup-plugin-typescript2";
import builtins from "rollup-plugin-node-builtins";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "src/main.ts",
  plugins: [resolve(), commonjs(), typescript(), builtins()],
  output: {
    file: "jest.novaextension/Scripts/main.dist.js",
    sourcemap: true,
    format: "cjs",
  },
};
