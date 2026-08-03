const { withProjectBuildGradle } = require("expo/config-plugins");

const MARKER = "// Pocket Tools: short Windows CMake staging directories";
const GRADLE_SNIPPET = `
${MARKER}
if (System.getProperty("os.name").toLowerCase(java.util.Locale.ROOT).contains("windows")) {
  def pocketToolsCmakeRoot = new File(
    System.getProperty("java.io.tmpdir"),
    "pocket-tools-cmake/" + Integer.toHexString(rootProject.projectDir.absolutePath.hashCode())
  )

  subprojects { subproject ->
    ["com.android.application", "com.android.library"].each { pluginId ->
      subproject.plugins.withId(pluginId) {
        def androidExtension = subproject.extensions.getByName("android")
        androidExtension.externalNativeBuild.cmake.buildStagingDirectory =
          new File(pocketToolsCmakeRoot, subproject.name)
      }
    }
  }
}
`;

module.exports = function withShortCmakeStaging(config) {
  return withProjectBuildGradle(config, (projectConfig) => {
    const contents = projectConfig.modResults.contents;
    if (!contents.includes(MARKER)) {
      projectConfig.modResults.contents = `${contents.trimEnd()}\n${GRADLE_SNIPPET}`;
    }
    return projectConfig;
  });
};
