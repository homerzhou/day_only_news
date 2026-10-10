import "package:characters/characters.dart";
import "package:flutter/material.dart";
import "package:share_plus/share_plus.dart";
import "package:url_launcher/url_launcher.dart";

import "app_state.dart";
import "format.dart";
import "logic.dart";
import "models.dart";
import "widgets.dart";

class DetailPage extends StatefulWidget {
  const DetailPage({super.key, required this.date, required this.onBack});
  final String date;
  final VoidCallback onBack;

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  Briefing? _page;
  String? _noteId;
  String? _noteText;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _page ??= AppScope.of(context).briefings.cast<Briefing?>().firstWhere(
          (item) => item?.date == widget.date,
          orElse: () => null,
        );
  }

  void _react(BriefingItem item, String next) {
    final app = AppScope.of(context);
    final key = "${widget.date}:${item.id}";
    final current = app.reactions[key]?.reaction;
    final resolved = current == next ? null : next;
    app.setItemReaction(widget.date, item, resolved);
    setState(() {
      _noteId = item.id;
      if (resolved == null) {
        _noteText = "已取消";
      } else {
        _noteText = "已记入主题「${item.topic}」、领域「${item.domains.join("」「")}」";
      }
    });
    Future<void>.delayed(const Duration(seconds: 2), () {
      if (mounted && _noteId == item.id) setState(() => _noteText = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final page = _page;
    final theme = Theme.of(context);
    final app = AppScope.of(context);
    if (page == null) {
      return const Center(child: Text("没有这份简报"));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            TextButton(onPressed: widget.onBack, child: const Text("返回")),
            TextButton(
              onPressed: () => Share.share("${formatBriefingDate(page.date)} ${page.title}"),
              child: const Text("分享"),
            ),
          ],
        ),
        Text(formatBriefingDate(page.date), style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 4),
        Text(page.title, style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) => Cover(title: page.title, url: page.imageUrl, width: constraints.maxWidth, height: 180, radius: 12),
        ),
        const SizedBox(height: 12),
        Text("共 ${page.items.length} 条", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
        if (!page.frozen)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text("未定稿。点图标后，返回列表会按新的兴趣重排这一份。", style: TextStyle(color: theme.colorScheme.primary)),
          ),
        for (final group in const ["今日要闻", "你的关注"])
          if (page.items.any((item) => item.group == group)) ...[
            const SizedBox(height: 18),
            Text(group, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            for (final item in page.items.where((item) => item.group == group))
              _ItemBlock(
                item: item,
                reaction: app.reactions["${page.date}:${item.id}"]?.reaction,
                note: _noteId == item.id ? _noteText : null,
                onReact: (next) => _react(item, next),
                onOpen: () => _openSection(context, item),
              ),
          ],
        if (!hasRecognized(app.prefs))
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: Text("点标题旁的图标，之后的简报会跟着变。", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          ),
      ],
    );
  }

  void _openSection(BuildContext context, BriefingItem item) {
    final theme = Theme.of(context);
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: theme.colorScheme.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) {
        final blocks = item.blocks.isNotEmpty
            ? item.blocks
            : item.detail.split(RegExp(r"\n+")).where((line) => line.trim().isNotEmpty).map(StoryBlock.text).toList();
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.72,
          maxChildSize: 0.92,
          minChildSize: 0.4,
          builder: (context, controller) {
            return ListView(
              controller: controller,
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
              children: [
                Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: theme.dividerColor, borderRadius: BorderRadius.circular(2)))),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: Text(item.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
                    IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                  ],
                ),
                const SizedBox(height: 8),
                for (var index = 0; index < blocks.length; index++)
                  if (blocks[index].kind == "image" && (blocks[index].url ?? "").isNotEmpty)
                    StoryImage(url: blocks[index].url!)
                  else if (blocks[index].kind == "text")
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Text(
                        blocks[index].text ?? "",
                        style: TextStyle(
                          fontSize: index > 0 && blocks[index - 1].kind == "image" && (blocks[index].text ?? "").characters.length <= 42 ? 14 : 17,
                          height: 1.6,
                          color: index > 0 && blocks[index - 1].kind == "image" && (blocks[index].text ?? "").characters.length <= 42
                              ? theme.colorScheme.onSurfaceVariant
                              : theme.colorScheme.onSurface,
                        ),
                      ),
                    ),
                const SizedBox(height: 8),
                Text("来源 · ${item.sourceName}", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
                if (item.sourceUrl != null)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => launchUrl(Uri.parse(item.sourceUrl!), mode: LaunchMode.externalApplication),
                      child: const Text("打开原文"),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

class _ItemBlock extends StatelessWidget {
  const _ItemBlock({required this.item, required this.reaction, required this.note, required this.onReact, required this.onOpen});

  final BriefingItem item;
  final String? reaction;
  final String? note;
  final ValueChanged<String> onReact;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: theme.dividerColor))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text("${item.no}  ${item.title}", style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
              IconButton(
                tooltip: "感兴趣",
                onPressed: () => onReact("interested"),
                icon: Icon(reaction == "interested" ? Icons.thumb_up : Icons.thumb_up_outlined, color: reaction == "interested" ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant),
              ),
              IconButton(
                tooltip: "不感兴趣",
                onPressed: () => onReact("uninterested"),
                icon: Icon(reaction == "uninterested" ? Icons.thumb_down : Icons.thumb_down_outlined),
              ),
            ],
          ),
          Text(item.summary, style: const TextStyle(fontSize: 16, height: 1.5)),
          TextButton(onPressed: onOpen, style: TextButton.styleFrom(padding: EdgeInsets.zero), child: const Text("查看详情")),
          if (item.sourceUrl != null)
            GestureDetector(
              onTap: () => launchUrl(Uri.parse(item.sourceUrl!), mode: LaunchMode.externalApplication),
              child: Text("来源 · ${item.sourceName}", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
            )
          else
            Text("来源 · ${item.sourceName}", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          if (note != null) ...[
            const SizedBox(height: 6),
            Text(note!, style: TextStyle(color: theme.colorScheme.onSurfaceVariant, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}
