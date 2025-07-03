import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  isBackgroundSyncRunning,
  startBackgroundSync,
  stopBackgroundSync,
} from "../services/BackgroundClipboardService";

const API_ENDPOINT =
  process.env.EXPO_PUBLIC_PROXY_URL + "/api/trpc/clipboard.addItem?batch=1";
const API_FETCH_DESKTOP =
  process.env.EXPO_PUBLIC_PROXY_URL + "/api/trpc/clipboard.getLastCopiedItem?batch=1";

const POLL_INTERVAL = 1000; // ms

async function sendToAPI(content: string) {
  try {
    await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        0: { json: { item: content, device: "mobile" } },
      }),
    });
  } catch (error) {
    console.error("Failed to send to API:", error);
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
    // console.log("data: " + data?.[0]?.result?.data?.json?.item);
    // The response structure may need to be adjusted based on actual API response
    return data?.[0]?.result?.data?.json?.item ?? null;
  } catch (e) {
    console.error("Failed to fetch desktop clipboard:", e);
    return null;
  }
}

export default function HomeScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastClipboard, setLastClipboard] = useState<string | null>(null);
  const [lastDesktopClipboard, setLastDesktopClipboard] = useState<
    string | null
  >(null);
  const [isBackgroundMode, setIsBackgroundMode] = useState(false);
  const intervalRef = useRef<number | null>(null);

  // Load saved clipboard data on app start
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedClipboard = await AsyncStorage.getItem("lastClipboard");
        const savedDesktopClipboard = await AsyncStorage.getItem(
          "lastDesktopClipboard"
        );
        if (savedClipboard) setLastClipboard(savedClipboard);
        if (savedDesktopClipboard)
          setLastDesktopClipboard(savedDesktopClipboard);

        // Check if background sync is running
        const backgroundRunning = await isBackgroundSyncRunning();
        setIsBackgroundMode(backgroundRunning);
        setIsRunning(backgroundRunning);
      } catch (error) {
        console.error("Failed to load saved data:", error);
      }
    };

    loadSavedData();
  }, []);

  // Poll device clipboard and send to API if changed (foreground mode)
  useEffect(() => {
    if (!isRunning) return;
    let isMounted = true;
    intervalRef.current = setInterval(async () => {
      try {
        const content = await Clipboard.getStringAsync();
        if (content && content !== lastClipboard) {
          setLastClipboard(content);
          await AsyncStorage.setItem("lastClipboard", content);
          await sendToAPI(content);
        }
      } catch (e) {
        console.error("Clipboard poll error:", e);
      }
    }, POLL_INTERVAL);
    return () => {
      isMounted = false;
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, [isRunning, lastClipboard, isBackgroundMode]);

  // Poll API for desktop clipboard and copy to device if changed (foreground mode)
  useEffect(() => {
    if (!isRunning || isBackgroundMode) return;
    let isMounted = true;
    const desktopInterval = setInterval(async () => {
      try {
        const desktopContent = await fetchDesktopClipboard();
        if (
          desktopContent &&
          desktopContent !== lastDesktopClipboard &&
          desktopContent !== lastClipboard // avoid echoing back
        ) {
          setLastDesktopClipboard(desktopContent);
          setLastClipboard(desktopContent); // keep in sync
          await AsyncStorage.setItem("lastDesktopClipboard", desktopContent);
          await AsyncStorage.setItem("lastClipboard", desktopContent);
          await Clipboard.setStringAsync(desktopContent);
        }
      } catch (e) {
        console.error("Desktop clipboard poll error:", e);
      }
    }, POLL_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(desktopInterval);
    };
  }, [isRunning, lastDesktopClipboard, lastClipboard, isBackgroundMode]);

  const toggle = async () => {
    if (isRunning) {
      // Stop syncing
      if (isBackgroundMode) {
        await stopBackgroundSync();
        setIsBackgroundMode(false);
      }
      setIsRunning(false);
    } else {
      // Start syncing
      try {
        // Try to start background sync first
        await startBackgroundSync();
        setIsBackgroundMode(true);
        setIsRunning(true);
        Alert.alert(
          "Background Sync Started",
          "Clipboard syncing is now running in the background. The app will continue to sync even when minimized or closed.",
          [{ text: "OK" }]
        );
      } catch (error) {
        console.log("Background sync failed, falling back to foreground mode");
        // Fall back to foreground mode
        setIsBackgroundMode(false);
        setIsRunning(true);
        Alert.alert(
          "Foreground Sync Started",
          "Clipboard syncing is running in foreground mode. Keep the app open for continuous syncing.",
          [{ text: "OK" }]
        );
      }
    }
  };

  return (
    <SafeAreaView className="flex items-center justif-between min-h-screen bg-white px-4">
      <Text
        style={{ fontFamily: "PerfectlyNineties" }}
        className="text-5xl text-black mb-8 tracking-tight drop-shadow-md"
      >
        Echo
      </Text>
      <Text
        style={{ fontFamily: "MatterMedium" }}
        className={`px-6 py-3 rounded-full mb-8 text-lg shadow-md ${
          isRunning ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {isRunning
          ? isBackgroundMode
            ? "Background Syncing"
            : "Foreground Syncing"
          : "Stopped"}
      </Text>
      <View className="w-full max-w-md bg-gray-50 rounded-2xl shadow-lg p-6 mb-8 border border-gray-200">
        <Text
          style={{ fontFamily: "MatterSemiBold" }}
          className="text-gray-700 text-base mb-2"
        >
          Last copied on this device:
        </Text>
        <Text
          style={{ fontFamily: "MatterRegular" }}
          className="text-gray-700 text-lg bg-white rounded px-3 py-2 mb-4 break-all border border-gray-200"
        >
          {lastClipboard ?? "Empty"}
        </Text>
        <Text
          style={{ fontFamily: "MatterSemiBold" }}
          className="text-gray-700 text-base mb-2"
        >
          Last copied from desktop:
        </Text>
        <Text
          style={{ fontFamily: "MatterRegular" }}
          className="text-gray-700 text-lg bg-white rounded px-3 py-2 break-all border border-gray-200"
        >
          {lastDesktopClipboard ?? "Empty"}
        </Text>
      </View>
      <TouchableOpacity
        className={`w-full max-w-xs py-4 rounded-full shadow-md ${
          isRunning ? "bg-red-600" : "bg-black"
        }`}
        onPress={toggle}
        activeOpacity={0.85}
      >
        <Text
          style={{ fontFamily: "MatterBold" }}
          className="text-white text-lg text-center"
        >
          {isRunning ? "Stop Clipboard Sync" : "Start Clipboard Sync"}
        </Text>
      </TouchableOpacity>
      <Text
        style={{ fontFamily: "MatterRegular" }}
        className="mt-8 text-gray-500 text-center text-sm px-4"
      >
        {isBackgroundMode
          ? "Your clipboard is syncing in the background, even when the app is closed."
          : isRunning
          ? "Your clipboard is syncing in the foreground. Keep the app open for continuous syncing."
          : "Your clipboard will be kept in sync with your mac."}
      </Text>
    </SafeAreaView>
  );
}
