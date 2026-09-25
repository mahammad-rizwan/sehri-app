module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Auto-injection stays off because it errored here; the worklets
          // plugin is added explicitly below instead.
          reanimated: false,
        },
      ],
    ],
    plugins: [
      /**
       * Reanimated 4 still needs a Babel plugin — it moved out of
       * `react-native-reanimated/plugin` into `react-native-worklets/plugin`.
       * Without it any `useAnimatedStyle` or gesture callback fails at import
       * time with "[Worklets] Failed to create a worklet", which takes down the
       * whole screen that imported it. Must stay last.
       */
      'react-native-worklets/plugin',
    ],
  };
};
