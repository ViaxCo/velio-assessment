import 'package:flutter/material.dart';

import 'api.dart';
import 'enter_code_screen.dart';
import 'store.dart';

const ink = Color(0xFF173600);
const muted = Color(0x80173600);
const canvas = Color(0xFFF5F3EC);
const lime = Color(0xFF97E565);
const alert = Color(0xFFB3261E);
const display = TextStyle(fontFamily: 'Nohemi', fontWeight: FontWeight.w500, height: 1.1);

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
        inputDecorationTheme: InputDecorationTheme(
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
