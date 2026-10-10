import "package:characters/characters.dart";
import "package:flutter/material.dart";

const swatches = [
  Color(0xFF1F3A5F),
  Color(0xFF3E5C4B),
  Color(0xFF6B3A3A),
  Color(0xFF3F4A5A),
  Color(0xFF5C4A32),
  Color(0xFF3D4F5F),
];

Color swatchFor(String title) {
  var hash = 0;
  for (final char in title.runes) {
    hash = (hash + char) % swatches.length;
  }
  return swatches[hash];
}

String? assetFor(String? url) {
  if (url == null || url.isEmpty) return null;
  if (url.startsWith("/tugua/")) return "assets$url";
  return null;
}

class Cover extends StatelessWidget {
  const Cover({super.key, required this.title, required this.url, required this.width, required this.height, this.radius = 8});

  final String title;
  final String? url;
  final double width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final asset = assetFor(url);
    final letters = title.characters.take(2).string;
    final fallback = Container(
      width: width,
      height: height,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: swatchFor(title), borderRadius: BorderRadius.circular(radius)),
      child: Text(letters.isEmpty ? "日" : letters, style: TextStyle(color: Colors.white, fontSize: height > 100 ? 36 : 18, fontWeight: FontWeight.w600)),
    );
    if (asset != null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.asset(asset, width: width, height: height, fit: BoxFit.cover, errorBuilder: (_, __, ___) => fallback),
      );
    }
    if (url != null && url!.startsWith("http")) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Image.network(url!, width: width, height: height, fit: BoxFit.cover, errorBuilder: (_, __, ___) => fallback),
      );
    }
    return fallback;
  }
}

class StoryImage extends StatelessWidget {
  const StoryImage({super.key, required this.url});
  final String url;

  @override
  Widget build(BuildContext context) {
    final asset = assetFor(url);
    final image = asset != null
        ? Image.asset(asset, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const SizedBox.shrink())
        : url.startsWith("http")
            ? Image.network(url, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const SizedBox.shrink())
            : null;
    if (image == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ClipRRect(borderRadius: BorderRadius.circular(10), child: image),
    );
  }
}
