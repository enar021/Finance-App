const { withAppBuildGradle } = require('expo/config-plugins');

const marker = '// Limit native object paths for Windows toolchains';

module.exports = function withWindowsCmakePathLimit(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `

${marker}
android {
  defaultConfig {
    externalNativeBuild {
      cmake {
        arguments "-DCMAKE_OBJECT_PATH_MAX=240"
      }
    }
  }
}
`;
    }

    return config;
  });
};
