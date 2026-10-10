import "dart:convert";

import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "app_state.dart";
import "detail_page.dart";
import "list_page.dart";
import "models.dart";
import "profile_page.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final raw = await rootBundle.loadString("assets/tugua-library.json");
  final bundled = Library.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  final state = AppState(bundled);
  await state.load();
  runApp(RijianApp(state: state));
}

class RijianApp extends StatefulWidget {
  const RijianApp({super.key, required this.state});
  final AppState state;

  @override
  State<RijianApp> createState() => _RijianAppState();
}

class _RijianAppState extends State<RijianApp> {
  int _tab = 0;
  String? _date;

  @override
  Widget build(BuildContext context) {
    final detail = _date;
    return AppScope(
      state: widget.state,
      child: MaterialApp(
        title: "日简",
        debugShowCheckedModeBanner: false,
        theme: _theme(Brightness.light),
        darkTheme: _theme(Brightness.dark),
        home: Scaffold(
          body: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 680),
                child: detail != null
                    ? DetailPage(date: detail, onBack: () => setState(() => _date = null))
                    : IndexedStack(
                        index: _tab,
                        children: [
                          ListPage(onOpen: (date) => setState(() => _date = date)),
                          const ProfilePage(),
                        ],
                      ),
              ),
            ),
          ),
          bottomNavigationBar: detail != null
              ? null
              : NavigationBar(
                  selectedIndex: _tab,
                  onDestinationSelected: (index) => setState(() => _tab = index),
                  destinations: const [
                    NavigationDestination(icon: Icon(Icons.article_outlined), label: "每日简报"),
                    NavigationDestination(icon: Icon(Icons.person_outline), label: "我的"),
                  ],
                ),
        ),
      ),
    );
  }
}

ThemeData _theme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme(
    brightness: brightness,
    primary: const Color(0xFF1F3A5F),
    onPrimary: Colors.white,
    secondary: const Color(0xFF3E5C4B),
    onSecondary: Colors.white,
    error: const Color(0xFF8C3A3A),
    onError: Colors.white,
    surface: dark ? const Color(0xFF24221E) : Colors.white,
    onSurface: dark ? const Color(0xFFF3F1EC) : const Color(0xFF1C1A17),
    onSurfaceVariant: dark ? const Color(0xFFB7B1A6) : const Color(0xFF6E6A62),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? const Color(0xFF171614) : const Color(0xFFF3F1EC),
    dividerColor: dark ? const Color(0xFF3A372F) : const Color(0xFFE4E0D8),
  );
}
