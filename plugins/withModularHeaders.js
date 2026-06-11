const { withPodfile } = require('@expo/config-plugins');

// AppCheckCore (pulled in by @react-native-google-signin) requires GoogleUtilities
// and RecaptchaInterop to be built with modular headers when linking as static libs.
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    const snippet =
      "  pod 'GoogleUtilities', :modular_headers => true\n" +
      "  pod 'RecaptchaInterop', :modular_headers => true\n\n";

    if (!contents.includes("pod 'GoogleUtilities', :modular_headers => true")) {
      config.modResults.contents = contents.replace(
        /  use_react_native!\(/,
        snippet + '  use_react_native!('
      );
    }

    return config;
  });
};
