import { createRequire } from "node:module";
import { defineConfig } from "hardhat/config";

const require = createRequire(import.meta.url);

export default defineConfig({
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./.hardhat-cache",
    artifacts: "./artifacts",
  },
  solidity: {
    version: "0.8.28",
    path: require.resolve("solc/soljson.js"),
    preferWasm: true,
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true },
  },
});
