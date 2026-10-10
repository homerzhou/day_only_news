import "package:characters/characters.dart";
import "package:flutter/material.dart";

import "app_state.dart";
import "logic.dart";
import "models.dart";

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final TextEditingController _name = TextEditingController();
  final TextEditingController _server = TextEditingController();
  final TextEditingController _topic = TextEditingController();
  String _domain = domains.first;
  bool _filled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_filled) return;
    final app = AppScope.of(context);
    _name.text = app.nickname;
    _server.text = app.serverUrl;
    _filled = true;
  }

  @override
  void dispose() {
    _name.dispose();
    _server.dispose();
    _topic.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    final liked = visibleTags(app.prefs, "interested");
    final disliked = visibleTags(app.prefs, "uninterested");
    final likedDomains = liked.where((tag) => tag.kind == "domain").toList();
    final likedTopics = liked.where((tag) => tag.kind == "topic").toList();
    final dislikedDomains = disliked.where((tag) => tag.kind == "domain").toList();
    final dislikedTopics = disliked.where((tag) => tag.kind == "topic").toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Text("我的", style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 14),
        Text("称呼", style: const TextStyle(fontWeight: FontWeight.w700)),
        TextField(
          controller: _name,
          maxLength: 12,
          decoration: const InputDecoration(hintText: "读者"),
          onSubmitted: app.setNickname,
        ),
        const SizedBox(height: 8),
        Text("兴趣不是在这里勾选的。读简报时点图标，主题出现一次就记下，领域要连续三次。", style: TextStyle(color: theme.colorScheme.onSurfaceVariant, height: 1.5)),
        const SizedBox(height: 18),
        _Group(
          title: "感兴趣的主题",
          empty: "还没有",
          tags: likedTopics,
          onDelete: (tag) => app.removePreference(tag.kind, tag.name),
          onMove: (tag) => app.movePreference(tag.kind, tag.name, "uninterested"),
          moveLabel: "改为不感兴趣",
        ),
        _Group(
          title: "不感兴趣的主题",
          empty: "还没有",
          tags: dislikedTopics,
          onDelete: (tag) => app.removePreference(tag.kind, tag.name),
          onMove: (tag) => app.movePreference(tag.kind, tag.name, "interested"),
          moveLabel: "改为感兴趣",
        ),
        _Group(
          title: "感兴趣的领域",
          empty: "还没有",
          tags: likedDomains,
          onDelete: (tag) => app.removePreference(tag.kind, tag.name),
          onMove: (tag) => app.movePreference(tag.kind, tag.name, "uninterested"),
          moveLabel: "改为不感兴趣",
        ),
        _Group(
          title: "不感兴趣的领域",
          empty: "还没有",
          tags: dislikedDomains,
          onDelete: (tag) => app.removePreference(tag.kind, tag.name),
          onMove: (tag) => app.movePreference(tag.kind, tag.name, "interested"),
          moveLabel: "改为感兴趣",
        ),
        const SizedBox(height: 8),
        Text("手动添加", style: const TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        DropdownButton<String>(
          value: _domain,
          isExpanded: true,
          items: [for (final name in domains) DropdownMenuItem(value: name, child: Text(name))],
          onChanged: (value) => setState(() => _domain = value ?? domains.first),
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton(onPressed: () => app.addPreference("domain", _domain, "interested"), child: const Text("领域感兴趣")),
            OutlinedButton(onPressed: () => app.addPreference("domain", _domain, "uninterested"), child: const Text("领域不感兴趣")),
          ],
        ),
        TextField(
          controller: _topic,
          decoration: const InputDecoration(hintText: "主题，2到12个字"),
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton(
              onPressed: () {
                final name = _topic.text.trim();
                final length = name.characters.length;
                if (length < 2 || length > 12) return;
                app.addPreference("topic", name, "interested");
                _topic.clear();
              },
              child: const Text("主题感兴趣"),
            ),
            OutlinedButton(
              onPressed: () {
                final name = _topic.text.trim();
                final length = name.characters.length;
                if (length < 2 || length > 12) return;
                app.addPreference("topic", name, "uninterested");
                _topic.clear();
              },
              child: const Text("主题不感兴趣"),
            ),
          ],
        ),
        const SizedBox(height: 22),
        Text("数据服务", style: const TextStyle(fontWeight: FontWeight.w700)),
        Text("填 Vercel 上的地址后，下拉简报列表即可更新。不填也能看已经带在安装包里的图卦。", style: TextStyle(color: theme.colorScheme.onSurfaceVariant, height: 1.5)),
        TextField(
          controller: _server,
          decoration: const InputDecoration(hintText: "https://你的项目.vercel.app"),
          onSubmitted: app.setServerUrl,
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: app.refreshing
              ? null
              : () async {
                  await app.setServerUrl(_server.text);
                  await app.refresh();
                },
          child: Text(app.refreshing ? "正在更新" : "现在更新"),
        ),
        if (app.loadError != null) Text(app.loadError!, style: TextStyle(color: theme.colorScheme.error)),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({required this.title, required this.empty, required this.tags, required this.onDelete, required this.onMove, required this.moveLabel});

  final String title;
  final String empty;
  final List<TagScore> tags;
  final ValueChanged<TagScore> onDelete;
  final ValueChanged<TagScore> onMove;
  final String moveLabel;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (tags.isEmpty)
            Text(empty, style: TextStyle(color: theme.colorScheme.onSurfaceVariant))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final tag in tags)
                  Chip(
                    label: Text(tag.name),
                    onDeleted: () => onDelete(tag),
                    deleteIcon: const Icon(Icons.close, size: 16),
                  ),
              ],
            ),
          if (tags.isNotEmpty)
            Wrap(
              spacing: 8,
              children: [for (final tag in tags) TextButton(onPressed: () => onMove(tag), child: Text("$moveLabel ${tag.name}"))],
            ),
        ],
      ),
    );
  }
}
