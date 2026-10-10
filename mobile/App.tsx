import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DetailScreen } from "./src/screens/DetailScreen";
import { ListScreen } from "./src/screens/ListScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { AppProvider } from "./src/store";
import { useTheme } from "./src/theme";

type Tab = "list" | "profile";

function Shell() {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>("list");
  const [date, setDate] = useState<string | null>(null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top", "left", "right"]}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      <View style={{ flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" }}>
        <View style={{ flex: 1 }}>
          {date ? (
            <DetailScreen date={date} onBack={() => setDate(null)} />
          ) : tab === "list" ? (
            <ListScreen onOpen={setDate} />
          ) : (
            <ProfileScreen />
          )}
        </View>
        {date ? null : (
          <SafeAreaView edges={["bottom"]} style={{ backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.line }}>
            <View style={{ flexDirection: "row" }}>
              <TabButton label="每日简报" active={tab === "list"} onPress={() => setTab("list")} />
              <TabButton label="我的" active={tab === "profile"} onPress={() => setTab("profile")} />
            </View>
          </SafeAreaView>
        )}
      </View>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: active ? theme.accent : theme.muted, fontWeight: active ? "700" : "400", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Shell />
      </AppProvider>
    </SafeAreaProvider>
  );
}
