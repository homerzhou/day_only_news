import "dart:convert";

import "package:characters/characters.dart";
import "package:flutter/widgets.dart";
import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";

import "logic.dart";
import "models.dart";

class AppState extends ChangeNotifier {
  AppState(this.bundled);

  static const _nicknameKey = "rijian.flutter.nickname";
  static const _prefsKey = "rijian.flutter.prefs";
  static const _reactionsKey = "rijian.flutter.reactions";
  static const _serverKey = "rijian.flutter.serverUrl";
  static const _libraryKey = "rijian.flutter.library";

  final Library bundled;
  bool ready = false;
  String nickname = "读者";
  PreferenceState prefs = PreferenceState.empty;
  Map<String, StoredReaction> reactions = {};
  String serverUrl = "";
  Library library = const Library(briefings: [], candidates: []);
  bool refreshing = false;
  String? loadError;

  List<Briefing> get briefings => buildBriefings(library, prefs);

  Future<void> load() async {
    library = bundled;
    final storage = await SharedPreferences.getInstance();
    nickname = storage.getString(_nicknameKey) ?? "读者";
    serverUrl = storage.getString(_serverKey) ?? "";
    final savedPrefs = storage.getString(_prefsKey);
    if (savedPrefs != null) {
      prefs = PreferenceState.fromJson(jsonDecode(savedPrefs) as Map<String, dynamic>);
    }
    final savedReactions = storage.getString(_reactionsKey);
    if (savedReactions != null) {
      final raw = jsonDecode(savedReactions) as Map<String, dynamic>;
      reactions = raw.map((key, value) => MapEntry(key, StoredReaction.fromJson(Map<String, dynamic>.from(value as Map))));
    }
    final savedLibrary = storage.getString(_libraryKey);
    if (savedLibrary != null) {
      final decoded = jsonDecode(savedLibrary) as Map<String, dynamic>;
      if (serverUrl.trim().isNotEmpty) _bindMedia(decoded, serverUrl.trim().replaceAll(RegExp(r"/+$"), ""));
      library = mergeLibrary(bundled, Library.fromJson(decoded));
    }
    ready = true;
    notifyListeners();
  }

  Future<void> setNickname(String value) async {
    final next = value.trim();
    nickname = next.isEmpty ? "读者" : next.charactersSafe(12);
    notifyListeners();
    final storage = await SharedPreferences.getInstance();
    await storage.setString(_nicknameKey, nickname);
  }

  Future<void> setServerUrl(String value) async {
    serverUrl = value.trim();
    notifyListeners();
    final storage = await SharedPreferences.getInstance();
    await storage.setString(_serverKey, serverUrl);
  }

  Future<void> _savePrefs() async {
    final storage = await SharedPreferences.getInstance();
    await storage.setString(_prefsKey, jsonEncode(prefs.toJson()));
    await storage.setString(_reactionsKey, jsonEncode(reactions.map((key, value) => MapEntry(key, value.toJson()))));
    final base = serverUrl.trim().replaceAll(RegExp(r"/+$"), "");
    if (base.isEmpty) return;
    try {
      await http.post(Uri.parse("$base/api/preferences"), headers: {"Content-Type": "application/json"}, body: jsonEncode(prefs.toJson()));
    } catch (_) {}
  }

  void setItemReaction(String date, BriefingItem item, String? next) {
    final key = "$date:${item.id}";
    final previous = reactions[key];
    if ((previous?.reaction) == next) return;
    prefs = applyReaction(
      prefs,
      previous,
      next == null ? null : StoredReaction(reaction: next, domains: item.domains, topic: item.topic),
    );
    if (next == null) {
      reactions.remove(key);
    } else {
      reactions[key] = StoredReaction(reaction: next, domains: item.domains, topic: item.topic);
    }
    notifyListeners();
    _savePrefs();
  }

  void removePreference(String kind, String name) {
    prefs = removeTag(prefs, kind, name);
    notifyListeners();
    _savePrefs();
  }

  void movePreference(String kind, String name, String side) {
    prefs = setManualTag(prefs, kind, name, side);
    notifyListeners();
    _savePrefs();
  }

  void addPreference(String kind, String name, String side) {
    prefs = setManualTag(prefs, kind, name, side);
    notifyListeners();
    _savePrefs();
  }

  Future<void> refresh() async {
    final base = serverUrl.trim().replaceAll(RegExp(r"/+$"), "");
    if (base.isEmpty) return;
    refreshing = true;
    notifyListeners();
    try {
      final response = await http.get(Uri.parse("$base/api/library"));
      if (response.statusCode >= 400) throw Exception("${response.statusCode}");
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      _bindMedia(decoded, base);
      final remote = Library.fromJson(decoded);
      library = mergeLibrary(bundled, remote);
      loadError = null;
      final storage = await SharedPreferences.getInstance();
      await storage.setString(_libraryKey, jsonEncode(decoded));
    } catch (_) {
      loadError = "暂时没刷新到，显示的是上次内容";
    } finally {
      refreshing = false;
      notifyListeners();
    }
  }
}

void _bindMedia(Map<String, dynamic> library, String base) {
  String? mapUrl(Object? url) {
    if (url is! String || !url.startsWith("/")) return url as String?;
    return "$base$url";
  }

  void walkItem(Map item) {
    if (item["imageUrl"] is String) item["imageUrl"] = mapUrl(item["imageUrl"]);
    final blocks = item["blocks"];
    if (blocks is! List) return;
    for (final block in blocks) {
      if (block is Map && block["kind"] == "image") block["url"] = mapUrl(block["url"]);
    }
  }

  for (final key in const ["briefings", "candidates"]) {
    final list = library[key];
    if (list is! List) continue;
    for (final entry in list) {
      if (entry is! Map) continue;
      if (entry["imageUrl"] is String) entry["imageUrl"] = mapUrl(entry["imageUrl"]);
      final items = entry["items"];
      if (items is! List) continue;
      for (final item in items) {
        if (item is Map) walkItem(item);
      }
    }
  }
}

extension on String {
  String charactersSafe(int max) {
    final chars = Characters(this);
    if (chars.length <= max) return this;
    return chars.take(max).string;
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({required AppState state, required super.child}) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, "AppScope missing");
    return scope!.notifier!;
  }
}
