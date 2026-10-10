import { useEffect, useState } from "react";
import { Image, Linking, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Cover, mediaUri } from "../components/Cover";
import { ITEM_DETAILS } from "../data/details";
import { formatBriefingDate } from "../shared/format";
import { hasRecognized } from "../shared/preferences";
import type { Briefing, BriefingItem, Reaction, StoryBlock } from "../shared/types";
import { useApp } from "../store";
import { useTheme } from "../theme";

export function DetailScreen({ date, onBack }: { date: string; onBack: () => void }) {
  const theme = useTheme();
  const { briefings, reactions, setItemReaction, prefs } = useApp();
  const [page, setPage] = useState<Briefing | null>(
    () => briefings.find((item) => item.date === date) ?? null,
  );
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  const [openItem, setOpenItem] = useState<BriefingItem | null>(null);

  useEffect(() => {
    const found = briefings.find((item) => item.date === date);
    if (found) setPage((current) => (current?.date === date ? current : found));
  }, [briefings, date]);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 2000);
    return () => clearTimeout(timer);
  }, [note]);

  if (!page) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20 }}>
        <Text style={{ color: theme.muted }}>没有这份简报</Text>
      </View>
    );
  }

  const groups: Array<"今日要闻" | "你的关注"> = ["今日要闻", "你的关注"];
  const snapshot = page;

  function onReact(item: BriefingItem, next: Reaction) {
    const key = `${snapshot.date}:${item.id}`;
    const current = reactions[key]?.reaction ?? null;
    const resolved = current === next ? null : next;
    setItemReaction(snapshot.date, item, resolved);
    if (!resolved) {
      setNote({ id: item.id, text: "已取消" });
      return;
    }
    const domains = item.domains.join("」「");
    setNote({ id: item.id, text: `已记入主题「${item.topic}」、领域「${domains}」` });
  }

  async function onShare() {
    try {
      await Share.share({ message: `${formatBriefingDate(snapshot.date)} ${snapshot.title}` });
    } catch {
      // 分享面板被关掉时不必提示
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={{ color: theme.accent, fontSize: 16 }}>返回</Text>
          </Pressable>
          <Pressable onPress={onShare} hitSlop={8}>
            <Text style={{ color: theme.accent, fontSize: 16 }}>分享</Text>
          </Pressable>
        </View>
        <Text style={{ color: theme.muted }}>{formatBriefingDate(page.date)}</Text>
        <Text style={{ color: theme.text, fontSize: 32, fontWeight: "700", marginTop: 4, marginBottom: 14 }}>{page.title}</Text>
        <Cover title={page.title} uri={page.imageUrl} width="100%" height={180} radius={12} />
        <Text style={{ color: theme.muted, marginTop: 12, marginBottom: 8 }}>共 {page.items.length} 条</Text>
        {page.frozen ? null : (
          <Text style={{ color: theme.accent, marginBottom: 8 }}>未定稿。点图标后，返回列表会按新的兴趣重排这一份。</Text>
        )}
        {groups.map((group) => {
          const rows = page.items.filter((item) => item.group === group);
          if (rows.length === 0) return null;
          return (
            <View key={group} style={{ marginTop: 18 }}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{group}</Text>
              {rows.map((item) => (
                <ItemBlock
                  key={item.id}
                  item={item}
                  reaction={reactions[`${page.date}:${item.id}`]?.reaction ?? null}
                  note={note?.id === item.id ? note.text : null}
                  onReact={(next) => onReact(item, next)}
                  onOpen={() => setOpenItem(item)}
                />
              ))}
            </View>
          );
        })}
        {hasRecognized(prefs) ? null : (
          <Text style={{ color: theme.muted, marginTop: 20 }}>点标题旁的图标，之后的简报会跟着变。</Text>
        )}
      </ScrollView>
      <DetailModal item={openItem} onClose={() => setOpenItem(null)} />
    </View>
  );
}

function itemBlocks(item: BriefingItem): StoryBlock[] {
  if (item.blocks && item.blocks.length > 0) return item.blocks;
  const written = item.detail?.trim() || ITEM_DETAILS[item.id] || item.summary;
  return written.split(/\n+/).filter((line) => line.trim().length > 0).map((text) => ({ kind: "text", text }));
}

function SectionBody({ item }: { item: BriefingItem }) {
  const theme = useTheme();
  const blocks = itemBlocks(item);
  return (
    <View>
      {blocks.map((block, index) => {
        if (block.kind === "image") {
          const uri = mediaUri(block.url);
          if (!uri) return null;
          return <SectionImage key={`${item.id}-img-${index}`} uri={uri} />;
        }
        const previous = blocks[index - 1];
        const caption = previous?.kind === "image" && [...block.text].length <= 42;
        return (
          <Text
            key={`${item.id}-text-${index}`}
            style={{
              color: caption ? theme.muted : theme.text,
              fontSize: caption ? 14 : 17,
              lineHeight: caption ? 22 : 28,
              marginBottom: caption ? 16 : 14,
            }}
          >
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

function SectionImage({ uri }: { uri: string }) {
  const [ratio, setRatio] = useState(1.5);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    Image.getSize(
      uri,
      (width, height) => {
        if (alive && width > 0 && height > 0) setRatio(width / height);
      },
      () => {
        if (alive) setFailed(true);
      },
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      resizeMode="contain"
      onError={() => setFailed(true)}
      style={{ width: "100%", aspectRatio: ratio, borderRadius: 10, marginBottom: 12, backgroundColor: "transparent" }}
    />
  );
}

function ItemBlock({
  item,
  reaction,
  note,
  onReact,
  onOpen,
}: {
  item: BriefingItem;
  reaction: Reaction | null;
  note: string | null;
  onReact: (next: Reaction) => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.line, paddingVertical: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <Text style={{ flex: 1, color: theme.text, fontSize: 17, fontWeight: "700" }}>
          {item.no}  {item.title}
        </Text>
        <View style={{ flexDirection: "row" }}>
          <IconButton
            label="感兴趣"
            icon={reaction === "interested" ? "thumbs-up" : "thumbs-up-outline"}
            active={reaction === "interested"}
            tone="accent"
            onPress={() => onReact("interested")}
          />
          <IconButton
            label="不感兴趣"
            icon={reaction === "uninterested" ? "thumbs-down" : "thumbs-down-outline"}
            active={reaction === "uninterested"}
            tone="muted"
            onPress={() => onReact("uninterested")}
          />
        </View>
      </View>
      <Text style={{ color: theme.text, fontSize: 16, lineHeight: 24, marginTop: 8 }}>{item.summary}</Text>
      <Pressable onPress={onOpen} hitSlop={6} style={{ marginTop: 8, alignSelf: "flex-start" }}>
        <Text style={{ color: theme.accent, fontSize: 15 }}>查看详情</Text>
      </Pressable>
      {item.sourceUrl ? (
        <Pressable onPress={() => Linking.openURL(item.sourceUrl!)} hitSlop={6}>
          <Text style={{ color: theme.muted, marginTop: 6 }}>来源 · {item.sourceName}</Text>
        </Pressable>
      ) : (
        <Text style={{ color: theme.muted, marginTop: 6 }}>来源 · {item.sourceName}</Text>
      )}
      {note ? <Text style={{ color: theme.muted, marginTop: 6, fontSize: 13 }}>{note}</Text> : null}
    </View>
  );
}

function IconButton({
  label,
  icon,
  active,
  tone,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  tone: "accent" | "muted";
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = !active ? theme.muted : tone === "accent" ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? (tone === "accent" ? theme.chip : theme.line) : "transparent",
      }}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

function DetailModal({ item, onClose }: { item: BriefingItem | null; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="关闭详情" />
        {item ? (
          <View
            style={{
              width: "100%",
              maxWidth: 680,
              alignSelf: "center",
              maxHeight: "86%",
              backgroundColor: theme.card,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingTop: 12,
              paddingHorizontal: 18,
              paddingBottom: 28,
            }}
          >
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.line }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <Text style={{ flex: 1, color: theme.text, fontSize: 20, fontWeight: "700" }}>{item.title}</Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="关闭">
                <Ionicons name="close" size={22} color={theme.muted} />
              </Pressable>
            </View>
            <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ paddingBottom: 12 }}>
              <SectionBody item={item} />
              <Text style={{ color: theme.muted, marginTop: 8 }}>来源 · {item.sourceName}</Text>
              {item.sourceUrl ? (
                <Pressable onPress={() => Linking.openURL(item.sourceUrl!)} style={{ marginTop: 8 }}>
                  <Text style={{ color: theme.accent }}>打开原文</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
