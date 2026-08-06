function withUnsignedReleaseBuild(config) {
  const { withAppBuildGradle } = require("expo/config-plugins");
  return withAppBuildGradle(config, (gradleConfig) => {
    gradleConfig.modResults.contents = removeReleaseDebugSigning(
      gradleConfig.modResults.contents,
    );
    return gradleConfig;
  });
}

function removeReleaseDebugSigning(source) {
  const buildTypes = findNamedBlock(source, "buildTypes", 0, source.length);
  const release = findNamedBlock(source, "release", buildTypes.bodyStart, buildTypes.bodyEnd);
  const body = source.slice(release.bodyStart, release.bodyEnd);
  const signingLines = [...body.matchAll(/^([ \t]*)signingConfig\s+([^\r\n]+)[ \t]*$/gm)];

  if (signingLines.length !== 1 || signingLines[0][2].trim() !== "signingConfigs.debug") {
    throw new Error(
      "UNSIGNED_RELEASE_CONFIG_INVALID: expected exactly one release signingConfig using signingConfigs.debug.",
    );
  }

  const match = signingLines[0];
  const absoluteStart = release.bodyStart + match.index;
  let absoluteEnd = absoluteStart + match[0].length;
  if (source.slice(absoluteEnd, absoluteEnd + 2) === "\r\n") absoluteEnd += 2;
  else if (source[absoluteEnd] === "\n") absoluteEnd += 1;

  const output = `${source.slice(0, absoluteStart)}${source.slice(absoluteEnd)}`;
  const updatedBuildTypes = findNamedBlock(output, "buildTypes", 0, output.length);
  const updatedRelease = findNamedBlock(
    output,
    "release",
    updatedBuildTypes.bodyStart,
    updatedBuildTypes.bodyEnd,
  );
  const updatedBody = output.slice(updatedRelease.bodyStart, updatedRelease.bodyEnd);
  if (/^\s*signingConfig\b/m.test(updatedBody)) {
    throw new Error(
      "UNSIGNED_RELEASE_CONFIG_INVALID: release build still contains a signingConfig after transformation.",
    );
  }
  return output;
}

function findNamedBlock(source, name, start, end) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*\\{`, "g");
  pattern.lastIndex = start;
  const matches = [];
  for (let match = pattern.exec(source); match && match.index < end; match = pattern.exec(source)) {
    if (!isCodePosition(source, match.index)) continue;
    const open = source.indexOf("{", match.index);
    const close = findMatchingBrace(source, open);
    if (close >= end) continue;
    matches.push({ bodyStart: open + 1, bodyEnd: close });
  }
  if (matches.length !== 1) {
    throw new Error(
      `UNSIGNED_RELEASE_CONFIG_INVALID: expected exactly one ${name} block, found ${matches.length}.`,
    );
  }
  return matches[0];
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let state = "code";
  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "single-quote" || state === "double-quote") {
      if (character === "\\") {
        index += 1;
        continue;
      }
      if (
        (state === "single-quote" && character === "'") ||
        (state === "double-quote" && character === '"')
      ) {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
      continue;
    }
    if (character === "'") {
      state = "single-quote";
      continue;
    }
    if (character === '"') {
      state = "double-quote";
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("UNSIGNED_RELEASE_CONFIG_INVALID: unmatched Gradle block brace.");
}

function isCodePosition(source, position) {
  let state = "code";
  for (let index = 0; index < position; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (state === "line-comment") {
      if (character === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 1;
      }
      continue;
    }
    if (state === "single-quote" || state === "double-quote") {
      if (character === "\\") index += 1;
      else if (
        (state === "single-quote" && character === "'") ||
        (state === "double-quote" && character === '"')
      ) {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      state = "line-comment";
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
    } else if (character === "'") state = "single-quote";
    else if (character === '"') state = "double-quote";
  }
  return state === "code";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = withUnsignedReleaseBuild;
module.exports.removeReleaseDebugSigning = removeReleaseDebugSigning;
