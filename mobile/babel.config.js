module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Disable auto-injection of reanimated plugin.
          // reanimated v4 uses react-native-worklets separately —
          // the old babel plugin is not needed and causes build errors.
          reanimated: false,
        },
      ],
    ],
  };
};
