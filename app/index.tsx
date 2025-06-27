import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const API_ENDPOINT =
  "https://echo-proxy-murex.vercel.app/api/trpc/clipboard.addItem?batch=1";
const API_FETCH_DESKTOP =
  "https://echo-proxy-murex.vercel.app/api/trpc/clipboard.getLastCopiedItem?batch=1";

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
  const [lastDesktopClipboard, setLastDesktopClipboard] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const colorScheme = useColorScheme();

  // Poll device clipboard and send to API if changed
  useEffect(() => {
    if (!isRunning) return;
    let isMounted = true;
    intervalRef.current = setInterval(async () => {
      try {
        const content = await Clipboard.getStringAsync();
        if (content && content !== lastClipboard) {
          setLastClipboard(content);
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
     
  }, [isRunning, lastClipboard]);

  // Poll API for desktop clipboard and copy to device if changed
  useEffect(() => {
    if (!isRunning) return;
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
     
  }, [isRunning, lastDesktopClipboard, lastClipboard]);

  const toggle = () => setIsRunning((r) => !r);

  return (
    <SafeAreaView
      className="flex items-center justify-center min-h-screen bg-gray-900 px-4"
    >
      <Text className="text-4xl font-bold text-green-500 mb-8 tracking-tight drop-shadow-md">
        Echo
      </Text>
      <Text
        className={`px-4 py-2 rounded-full mb-6 text-lg font-semibold shadow-md ${
          isRunning
            ? 'bg-green-900 text-green-200'
            : 'bg-red-900 text-red-200'
        }`}
      >
        {isRunning ? 'Syncing' : 'Stopped'}
      </Text>
      <View className="w-full max-w-md bg-gray-900 rounded-2xl shadow-lg p-6 mb-8 border border-gray-700">
        <Text className="text-gray-300 text-base mb-2 font-medium">
          Last copied on this device:
        </Text>
        <Text className="text-gray-100 text-lg font-mono bg-gray-800 rounded px-2 py-1 mb-4 break-all">
          {lastClipboard ?? 'Empty'}
        </Text>
        <Text className="text-gray-300 text-base mb-2 font-medium">
          Last copied from desktop:
        </Text>
        <Text className="text-blue-200 text-lg font-mono bg-blue-900 rounded px-2 py-1 break-all">
          {lastDesktopClipboard ?? 'Empty'}
        </Text>
      </View>
      <TouchableOpacity
        className={`w-full max-w-xs py-3 rounded-xl shadow-md ${
          isRunning
            ? 'bg-red-700'
            : 'bg-green-700'
        }`}
        onPress={toggle}
        activeOpacity={0.85}
      >
        <Text className="text-white text-lg font-bold text-center">
          {isRunning ? 'Stop Clipboard Sync' : 'Start Clipboard Sync'}
        </Text>
      </TouchableOpacity>
      <Text className="mt-8 text-gray-400 text-center text-xs">
        Your clipboard is kept in sync with your desktop device in the background.
      </Text>
    </SafeAreaView>
  );
}
