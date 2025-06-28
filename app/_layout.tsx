import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import "react-native-reanimated";
import "../styles/global.css";

export default function RootLayout() {
  const [loaded] = useFonts({
    PerfectlyNineties: require("../assets/fonts/PerfectlyNineties-Regular.ttf"),
    MatterThin: require("../assets/fonts/matter/MatterThin.ttf"),
    MatterLight: require("../assets/fonts/matter/MatterLight.ttf"),
    MatterRegular: require("../assets/fonts/matter/MatterRegular.ttf"),
    MatterMedium: require("../assets/fonts/matter/MatterMedium.ttf"),
    MatterSemiBold: require("../assets/fonts/matter/MatterSemiBold.ttf"),
    MatterBold: require("../assets/fonts/matter/MatterBold.ttf"),
    MatterHeavy: require("../assets/fonts/matter/MatterHeavy.ttf"),
    MatterBlack: require("../assets/fonts/matter/MatterBlack.ttf"),
  });

  if (!loaded) {
    return null;
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
