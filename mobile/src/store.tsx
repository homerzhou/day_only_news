import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { bundledLibrary } from "./data/library";
import { assembleBriefing } from "./shared/assemble";
import { applyReaction, removeTag, setManualTag } from "./shared/preferences";
import type {
  Briefing,
  Domain,
  Library,
  PreferenceState,
  Reaction,
  StoredReaction,
  StoryBlock,
  TagKind,
} from "./shared/types";
import { EMPTY_PREFS } from "./shared/types";

const KEYS = {
  nickname: "rijian.nickname",
  prefs: "rijian.prefs",
  reactions: "rijian.reactions",
  serverUrl: "rijian.serverUrl",
  library: "rijian.library.v3",
};

type AppContextValue = {
  ready: boolean;
  nickname: string;
  setNickname: (value: string) => void;
  prefs: PreferenceState;
  reactions: Record<string, StoredReaction>;
  setItemReaction: (
    date: string,
    item: { id: string; domains: Domain[]; topic: string },
    next: Reaction | null,
  ) => void;
  removePreference: (kind: TagKind, name: string) => void;
  movePreference: (kind: TagKind, name: string, side: Reaction) => void;
  addPreference: (kind: TagKind, name: string, side: Reaction) => void;
  serverUrl: string;
  setServerUrl: (value: string) => void;
  briefings: Briefing[];
  refreshing: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

function bindMedia(library: Library, base: string): Library {
  const mapUrl = (url?: string) => (url && url.startsWith("/") ? `${base}${url}` : url);
  const mapBlocks = (blocks?: StoryBlock[]) =>
    blocks?.map((block) => (block.kind === "image" ? { ...block, url: mapUrl(block.url) ?? "" } : block));
  return {
    briefings: library.briefings.map((briefing) => ({
      ...briefing,
      imageUrl: mapUrl(briefing.imageUrl),
      items: briefing.items.map((item) => ({ ...item, imageUrl: mapUrl(item.imageUrl), blocks: mapBlocks(item.blocks) })),
    })),
    candidates: library.candidates.map((pool) => ({
      ...pool,
      items: pool.items.map((item) => ({ ...item, imageUrl: mapUrl(item.imageUrl), blocks: mapBlocks(item.blocks) })),
    })),
  };
}

function mergeLibrary(base: Library, extra: Library | null): Library {
  if (!extra) return base;
  const briefings = new Map(base.briefings.map((item) => [item.date, item]));
  for (const item of extra.briefings) briefings.set(item.date, item);
  const candidates = new Map(base.candidates.map((item) => [item.date, item]));
  for (const item of extra.candidates) {
    if (!briefings.has(item.date)) candidates.set(item.date, item);
  }
  return {
    briefings: [...briefings.values()],
    candidates: [...candidates.values()],
  };
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [nickname, setNicknameState] = useState("读者");
  const [prefs, setPrefs] = useState<PreferenceState>(EMPTY_PREFS);
  const [reactions, setReactions] = useState<Record<string, StoredReaction>>({});
  const [serverUrl, setServerUrlState] = useState("");
  const [library, setLibrary] = useState<Library>(bundledLibrary);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedName, savedPrefs, savedReactions, savedUrl, savedLibrary] = await Promise.all([
        AsyncStorage.getItem(KEYS.nickname),
        readJson<PreferenceState>(KEYS.prefs),
        readJson<Record<string, StoredReaction>>(KEYS.reactions),
        AsyncStorage.getItem(KEYS.serverUrl),
        readJson<Library>(KEYS.library),
      ]);
      if (cancelled) return;
      if (savedName) setNicknameState(savedName);
      if (savedPrefs) setPrefs(savedPrefs);
      if (savedReactions) setReactions(savedReactions);
      if (savedUrl) setServerUrlState(savedUrl);
      const base = savedUrl?.trim().replace(/\/$/, "") ?? "";
      if (savedLibrary) setLibrary(mergeLibrary(bundledLibrary, base ? bindMedia(savedLibrary, base) : savedLibrary));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEYS.nickname, nickname).catch(() => undefined);
  }, [nickname, ready]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEYS.prefs, JSON.stringify(prefs)).catch(() => undefined);
    const base = serverUrl.trim().replace(/\/$/, "");
    if (!base) return;
    fetch(`${base}/api/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    }).catch(() => undefined);
  }, [prefs, ready, serverUrl]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(KEYS.reactions, JSON.stringify(reactions)).catch(() => undefined);
  }, [reactions, ready]);

  const briefings = useMemo(() => {
    const byDate = new Map<string, Briefing>();
    for (const briefing of library.briefings) {
      if (briefing.frozen) byDate.set(briefing.date, briefing);
    }
    for (const pool of library.candidates) {
      if (!byDate.has(pool.date)) {
        byDate.set(pool.date, assembleBriefing(pool, prefs, `${pool.date}T13:30:00.000Z`));
      }
    }
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [library, prefs]);

  async function refresh() {
    const base = serverUrl.trim().replace(/\/$/, "");
    if (!base) return;
    setRefreshing(true);
    try {
      const response = await fetch(`${base}/api/library`);
      if (!response.ok) throw new Error(String(response.status));
      const remote = bindMedia((await response.json()) as Library, base);
      const next = mergeLibrary(bundledLibrary, remote);
      setLibrary(next);
      setLoadError(null);
      await AsyncStorage.setItem(KEYS.library, JSON.stringify(remote));
    } catch {
      setLoadError("暂时没刷新到，显示的是上次内容");
    } finally {
      setRefreshing(false);
    }
  }

  function setNickname(value: string) {
    const next = value.trim().slice(0, 12);
    setNicknameState(next || "读者");
  }

  function setServerUrl(value: string) {
    const next = value.trim();
    setServerUrlState(next);
    AsyncStorage.setItem(KEYS.serverUrl, next).catch(() => undefined);
  }

  function setItemReaction(
    date: string,
    item: { id: string; domains: Domain[]; topic: string },
    next: Reaction | null,
  ) {
    const key = `${date}:${item.id}`;
    const previous = reactions[key] ?? null;
    if ((previous?.reaction ?? null) === next) return;
    setPrefs((current) =>
      applyReaction(
        current,
        previous,
        next ? { reaction: next, domains: item.domains, topic: item.topic } : null,
      ),
    );
    setReactions((current) => {
      const copy = { ...current };
      if (!next) delete copy[key];
      else copy[key] = { reaction: next, domains: item.domains, topic: item.topic };
      return copy;
    });
  }

  function removePreference(kind: TagKind, name: string) {
    setPrefs((current) => removeTag(current, kind, name));
  }

  function movePreference(kind: TagKind, name: string, side: Reaction) {
    setPrefs((current) => setManualTag(current, kind, name, side));
  }

  function addPreference(kind: TagKind, name: string, side: Reaction) {
    setPrefs((current) => setManualTag(current, kind, name, side));
  }

  const value: AppContextValue = {
    ready,
    nickname,
    setNickname,
    prefs,
    reactions,
    setItemReaction,
    removePreference,
    movePreference,
    addPreference,
    serverUrl,
    setServerUrl,
    briefings,
    refreshing,
    loadError,
    refresh,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppProvider missing");
  return value;
}
