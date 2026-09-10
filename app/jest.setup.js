// jest-expo bundles no AsyncStorage mock and its native module is null under Jest. Several modules
// import it transitively (e.g. via src/i18n), so the official mock is registered for the whole run.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// MapLibre throws at import time without a native binary; see __mocks__/@maplibre/maplibre-react-native.js.
jest.mock("@maplibre/maplibre-react-native");

// Icon fonts load asynchronously and setState after the test has finished; see __mocks__/@expo/vector-icons.js.
jest.mock("@expo/vector-icons");

// Nothing under test may reach the network: a real request holds Node's event loop open long after
// the assertions pass. Tests that need a response assign their own fetch.
//
// A plain function rather than jest.fn(): jest.resetAllMocks(), which many suites call in a
// beforeEach, strips a mock's implementation, and a fetch returning undefined fails far later and
// less clearly than one that rejects.
global.fetch = () =>
  Promise.reject(new Error("Unmocked fetch in a test: mock the API module, or assign global.fetch."));
