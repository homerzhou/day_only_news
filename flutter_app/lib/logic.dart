import "package:characters/characters.dart";

import "models.dart";

bool isDomain(String name) => domains.contains(name);

String? rawSide(TagScore tag) {
  if (tag.interest > tag.disinterest) return "interested";
  if (tag.disinterest > tag.interest) return "uninterested";
  return null;
}

int _threshold(TagScore tag) {
  if (tag.source == "manual") return 1;
  return tag.kind == "topic" ? 1 : 3;
}

String? visibleSide(TagScore tag) {
  final side = rawSide(tag);
  if (side == null) return null;
  final count = side == "interested" ? tag.interest : tag.disinterest;
  return count >= _threshold(tag) ? side : null;
}

List<TagScore> visibleTags(PreferenceState state, String side) {
  return state.tags.where((tag) => visibleSide(tag) == side).toList();
}

bool hasRecognized(PreferenceState state) => state.tags.any((tag) => visibleSide(tag) != null);

class _NameSets {
  const _NameSets(this.domains, this.topics);
  final Set<String> domains;
  final Set<String> topics;
}

_NameSets recognizedNames(PreferenceState state, String side) {
  final domainNames = <String>{};
  final topicNames = <String>{};
  for (final tag in visibleTags(state, side)) {
    if (tag.kind == "domain") {
      domainNames.add(tag.name);
    } else {
      topicNames.add(tag.name);
    }
  }
  return _NameSets(domainNames, topicNames);
}

List<({String kind, String name})> _namesFor(List<String> itemDomains, String topic) {
  final list = <({String kind, String name})>[];
  for (final domain in itemDomains) {
    if (isDomain(domain)) list.add((kind: "domain", name: domain));
  }
  final trimmed = topic.trim();
  if (trimmed.isNotEmpty) list.add((kind: "topic", name: trimmed));
  return list;
}

void _bump(List<TagScore> tags, String kind, String name, String? previous, String? next) {
  var tag = tags.cast<TagScore?>().firstWhere(
        (item) => item!.kind == kind && item.name == name,
        orElse: () => null,
      );
  if (tag == null) {
    tag = TagScore(kind: kind, name: name, interest: 0, disinterest: 0, source: "auto");
    tags.add(tag);
  }
  final before = rawSide(tag);
  if (previous == "interested") tag.interest = tag.interest > 0 ? tag.interest - 1 : 0;
  if (previous == "uninterested") tag.disinterest = tag.disinterest > 0 ? tag.disinterest - 1 : 0;
  if (next == "interested") tag.interest += 1;
  if (next == "uninterested") tag.disinterest += 1;
  final after = rawSide(tag);
  if (tag.source == "manual" && before != null && after != null && before != after) {
    tag.source = "auto";
  }
}

PreferenceState applyReaction(
  PreferenceState state,
  StoredReaction? previous,
  StoredReaction? next,
) {
  final tags = state.tags.map((tag) => tag.copy()).toList();
  final touched = <String, ({String kind, String name})>{};
  for (final item in _namesFor(previous?.domains ?? const [], previous?.topic ?? "")) {
    touched["${item.kind}:${item.name}"] = item;
  }
  for (final item in _namesFor(next?.domains ?? const [], next?.topic ?? "")) {
    touched["${item.kind}:${item.name}"] = item;
  }
  for (final item in touched.values) {
    final prevHit = previous != null &&
            _namesFor(previous.domains, previous.topic).any((name) => name.kind == item.kind && name.name == item.name)
        ? previous.reaction
        : null;
    final nextHit = next != null &&
            _namesFor(next.domains, next.topic).any((name) => name.kind == item.kind && name.name == item.name)
        ? next.reaction
        : null;
    _bump(tags, item.kind, item.name, prevHit, nextHit);
  }
  return PreferenceState(tags.where((tag) => tag.interest > 0 || tag.disinterest > 0).toList());
}

PreferenceState removeTag(PreferenceState state, String kind, String name) {
  return PreferenceState(state.tags.where((tag) => !(tag.kind == kind && tag.name == name)).toList());
}

PreferenceState setManualTag(PreferenceState state, String kind, String name, String side) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return state;
  if (kind == "domain" && !isDomain(trimmed)) return state;
  final length = trimmed.characters.length;
  if (kind == "topic" && (length < 2 || length > 12)) return state;
  final tags = state.tags.where((tag) => !(tag.kind == kind && tag.name == trimmed)).toList();
  tags.add(TagScore(
    kind: kind,
    name: trimmed,
    interest: side == "interested" ? 1 : 0,
    disinterest: side == "uninterested" ? 1 : 0,
    source: "manual",
  ));
  return PreferenceState(tags);
}

int _byHeat(Candidate a, Candidate b) {
  final heat = b.heat.compareTo(a.heat);
  if (heat != 0) return heat;
  return a.id.compareTo(b.id);
}

String clampPhrase(String value) {
  final clean = value.replaceAll(RegExp(r"\s+"), "").trim();
  if (clean.characters.length <= 12) return clean;
  return clean.characters.take(12).string;
}

bool _topicHit(String text, String topic, Set<String> topics) {
  if (topics.contains(topic)) return true;
  for (final name in topics) {
    if (name.length >= 2 && (text.contains(name) || topic.contains(name))) return true;
  }
  return false;
}

bool _domainHit(List<String> itemDomains, Set<String> blocked) {
  return itemDomains.any(blocked.contains);
}

bool _isUnexpressed(Candidate item, Set<String> knownDomains, Set<String> knownTopics) {
  if (_topicHit(item.title, item.topic, knownTopics)) return false;
  if (_domainHit(item.domains, knownDomains)) return false;
  return true;
}

int _interestRank(Candidate item, Set<String> topics, Set<String> domains) {
  if (_topicHit(item.title, item.topic, topics)) return 0;
  if (_domainHit(item.domains, domains)) return 1;
  return 2;
}

Briefing assembleBriefing(CandidatePool pool, PreferenceState prefs, String generatedAt) {
  final liked = recognizedNames(prefs, "interested");
  final disliked = recognizedNames(prefs, "uninterested");
  final knownDomains = {...liked.domains, ...disliked.domains};
  final knownTopics = {...liked.topics, ...disliked.topics};
  final topicBlocked = (Candidate item) => _topicHit(item.title, item.topic, disliked.topics);
  final domainBlocked = (Candidate item) => _domainHit(item.domains, disliked.domains);
  final normal = pool.items.where((item) => !topicBlocked(item) && !domainBlocked(item)).toList()..sort(_byHeat);
  final exceptions = pool.items
      .where((item) => !topicBlocked(item) && domainBlocked(item) && item.isPublicEmergency)
      .toList()
    ..sort(_byHeat);

  List<Candidate> selectedHead;
  var selectedFocus = <Candidate>[];
  if (!hasRecognized(prefs)) {
    selectedHead = normal.take(12).toList();
  } else {
    selectedHead = normal.take(5).toList();
    final overall = [...normal, ...exceptions]..sort(_byHeat);
    final top = overall.take(5);
    Candidate? exception;
    for (final item in top) {
      if (exceptions.any((row) => row.id == item.id)) {
        exception = item;
        break;
      }
    }
    if (exception != null && !selectedHead.any((item) => item.id == exception!.id)) {
      selectedHead = [...selectedHead.take(4), exception]..sort(_byHeat);
    }
    final headIds = selectedHead.map((item) => item.id).toSet();
    final rest = normal.where((item) => !headIds.contains(item.id)).toList();
    final unexpressed = rest.where((item) => _isUnexpressed(item, knownDomains, knownTopics)).toList();
    final reserved = unexpressed.take(3).toList();
    final reservedIds = reserved.map((item) => item.id).toSet();
    final interested = rest.where((item) => !reservedIds.contains(item.id) && _interestRank(item, liked.topics, liked.domains) < 2).toList()
      ..sort((a, b) => _interestRank(a, liked.topics, liked.domains).compareTo(_interestRank(b, liked.topics, liked.domains)) != 0
          ? _interestRank(a, liked.topics, liked.domains).compareTo(_interestRank(b, liked.topics, liked.domains))
          : _byHeat(a, b));
    final focus = [...interested.take(7), ...reserved];
    if (focus.length < 10) {
      for (final item in unexpressed) {
        if (focus.length >= 10) break;
        if (!focus.any((row) => row.id == item.id)) focus.add(item);
      }
    }
    selectedFocus = focus.take(10).toList()
      ..sort((a, b) {
        final rank = _interestRank(a, liked.topics, liked.domains).compareTo(_interestRank(b, liked.topics, liked.domains));
        return rank != 0 ? rank : _byHeat(a, b);
      });
  }

  final ordered = [
    ...selectedHead.map((item) => (item: item, group: "今日要闻")),
    ...selectedFocus.map((item) => (item: item, group: "你的关注")),
  ];
  final items = [
    for (var index = 0; index < ordered.length; index++)
      BriefingItem.fromCandidate(ordered[index].item, no: index + 1, group: ordered[index].group),
  ];
  final leadPool = [...selectedHead, ...selectedFocus]..sort(_byHeat);
  final lead = leadPool.isEmpty ? null : leadPool.first;
  final suggested = pool.suggestedTitle?.trim() ?? "";
  final suggestedOk = suggested.characters.length >= 4 && suggested.characters.length <= 12;
  final title = suggestedOk ? suggested : clampPhrase(lead?.topic ?? lead?.title ?? "每日简报");
  final lede = items.take(3).map((item) => item.title).join("、");
  return Briefing(
    date: pool.date,
    title: title,
    lede: lede.characters.take(42).string,
    imageUrl: lead?.imageUrl,
    generatedAt: generatedAt,
    frozen: false,
    items: items,
  );
}

Library mergeLibrary(Library base, Library? extra) {
  if (extra == null) return base;
  final briefings = {for (final item in base.briefings) item.date: item};
  for (final item in extra.briefings) {
    briefings[item.date] = item;
  }
  final candidates = {for (final item in base.candidates) item.date: item};
  for (final item in extra.candidates) {
    if (!briefings.containsKey(item.date)) candidates[item.date] = item;
  }
  return Library(briefings: briefings.values.toList(), candidates: candidates.values.toList());
}

List<Briefing> buildBriefings(Library library, PreferenceState prefs) {
  final byDate = <String, Briefing>{};
  for (final briefing in library.briefings) {
    if (briefing.frozen) byDate[briefing.date] = briefing;
  }
  for (final pool in library.candidates) {
    byDate.putIfAbsent(pool.date, () => assembleBriefing(pool, prefs, "${pool.date}T13:30:00.000Z"));
  }
  final list = byDate.values.toList()..sort((a, b) => b.date.compareTo(a.date));
  return list;
}
