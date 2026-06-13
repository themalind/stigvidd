import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n, { changeLanguage, LANGUAGE_STORAGE_KEY, loadStoredLanguage } from "../index";

beforeEach(async () => {
  await AsyncStorage.clear();
  await i18n.changeLanguage("sv");
});

describe("changeLanguage", () => {
  it("persists the language to AsyncStorage", async () => {
    await changeLanguage("en");
    expect(await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("updates the active i18n language", async () => {
    await changeLanguage("en");
    expect(i18n.language).toBe("en");
  });
});

describe("loadStoredLanguage", () => {
  it("switches to the stored language", async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    await loadStoredLanguage();
    expect(i18n.language).toBe("en");
  });

  it("does nothing when no language is stored", async () => {
    await loadStoredLanguage();
    expect(i18n.language).toBe("sv");
  });

  it("ignores invalid stored values", async () => {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    await loadStoredLanguage();
    expect(i18n.language).toBe("sv");
  });
});

describe("plural forms", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("sv");
  });

  it("friendsCount uses singular form for 1", () => {
    expect(i18n.t("friends.friendsCount", { count: 1 })).toBe("Vän (1)");
  });

  it("friendsCount uses plural form for many", () => {
    expect(i18n.t("friends.friendsCount", { count: 5 })).toBe("Vänner (5)");
  });

  it("trailList.showing uses singular noun for 1 total", () => {
    expect(i18n.t("trailList.showing", { count: 1, shown: 1 })).toBe("Visar 1 av 1 led");
  });

  it("trailList.showing uses plural noun for many total", () => {
    expect(i18n.t("trailList.showing", { count: 20, shown: 5 })).toBe("Visar 5 av 20 leder");
  });
});
