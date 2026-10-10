import "package:flutter/material.dart";

import "app_state.dart";
import "format.dart";
import "widgets.dart";

class ListPage extends StatelessWidget {
  const ListPage({super.key, required this.onOpen});
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final theme = Theme.of(context);
    return RefreshIndicator(
      onRefresh: app.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
        children: [
          Text("每日简报", style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text("一天一份。点进去读编号短讯。", style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          if (app.loadError != null) ...[
            const SizedBox(height: 12),
            Text(app.loadError!, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          ],
          const SizedBox(height: 16),
          if (app.briefings.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 80),
              child: Center(child: Text("今天的简报还在整理")),
            )
          else
            for (final briefing in app.briefings)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Material(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(14),
                    onTap: () => onOpen(briefing.date),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(formatBriefingDate(briefing.date), style: TextStyle(color: theme.colorScheme.onSurfaceVariant, fontSize: 13)),
                                const SizedBox(height: 4),
                                Text(briefing.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text(briefing.lede, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: theme.colorScheme.onSurfaceVariant, fontSize: 14)),
                                if (!briefing.frozen)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text("未定稿 · 会随兴趣变化", style: TextStyle(color: theme.colorScheme.primary, fontSize: 12)),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Cover(title: briefing.title, url: briefing.imageUrl, width: 72, height: 72),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
