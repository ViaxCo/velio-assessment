import 'package:flutter/material.dart';

import 'api.dart';
import 'enter_code_screen.dart';
import 'store.dart';

const ink = Color(0xFF173600);
const muted = Color(0x80173600);
const canvas = Color(0xFFF5F3EC);
const lime = Color(0xFF97E565);
const limeSoft = Color(0xFFD9F0C4);
const alert = Color(0xFFB3261E);
const alertSoft = Color(0xFFFBE4DF);
const haze = Color(0x0D173600);
const display = TextStyle(fontFamily: 'Nohemi', fontWeight: FontWeight.w500, height: 1.1);
const soft = Cubic(0.22, 1, 0.36, 1);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = await Store.open();
  runApp(VelioGuestApp(api: Api(), store: store));
}

class VelioGuestApp extends StatelessWidget {
  const VelioGuestApp({super.key, required this.api, required this.store});

  final Api api;
  final Store store;

  @override
  Widget build(BuildContext context) {
    InputBorder field(BorderSide side) => OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: side);
    return MaterialApp(
      title: 'Velio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        fontFamily: 'Satoshi',
        colorScheme: ColorScheme.fromSeed(
          seedColor: lime,
          primary: lime,
          onPrimary: ink,
          surface: canvas,
          onSurface: ink,
          error: alert,
        ),
        scaffoldBackgroundColor: canvas,
        appBarTheme: const AppBarTheme(backgroundColor: canvas, surfaceTintColor: Colors.transparent, scrolledUnderElevation: 0),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          clipBehavior: Clip.antiAlias,
          margin: const EdgeInsets.only(bottom: 8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(56),
            backgroundColor: lime,
            foregroundColor: ink,
            disabledBackgroundColor: lime.withValues(alpha: 0.4),
            disabledForegroundColor: ink.withValues(alpha: 0.4),
            textStyle: const TextStyle(fontFamily: 'Satoshi', fontSize: 16, fontWeight: FontWeight.w500),
          ),
        ),
        textSelectionTheme: const TextSelectionThemeData(cursorColor: ink),
        inputDecorationTheme: InputDecorationTheme(
          floatingLabelStyle: const TextStyle(color: ink),
          filled: true,
          fillColor: Colors.white,
          enabledBorder: field(BorderSide.none),
          focusedBorder: field(const BorderSide(color: ink, width: 1.5)),
          errorBorder: field(const BorderSide(color: alert)),
          focusedErrorBorder: field(const BorderSide(color: alert, width: 1.5)),
        ),
      ),
      home: EnterCodeScreen(api: api, store: store),
    );
  }
}

List<Widget> staggered(List<Widget> children) => [
  for (final (index, child) in children.indexed) Rise(delay: Duration(milliseconds: 60 * index.clamp(0, 4)), child: child),
];

class Rise extends StatelessWidget {
  const Rise({super.key, this.delay = Duration.zero, required this.child});

  final Duration delay;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final total = delay + const Duration(milliseconds: 700);
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(delay.inMilliseconds / total.inMilliseconds, 1, curve: Curves.fastOutSlowIn),
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.translate(offset: Offset(0, 20 * (1 - t)), child: child),
      ),
      child: child,
    );
  }
}

class PressScale extends StatefulWidget {
  const PressScale({super.key, this.scale = 0.95, required this.child});

  final double scale;
  final Widget child;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;

  void _press(bool down) => setState(() => _down = down);

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _press(true),
      onPointerUp: (_) => _press(false),
      onPointerCancel: (_) => _press(false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 300),
        curve: soft,
        child: widget.child,
      ),
    );
  }
}
