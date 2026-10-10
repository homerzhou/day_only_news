import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { visibleTags } from "../shared/preferences";
import { DOMAINS, type Reaction, type TagKind, type TagScore } from "../shared/types";
import { useApp } from "../store";
import { useTheme } from "../theme";

export function ProfileScreen() {
  const theme = useTheme();
  const {
    nickname,
    setNickname,
    prefs,
    removePreference,
    movePreference,
    addPreference,
    serverUrl,
    setServerUrl,
  } = useApp();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(nickname);
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  useEffect(() => {
    setUrlDraft(serverUrl);
  }, [serverUrl]);
  const [editor, setEditor] = useState<null | { kind: TagKind; side: Reaction; text: string }>(null);
  const [editorError, setEditorError] = useState("");

  const interested = visibleTags(prefs, "interested");
  const uninterested = visibleTags(prefs, "uninterested");

  function commitName() {
    setNickname(nameDraft);
    setEditingName(false);
  }

  function openEditor(kind: TagKind) {
    setEditorError("");
    setEditor({ kind, side: "interested", text: "" });
  }

  function commitEditor() {
    if (!editor) return;
    const name = editor.text.trim();
    if (editor.kind === "topic" && ([...name].length < 2 || [...name].length > 12)) {
      setEditorError("主题用 2 到 12 个字");
      return;
    }
    if (editor.kind === "domain" && !name) {
      setEditorError("先选一个领域");
      return;
    }
    addPreference(editor.kind, name, editor.side);
    setEditor(null);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 28, fontWeight: "700", color: theme.text, marginBottom: 14 }}>我的</Text>
      <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: theme.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: theme.accentInk, fontSize: 20 }}>{[...nickname][0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          {editingName ? (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onSubmitEditing={commitName}
              autoFocus
              maxLength={12}
              style={{ color: theme.text, fontSize: 18, borderBottomWidth: 1, borderBottomColor: theme.line, paddingVertical: 4 }}
            />
          ) : (
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "700" }}>{nickname}</Text>
          )}
          <Text style={{ color: theme.muted, marginTop: 4 }}>读简报时点的兴趣会出现在下面</Text>
        </View>
        <Pressable
          onPress={() => {
            if (editingName) commitName();
            else {
              setNameDraft(nickname);
              setEditingName(true);
            }
          }}
        >
          <Text style={{ color: theme.accent }}>{editingName ? "完成" : "编辑"}</Text>
        </Pressable>
      </View>

      <TagGroup
        title="感兴趣"
        empty="还没有。在简报标题下点选后，会出现在这里。"
        tags={interested}
        onMove={(tag) => movePreference(tag.kind, tag.name, "uninterested")}
        onDelete={(tag) => removePreference(tag.kind, tag.name)}
        moveLabel="移到不感兴趣"
      />
      <TagGroup
        title="不感兴趣"
        empty="还没有。在简报标题下点选后，会出现在这里。"
        tags={uninterested}
        onMove={(tag) => movePreference(tag.kind, tag.name, "interested")}
        onDelete={(tag) => removePreference(tag.kind, tag.name)}
        moveLabel="移到感兴趣"
      />

      <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
        <Pressable onPress={() => openEditor("domain")} style={addButton(theme.card)}>
          <Text style={{ color: theme.accent }}>添加领域</Text>
        </Pressable>
        <Pressable onPress={() => openEditor("topic")} style={addButton(theme.card)}>
          <Text style={{ color: theme.accent }}>添加主题</Text>
        </Pressable>
      </View>
      <Text style={{ color: theme.muted, marginTop: 14 }}>这些会影响下一份简报。已经生成的日期保持原样。</Text>

      {editor ? (
        <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, marginTop: 16 }}>
          <Text style={{ color: theme.text, fontWeight: "700", marginBottom: 8 }}>
            {editor.kind === "domain" ? "添加领域" : "添加主题"}
          </Text>
          {editor.kind === "domain" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {DOMAINS.map((domain) => {
                const selected = editor.text === domain;
                return (
                  <Pressable
                    key={domain}
                    onPress={() => setEditor({ ...editor, text: domain })}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: selected ? theme.accent : theme.bg,
                    }}
                  >
                    <Text style={{ color: selected ? theme.accentInk : theme.text }}>{domain}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              value={editor.text}
              onChangeText={(text) => setEditor({ ...editor, text })}
              placeholder="2 到 12 个字"
              placeholderTextColor={theme.muted}
              style={{ color: theme.text, borderBottomWidth: 1, borderBottomColor: theme.line, paddingVertical: 8 }}
            />
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <SideButton label="放进感兴趣" active={editor.side === "interested"} onPress={() => setEditor({ ...editor, side: "interested" })} />
            <SideButton label="放进不感兴趣" active={editor.side === "uninterested"} onPress={() => setEditor({ ...editor, side: "uninterested" })} />
          </View>
          {editorError ? <Text style={{ color: "#8C3A3A", marginTop: 8 }}>{editorError}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 12 }}>
            <Pressable onPress={() => setEditor(null)}>
              <Text style={{ color: theme.muted }}>取消</Text>
            </Pressable>
            <Pressable onPress={commitEditor}>
              <Text style={{ color: theme.accent }}>添加</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Text style={{ color: theme.text, fontWeight: "700", marginTop: 28, marginBottom: 8 }}>简报服务</Text>
      <Text style={{ color: theme.muted, marginBottom: 8 }}>
        留空就用手机里已有的简报。填上电脑地址后，下拉列表会拉取新的一份，兴趣也会同步过去，给定稿用。
      </Text>
      <TextInput
        value={urlDraft}
        onChangeText={setUrlDraft}
        onEndEditing={() => setServerUrl(urlDraft)}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="http://10.0.88.174:8787"
        placeholderTextColor={theme.muted}
        style={{
          backgroundColor: theme.card,
          color: theme.text,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />
      <Text style={{ color: theme.muted, marginTop: 28 }}>日简 · 仅供个人阅读试用</Text>
    </ScrollView>
  );
}

function addButton(backgroundColor: string) {
  return {
    backgroundColor,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  };
}

function TagGroup({
  title,
  empty,
  tags,
  onMove,
  onDelete,
  moveLabel,
}: {
  title: string;
  empty: string;
  tags: TagScore[];
  onMove: (tag: TagScore) => void;
  onDelete: (tag: TagScore) => void;
  moveLabel: string;
}) {
  const theme = useTheme();
  const domains = tags.filter((tag) => tag.kind === "domain");
  const topics = tags.filter((tag) => tag.kind === "topic");
  return (
    <View style={{ marginTop: 22 }}>
      <Text style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}>{title}</Text>
      {tags.length === 0 ? <Text style={{ color: theme.muted, marginTop: 8 }}>{empty}</Text> : null}
      <TagList label="领域" tags={domains} onMove={onMove} onDelete={onDelete} moveLabel={moveLabel} />
      <TagList label="主题" tags={topics} onMove={onMove} onDelete={onDelete} moveLabel={moveLabel} />
    </View>
  );
}

function TagList({
  label,
  tags,
  onMove,
  onDelete,
  moveLabel,
}: {
  label: string;
  tags: TagScore[];
  onMove: (tag: TagScore) => void;
  onDelete: (tag: TagScore) => void;
  moveLabel: string;
}) {
  const theme = useTheme();
  if (tags.length === 0) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ color: theme.muted, marginBottom: 6 }}>{label}</Text>
      {tags.map((tag) => {
        const count = tag.interest > tag.disinterest ? tag.interest : tag.disinterest;
        const meta = tag.source === "manual" ? "手动" : `自动 · ${count} 次`;
        return (
          <View key={`${tag.kind}:${tag.name}`} style={{ backgroundColor: theme.card, borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: theme.text, fontSize: 16 }}>{tag.name}</Text>
            <Text style={{ color: theme.muted, marginTop: 2 }}>{meta}</Text>
            <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
              <Pressable onPress={() => onMove(tag)}>
                <Text style={{ color: theme.accent }}>{moveLabel}</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(tag)}>
                <Text style={{ color: theme.muted }}>删除</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SideButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? theme.accent : theme.bg,
      }}
    >
      <Text style={{ color: active ? theme.accentInk : theme.text }}>{label}</Text>
    </Pressable>
  );
}
