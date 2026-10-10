const domains = [
  "国际",
  "中国",
  "财经",
  "科技",
  "人工智能",
  "科学",
  "军事与冲突",
  "社会",
  "气候",
  "文化",
  "体育",
  "健康",
];

class StoryBlock {
  const StoryBlock.text(this.text) : kind = "text", url = null;
  const StoryBlock.image(this.url) : kind = "image", text = null;

  final String kind;
  final String? text;
  final String? url;

  factory StoryBlock.fromJson(Map<String, dynamic> json) {
    final kind = json["kind"] as String? ?? "text";
    if (kind == "image") return StoryBlock.image(json["url"] as String? ?? "");
    return StoryBlock.text(json["text"] as String? ?? "");
  }
}

class TagScore {
  TagScore({
    required this.kind,
    required this.name,
    required this.interest,
    required this.disinterest,
    required this.source,
  });

  final String kind;
  final String name;
  int interest;
  int disinterest;
  String source;

  TagScore copy() => TagScore(
        kind: kind,
        name: name,
        interest: interest,
        disinterest: disinterest,
        source: source,
      );

  Map<String, dynamic> toJson() => {
        "kind": kind,
        "name": name,
        "interest": interest,
        "disinterest": disinterest,
        "source": source,
      };

  factory TagScore.fromJson(Map<String, dynamic> json) => TagScore(
        kind: json["kind"] as String? ?? "topic",
        name: json["name"] as String? ?? "",
        interest: (json["interest"] as num?)?.toInt() ?? 0,
        disinterest: (json["disinterest"] as num?)?.toInt() ?? 0,
        source: json["source"] as String? ?? "auto",
      );
}

class PreferenceState {
  const PreferenceState(this.tags);
  final List<TagScore> tags;
  static const empty = PreferenceState([]);

  Map<String, dynamic> toJson() => {"tags": tags.map((tag) => tag.toJson()).toList()};

  factory PreferenceState.fromJson(Map<String, dynamic> json) {
    final raw = json["tags"];
    if (raw is! List) return PreferenceState.empty;
    return PreferenceState(
      raw.whereType<Map>().map((item) => TagScore.fromJson(Map<String, dynamic>.from(item))).toList(),
    );
  }
}

class StoredReaction {
  const StoredReaction({required this.reaction, required this.domains, required this.topic});
  final String reaction;
  final List<String> domains;
  final String topic;

  Map<String, dynamic> toJson() => {"reaction": reaction, "domains": domains, "topic": topic};

  factory StoredReaction.fromJson(Map<String, dynamic> json) => StoredReaction(
        reaction: json["reaction"] as String? ?? "interested",
        domains: (json["domains"] as List?)?.map((item) => item.toString()).toList() ?? const [],
        topic: json["topic"] as String? ?? "",
      );
}

class Candidate {
  const Candidate({
    required this.id,
    required this.title,
    required this.summary,
    required this.detail,
    required this.blocks,
    required this.domains,
    required this.topic,
    required this.sourceName,
    required this.sourceUrl,
    required this.heatSources,
    required this.inTugua,
    required this.isPublicEmergency,
    required this.heat,
    required this.imageUrl,
  });

  final String id;
  final String title;
  final String summary;
  final String detail;
  final List<StoryBlock> blocks;
  final List<String> domains;
  final String topic;
  final String sourceName;
  final String? sourceUrl;
  final List<String> heatSources;
  final bool inTugua;
  final bool isPublicEmergency;
  final int heat;
  final String? imageUrl;

  factory Candidate.fromJson(Map<String, dynamic> json) {
    final blocks = (json["blocks"] as List?)
            ?.whereType<Map>()
            .map((item) => StoryBlock.fromJson(Map<String, dynamic>.from(item)))
            .toList() ??
        const <StoryBlock>[];
    return Candidate(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "",
      summary: json["summary"] as String? ?? "",
      detail: json["detail"] as String? ?? "",
      blocks: blocks,
      domains: (json["domains"] as List?)?.map((item) => item.toString()).toList() ?? const [],
      topic: json["topic"] as String? ?? "",
      sourceName: json["sourceName"] as String? ?? "喷嚏图卦",
      sourceUrl: json["sourceUrl"] as String?,
      heatSources: (json["heatSources"] as List?)?.map((item) => item.toString()).toList() ?? const [],
      inTugua: json["inTugua"] as bool? ?? false,
      isPublicEmergency: json["isPublicEmergency"] as bool? ?? false,
      heat: (json["heat"] as num?)?.toInt() ?? 0,
      imageUrl: json["imageUrl"] as String?,
    );
  }
}

class BriefingItem extends Candidate {
  const BriefingItem({
    required super.id,
    required super.title,
    required super.summary,
    required super.detail,
    required super.blocks,
    required super.domains,
    required super.topic,
    required super.sourceName,
    required super.sourceUrl,
    required super.heatSources,
    required super.inTugua,
    required super.isPublicEmergency,
    required super.heat,
    required super.imageUrl,
    required this.no,
    required this.group,
  });

  final int no;
  final String group;

  factory BriefingItem.fromJson(Map<String, dynamic> json) {
    final base = Candidate.fromJson(json);
    return BriefingItem(
      id: base.id,
      title: base.title,
      summary: base.summary,
      detail: base.detail,
      blocks: base.blocks,
      domains: base.domains,
      topic: base.topic,
      sourceName: base.sourceName,
      sourceUrl: base.sourceUrl,
      heatSources: base.heatSources,
      inTugua: base.inTugua,
      isPublicEmergency: base.isPublicEmergency,
      heat: base.heat,
      imageUrl: base.imageUrl,
      no: (json["no"] as num?)?.toInt() ?? 0,
      group: json["group"] as String? ?? "今日要闻",
    );
  }

  factory BriefingItem.fromCandidate(Candidate item, {required int no, required String group}) {
    return BriefingItem(
      id: item.id,
      title: item.title,
      summary: item.summary,
      detail: item.detail,
      blocks: item.blocks,
      domains: item.domains,
      topic: item.topic,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      heatSources: item.heatSources,
      inTugua: item.inTugua,
      isPublicEmergency: item.isPublicEmergency,
      heat: item.heat,
      imageUrl: item.imageUrl,
      no: no,
      group: group,
    );
  }
}

class Briefing {
  const Briefing({
    required this.date,
    required this.title,
    required this.lede,
    required this.imageUrl,
    required this.generatedAt,
    required this.frozen,
    required this.items,
  });

  final String date;
  final String title;
  final String lede;
  final String? imageUrl;
  final String generatedAt;
  final bool frozen;
  final List<BriefingItem> items;

  factory Briefing.fromJson(Map<String, dynamic> json) => Briefing(
        date: json["date"] as String? ?? "",
        title: json["title"] as String? ?? "",
        lede: json["lede"] as String? ?? "",
        imageUrl: json["imageUrl"] as String?,
        generatedAt: json["generatedAt"] as String? ?? "",
        frozen: json["frozen"] as bool? ?? false,
        items: (json["items"] as List?)
                ?.whereType<Map>()
                .map((item) => BriefingItem.fromJson(Map<String, dynamic>.from(item)))
                .toList() ??
            const [],
      );
}

class CandidatePool {
  const CandidatePool({required this.date, required this.suggestedTitle, required this.items});
  final String date;
  final String? suggestedTitle;
  final List<Candidate> items;

  factory CandidatePool.fromJson(Map<String, dynamic> json) => CandidatePool(
        date: json["date"] as String? ?? "",
        suggestedTitle: json["suggestedTitle"] as String?,
        items: (json["items"] as List?)
                ?.whereType<Map>()
                .map((item) => Candidate.fromJson(Map<String, dynamic>.from(item)))
                .toList() ??
            const [],
      );
}

class Library {
  const Library({required this.briefings, required this.candidates});
  final List<Briefing> briefings;
  final List<CandidatePool> candidates;

  factory Library.fromJson(Map<String, dynamic> json) => Library(
        briefings: (json["briefings"] as List?)
                ?.whereType<Map>()
                .map((item) => Briefing.fromJson(Map<String, dynamic>.from(item)))
                .toList() ??
            const [],
        candidates: (json["candidates"] as List?)
                ?.whereType<Map>()
                .map((item) => CandidatePool.fromJson(Map<String, dynamic>.from(item)))
                .toList() ??
            const [],
      );
}
