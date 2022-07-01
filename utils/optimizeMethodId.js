// MIT-License - inspired by https://medium.com/joyso/solidity-how-does-function-name-affect-gas-consumption-in-smart-contract-47d270d8ac92 - github user emn178

const { keccak256, toUtf8Bytes, id, arrayify } = require("ethers").ethers.utils;

const OPT_FLAG = "optimize";
const CHAR_CODE_MAP = {};

const CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_".split("");

CHARS.forEach(function (c, index) {
  CHAR_CODE_MAP[index] = c.charCodeAt(0);
});

function toChars(bytes) {
  var str = "";

  for (var i = 0; i < bytes.length; ++i) {
    str += CHARS[bytes[i]];
  }

  return str;
}

function parseSignature(signature) {
  if (
    signature.charAt(signature.length - 1) != ")" ||
    signature.indexOf(" ") !== -1
  ) {
    return false;
  }

  var parts = signature.split("(");

  if (parts.length == 2) {
    return {
      name: parts[0],
      args: "(" + parts[1],
    };
  } else {
    return false;
  }
}

function increase(bytes) {
  bytes[0] += 1;

  for (let i = 0; i < bytes.length; ++i) {
    if (bytes[i] === 64) {
      bytes[i] = 0;
      if (i == bytes.length - 1) {
        bytes[i + 1] = 1;
      } else {
        bytes[i + 1] += 1;
      }
    } else {
      break;
    }
  }

  return bytes;
}

function mergeUInt8Arrays(arrays) {
  const mergeLength = arrays.reduce((tot, { length: lgth }) => tot + lgth, 0);
  const mergedArr = new Uint8Array(mergeLength);
  let trailingLength = 0;

  arrays.forEach((arr) => {
    mergedArr.set(arr, trailingLength);
    trailingLength += arr.length;
  });

  return mergedArr;
}

function find(obj, sortFlag) {
  let sig = obj.name + obj.args;
  let argsUtf8 = toUtf8Bytes(obj.args);
  let bytes = [0];
  let index = 0;
  //   let prefix = toBytes(obj.name + "_"); // pushes char codes
  let prefixUtf8 = toUtf8Bytes(obj.name + "_");

  let workingPrefixUtf8 = prefixUtf8;

  let char,
    methodId = arrayify(id(sig));

  const selectorCondition =
    sortFlag === OPT_FLAG
      ? (mId) => mId[0] || mId[1]
      : (mId) => mId[0] || mId[1] > 15;
  console.log(methodId[0]);

  while (selectorCondition(methodId)) {
    // try {
    if (index >= CHARS.length) {
      index = 0;
      increase(bytes);

      workingPrefixUtf8 = mergeUInt8Arrays([
        prefixUtf8,
        toUtf8Bytes(toChars(bytes)),
      ]);
    }

    char = CHARS[index];

    methodId = arrayify(
      keccak256(
        mergeUInt8Arrays([workingPrefixUtf8, toUtf8Bytes(char), argsUtf8])
      )
    );
    ++index;
  }

  // index == 0 rare - orig selector starting with "0x0000"
  if (index) {
    let bytesChars = bytes[0] > 0 ? toChars(bytes) : "";
    sig = obj.name + "_" + bytesChars + char + obj.args;
  }

  return { sig, selector: keccak256(toUtf8Bytes(sig)).substring(0, 10) };
}

function main() {
  const flagIdx = process.argv.indexOf("--" + OPT_FLAG, 2);
  const sortFlg = flagIdx > 0 ? OPT_FLAG : "standard";

  let methods = process.argv.slice(2).find((arg, idx) => {
    if (idx !== flagIdx) {
      return true;
    }
  });

  //   if (methods.includes("),")) {
  //     methods = methods.split(/,(\w+\(.*\))/).slice(0, -1);
  //   }

  console.log(methods);

  const parsedSig = parseSignature(methods);
  const result = find(parsedSig, sortFlg);

  console.log(result.sig + ": " + result.selector);
}

main();
