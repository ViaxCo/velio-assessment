import 'package:flutter/material.dart';

import 'api.dart';
import 'enter_code_screen.dart';
import 'store.dart';

const sunset = Color(0xFFE8552D);
const lagoon = Color(0xFF0F766E);
const canvas = Color(0xFFFBF8F4);
const muted = Color(0xFF78716C);

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
    return MaterialApp(
      title: 'Velio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: sunset, primary: sunset, surface: canvas),
        scaffoldBackgroundColor: canvas,
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
        ),
      ),
      home: EnterCodeScreen(api: api, store: store),
    );
  }
}
