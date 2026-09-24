import Constants from 'expo-constants';

/**
 * Whether the app is running inside the Expo Go client rather than its own
 * build.
 *
 * This matters because Expo Go ships a fixed set of native modules and ignores
 * everything under `plugins` and `android.config` / `ios.config` in app.json.
 * Several features therefore behave differently — see EXPO_GO_LIMITATIONS.
 *
 * `appOwnership` is the old signal and `executionEnvironment` the current one;
 * checking both keeps this working across SDK versions.
 */
export const isExpoGo =
  (Constants as any).appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

/** What testers should expect not to work when running through Expo Go. */
export const EXPO_GO_LIMITATIONS = [
  {
    feature: 'Push notifications',
    detail: 'Removed from Expo Go in SDK 53. Poll reminders and chat alerts will not arrive.',
  },
  {
    feature: 'Rider background GPS',
    detail: 'Background location needs a real build. Tracking pauses when the app is backgrounded.',
  },
  {
    feature: 'Map styling on iPhone',
    detail:
      "Expo Go's iOS build has no Google Maps SDK, so iPhones fall back to Apple Maps. " +
      'Locations and markers are correct, but the dark theme is missing. Android is unaffected.',
  },
  {
    feature: 'Saving the donation QR',
    detail: 'Writing to the photo gallery needs a real build.',
  },
];
