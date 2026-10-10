import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Cover } from "../components/Cover";
import { formatBriefingDate } from "../shared/format";
import { useApp } from "../store";
import { useTheme } from "../theme";

export function ListScreen({ onOpen }: { onOpen: (date: string) => void }) {
  const theme = useTheme();
  const { briefings, refresh, refreshing, loadError } = useApp();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text, marginBottom: 6 }}>每日简报</Text>
      <Text style={{ color: theme.muted, marginBottom: 16 }}>一天一份。点进去读编号短讯。</Text>
      {loadError ? (
        <Text style={{ color: theme.muted, marginBottom: 12 }}>{loadError}</Text>
      ) : null}
      {briefings.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
          <Text style={{ color: theme.muted }}>今天的简报还在整理</Text>
        </View>
      ) : (
        briefings.map((briefing) => (
          <Pressable
            key={briefing.date}
            onPress={() => onOpen(briefing.date)}
            style={{
              backgroundColor: theme.card,
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
              flexDirection: "row",
              gap: 12,
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.muted, fontSize: 13 }}>{formatBriefingDate(briefing.date)}</Text>
              <Text numberOfLines={1} style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}>
                {briefing.title}
              </Text>
              <Text numberOfLines={1} style={{ color: theme.muted, fontSize: 14 }}>
                {briefing.lede}
              </Text>
              {briefing.frozen ? null : (
                <Text style={{ color: theme.accent, fontSize: 12 }}>未定稿 · 会随兴趣变化</Text>
              )}
            </View>
            <Cover title={briefing.title} uri={briefing.imageUrl} width={72} height={72} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}
