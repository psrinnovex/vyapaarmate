import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const INSTALL_MARKER = "vyapaarmate.native.install.v1";
const REFRESH_TOKEN_KEY = "vyapaarmate.native.refresh-token.v1";
const KEYCHAIN_SERVICE = "com.pshrinnovex.vyapaarmate.auth";

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: KEYCHAIN_SERVICE,
};

export async function initializeTokenVault() {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error("Secure device storage is unavailable.");
  }
  const installed = await AsyncStorage.getItem(INSTALL_MARKER);
  if (!installed) {
    // iOS Keychain can survive uninstall. A non-sensitive sandbox marker lets
    // us distinguish a real install and discard any orphaned refresh token.
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureOptions);
    await AsyncStorage.setItem(INSTALL_MARKER, new Date().toISOString());
  }
}

export function readRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureOptions);
}

export function writeRefreshToken(token: string) {
  return SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, secureOptions);
}

export function deleteRefreshToken() {
  return SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureOptions);
}
