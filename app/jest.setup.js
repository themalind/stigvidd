// jest-expo no longer bundles an AsyncStorage mock, and AsyncStorage's native
// module is null under Jest. Several modules import it transitively (e.g. via
// src/i18n), so register the official mock for the whole test run.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
