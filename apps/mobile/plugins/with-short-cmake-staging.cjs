const { withProjectBuildGradle, withSettingsGradle } = require("expo/config-plugins");

const LEGACY_PROJECT_MARKER = "// Pocket Tools: short Windows CMake staging directories";
const SETTINGS_START_MARKER = "// Pocket Tools: begin short Windows CMake staging directories";
const SETTINGS_END_MARKER = "// Pocket Tools: end short Windows CMake staging directories";

const SETTINGS_SNIPPET = `${SETTINGS_START_MARKER}
def pocketToolsShortCmakeStagingEnabled =
  System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("windows")
def pocketToolsCmakeRoot = new File(
  System.getProperty("java.io.tmpdir"),
  "pocket-tools-cmake/" + Integer.toHexString(settingsDir.absolutePath.hashCode())
)

gradle.beforeProject { project ->
  ["com.android.application", "com.android.library"].each { pluginId ->
    project.pluginManager.withPlugin(pluginId) {
      def androidExtension = project.extensions.getByName("android")

      androidExtension.packagingOptions.jniLibs.pickFirsts += [
        "**/libc++_shared.so"
      ]

      if (pocketToolsShortCmakeStagingEnabled) {
        def moduleDirectory = project.path.replace(":", "_")
        androidExtension.externalNativeBuild.cmake.buildStagingDirectory =
          new File(pocketToolsCmakeRoot, moduleDirectory)
      }
    }
  }
}
${SETTINGS_END_MARKER}`;

module.exports = function withShortCmakeStaging(config) {
  config = withProjectBuildGradle(config, (projectConfig) => {
    projectConfig.modResults.contents = removeLegacyProjectSnippet(
      projectConfig.modResults.contents,
    );
    return projectConfig;
  });

  return withSettingsGradle(config, (settingsConfig) => {
    const contents = removeSettingsSnippet(settingsConfig.modResults.contents);
    settingsConfig.modResults.contents = `${contents.trimEnd()}\n\n${SETTINGS_SNIPPET}\n`;
    return settingsConfig;
  });
};

function removeLegacyProjectSnippet(contents) {
  const markerIndex = contents.indexOf(LEGACY_PROJECT_MARKER);
  return markerIndex === -1 ? contents : `${contents.slice(0, markerIndex).trimEnd()}\n`;
}

function removeSettingsSnippet(contents) {
  const start = contents.indexOf(SETTINGS_START_MARKER);
  if (start === -1) return contents;

  const end = contents.indexOf(SETTINGS_END_MARKER, start);
  if (end === -1) {
    throw new Error("Pocket Tools CMake staging settings marker is missing its end marker.");
  }

  return `${contents.slice(0, start).trimEnd()}\n${contents
    .slice(end + SETTINGS_END_MARKER.length)
    .trimStart()}`;
}
