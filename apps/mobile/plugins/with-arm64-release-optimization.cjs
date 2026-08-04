const { withGradleProperties } = require("expo/config-plugins");

const ANDROID_BUILD_PROPERTIES = [
  { key: "reactNativeArchitectures", value: "arm64-v8a" },
  { key: "android.enableMinifyInReleaseBuilds", value: "true" },
  { key: "android.enableShrinkResourcesInReleaseBuilds", value: "true" },
];

module.exports = function withArm64ReleaseOptimization(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const managedKeys = new Set(ANDROID_BUILD_PROPERTIES.map(({ key }) => key));

    gradleConfig.modResults = gradleConfig.modResults.filter(
      (item) => item.type !== "property" || !managedKeys.has(item.key),
    );
    gradleConfig.modResults.push(
      ...ANDROID_BUILD_PROPERTIES.map(({ key, value }) => ({
        type: "property",
        key,
        value,
      })),
    );

    return gradleConfig;
  });
};
