// ethereum EIP-170 24k deployed bytecode limit
import childProcess from "child_process";
import path from "path";
import fs from "fs";

const spawnSync = childProcess.spawnSync;

const { output: logs } = spawnSync("npx hardhat compile", [], {
  shell: true,
  encoding: "utf-8",
});

console.log("\n", logs, "\n");

const rootPrefix = /utils/.test(path.resolve("")) ? ".." : ".";

const contractBytecode = JSON.parse(
  fs.readFileSync(
    `${rootPrefix}/artifacts/contracts/${process.argv[2]}/${process.argv[3]}.sol/${process.argv[3]}.json`
  )
).deployedBytecode;

const bytesLength = contractBytecode.length / 2 - 1;

console.log(`
  ${process.argv[3]} deployed 
  Bytecode size: ${bytesLength}b,
  Can deploy? => ${
    bytesLength <= 24576 ? "\x1b[32m true" : "\x1b[31m false"
  } \x1b[0m
`);

console.log("EIP-170 contract code size limit is 24576 bytes. \n");
