// jest-expo bundles no AsyncStorage mock and its native module is null under Jest. Several modules
// import it transitively (e.g. via src/i18n), so the official mock is registered for the whole run.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@react-native-community/netinfo", () => require("@react-native-community/netinfo/jest/netinfo-mock.js"));

// Worklets throws at import time without a native binary, and Reanimated imports it.
jest.mock("react-native-worklets", () => require("react-native-worklets/lib/module/mock"));

// Reanimated 4.7's start-up asks its Jest stand-in for a CSS event handler it throws on, on import.
jest.mock("react-native-reanimated/src/initializers", () => ({ initializeReanimatedModule: () => {} }));

// Gesture Handler's own stand-ins for the native module its import calls into.
require("react-native-gesture-handler/jestSetup");

// Its animated components look up a native host instance on mount, which test-renderer does not have.
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// expo-notifications subscribes a default handler on import, and Jest's automock returns a subscription without remove.
jest.mock("expo-notifications/build/NotificationsHandlerModule", () => ({
  __esModule: true,
  default: { addListener: () => ({ remove: () => {} }) },
}));

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
