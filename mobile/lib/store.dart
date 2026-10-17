import 'dart:convert';
import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class Store {
  Store._(this._prefs);

  static Future<Store> open() async => Store._(await SharedPreferences.getInstance());

  final SharedPreferences _prefs;

  String get deviceId {
    final existing = _prefs.getString('deviceId');
    if (existing != null) return existing;
    final id = _uuid();
    _prefs.setString('deviceId', id);
    return id;
  }

  String? get name => _prefs.getString('name');
  set name(String value) => _prefs.setString('name', value);

  Map<String, dynamic>? cachedInvite(String code) {
    final raw = _prefs.getString('invite:$code');
    return raw == null ? null : jsonDecode(raw);
  }

  void saveInvite(Map<String, dynamic> json) {
    final code = json['code'] as String;
    _prefs.setString('invite:$code', jsonEncode(json));
    _prefs.setStringList('recentCodes', [code, ...recentCodes.where((recent) => recent != code)].take(5).toList());
  }

  List<String> get recentCodes => _prefs.getStringList('recentCodes') ?? [];

  bool claimed(String code) => _prefs.getBool('claimed:$code') ?? false;
  void markClaimed(String code) => _prefs.setBool('claimed:$code', true);
}

String _uuid() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
