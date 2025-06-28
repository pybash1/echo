import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import * as Notifications from "expo-notifications";
import { AppState, AppStateStatus } from "react-native";

const API_ENDPOINT =
  "https://echo-proxy-murex.vercel.app/api/trpc/clipboard.addItem?batch=1";
const API_FETCH_DESKTOP =
  "https://echo-proxy-murex.vercel.app/api/trpc/clipboard.getLastCopiedItem?batch=1";

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isBackgroundModeEnabled = false;

async function sendToAPI(content: string) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        0: { json: { item: content, device: "mobile" } },
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to send to API:", error);
    throw error;
  }
}

async function fetchDesktopClipboard(): Promise<string | null> {
  try {
    const response = await fetch(
      API_FETCH_DESKTOP +
        `&input=${encodeURIComponent(
          JSON.stringify({ "0": { json: { device: "desktop" } } })
        )}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data?.[0]?.result?.data?.json?.item ?? null;
  } catch (e) {
    console.error("Failed to fetch desktop clipboard:", e);
    return null;
  }
}

async function performClipboardSync() {
  try {
    console.log("Performing clipboard sync...");

    // Get last clipboard content from storage
    const lastClipboard = await AsyncStorage.getItem("lastClipboard");
    const lastDesktopClipboard = await AsyncStorage.getItem(
      "lastDesktopClipboard"
    );

    let hasChanges = false;

    // Check device clipboard
    const currentClipboard = await Clipboard.getStringAsync();
    if (currentClipboard && currentClipboard !== lastClipboard) {
      await AsyncStorage.setItem("lastClipboard", currentClipboard);
      await sendToAPI(currentClipboard);
      console.log("Sent clipboard to API:", currentClipboard);
      hasChanges = true;
    }

    // Check desktop clipboard
    const desktopContent = await fetchDesktopClipboard();
    if (
      desktopContent &&
      desktopContent !== lastDesktopClipboard &&
      desktopContent !== lastClipboard
    ) {
      await AsyncStorage.setItem("lastDesktopClipboard", desktopContent);
      await AsyncStorage.setItem("lastClipboard", desktopContent);
      await Clipboard.setStringAsync(desktopContent);
      console.log("Updated clipboard from desktop:", desktopContent);
      hasChanges = true;

      // Show notification for desktop clipboard update
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Echo - Clipboard Synced",
          body: `Updated clipboard: ${desktopContent.substring(0, 50)}${
            desktopContent.length > 50 ? "..." : ""
          }`,
          data: { type: "clipboard-sync" },
        },
        trigger: null, // Show immediately
      });
    }

    console.log(
      "Clipboard sync completed",
      hasChanges ? "with changes" : "no changes"
    );
  } catch (error) {
    console.error("Clipboard sync error:", error);
  }
}

function handleAppStateChange(nextAppState: AppStateStatus) {
  if (isBackgroundModeEnabled) {
    if (nextAppState === "active") {
      // App came to foreground, perform immediate sync
      performClipboardSync();
    } else if (nextAppState === "background") {
      // App went to background, show immediate notification
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Echo - Background Sync",
          body: "Clipboard syncing will continue when you return to the app.",
          data: { type: "background-reminder" },
        },
        trigger: null, // Show immediately
      });
    }
  }
}

export async function startBackgroundSync() {
  try {
    // Request notification permissions
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") {
      console.log("Notification permission not granted");
    }

    // Start the sync interval
    if (syncInterval) {
      clearInterval(syncInterval);
    }

    syncInterval = setInterval(performClipboardSync, 1000); // Sync every second

    // Enable background mode
    isBackgroundModeEnabled = true;
    await AsyncStorage.setItem("backgroundSyncRunning", "true");

    // Listen for app state changes
    AppState.addEventListener("change", handleAppStateChange);

    // Perform initial sync
    await performClipboardSync();

    console.log("Background sync started");
    return true;
  } catch (error) {
    console.error("Failed to start background sync:", error);
    throw error;
  }
}

export async function stopBackgroundSync() {
  try {
    // Clear the sync interval
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }

    // Disable background mode
    isBackgroundModeEnabled = false;
    await AsyncStorage.setItem("backgroundSyncRunning", "false");

    console.log("Background sync stopped");
    return true;
  } catch (error) {
    console.error("Failed to stop background sync:", error);
    throw error;
  }
}

export async function isBackgroundSyncRunning(): Promise<boolean> {
  try {
    const isRunning = await AsyncStorage.getItem("backgroundSyncRunning");
    return isRunning === "true";
  } catch (error) {
    console.error("Failed to check background sync status:", error);
    return false;
  }
}

// Function to manually trigger a sync (useful for testing)
export async function triggerManualSync() {
  try {
    await performClipboardSync();
    return true;
  } catch (error) {
    console.error("Manual sync failed:", error);
    throw error;
  }
}
