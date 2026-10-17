import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

const _apiUrlFromEnv = String.fromEnvironment('API_URL');
final apiUrl = _apiUrlFromEnv.isNotEmpty
    ? _apiUrlFromEnv
    : Platform.isAndroid
    ? 'http://10.0.2.2:4000'
    : 'http://localhost:4000';

class ApiException implements Exception {
  ApiException(this.code, this.message);

  final String code;
  final String message;

  bool get isOffline => code == 'offline';
}

class Activity {
  Activity.fromJson(Map<String, dynamic> json)
    : id = json['id'],
      title = json['title'],
      description = json['description'],
      startsAt = DateTime.parse(json['startsAt']).toLocal(),
      priceMinor = json['priceMinor'],
      currency = json['currency'],
      capacity = json['capacity'],
      spotsTaken = json['spotsTaken'],
      version = json['version'];

  Activity._withAvailability(Activity activity, this.spotsTaken, this.version)
    : id = activity.id,
      title = activity.title,
      description = activity.description,
      startsAt = activity.startsAt,
      priceMinor = activity.priceMinor,
      currency = activity.currency,
      capacity = activity.capacity;

  final String id;
  final String title;
  final String description;
  final DateTime startsAt;
  final int priceMinor;
  final String currency;
  final int capacity;
  final int spotsTaken;
  final int version;

  int get spotsLeft => capacity - spotsTaken;
  bool get started => !startsAt.isAfter(DateTime.now());

  Activity apply(AvailabilityEvent event) =>
      event.version > version ? Activity._withAvailability(this, event.spotsTaken, event.version) : this;

  Activity full() => Activity._withAvailability(this, capacity, version);
}

class Invite {
  Invite.fromJson(Map<String, dynamic> json)
    : code = json['code'],
      rail = json['rail'],
      recipient = json['recipient'],
      inviterName = json['inviterName'],
      used = json['used'],
      joined = json['joined'] == true,
      activity = Activity.fromJson(json['activity']);

  Invite._(Invite invite, {Activity? activity, bool? used, bool? joined})
    : code = invite.code,
      rail = invite.rail,
      recipient = invite.recipient,
      inviterName = invite.inviterName,
      used = used ?? invite.used,
      joined = joined ?? invite.joined,
      activity = activity ?? invite.activity;

  final String code;
  final String rail;
  final String? recipient;
  final String inviterName;
  final bool used;
  final bool joined;
  final Activity activity;

  bool get isVouch => rail == 'vouch';

  Invite copyWith({Activity? activity, bool? used, bool? joined}) =>
      Invite._(this, activity: activity, used: used, joined: joined);
}

class AvailabilityEvent {
  AvailabilityEvent.fromJson(Map<String, dynamic> json)
    : spotsTaken = json['spotsTaken'],
      version = json['version'];

  final int spotsTaken;
  final int version;
}

class Api {
  final _client = http.Client();

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    final http.Response response;
    try {
      response = await call().timeout(const Duration(seconds: 8));
    } on Exception {
      throw ApiException('offline', 'You’re offline. Check your connection and try again.');
    }
    final body = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) throw ApiException(body['error'], body['message']);
    return body;
  }

  Map<String, String> get _json => {'content-type': 'application/json'};

  String get _platform => Platform.isIOS ? 'ios' : 'android';

  Future<Map<String, dynamic>> getInvite(String code, String userId) =>
      _send(() => _client.get(Uri.parse('$apiUrl/invites/$code'), headers: {'x-user-id': userId}));

  Future<void> trackOpened(String code, String actorId) => _send(
    () => _client.post(
      Uri.parse('$apiUrl/events'),
      headers: _json,
      body: jsonEncode({'name': 'invite_opened', 'code': code, 'actorId': actorId, 'platform': _platform}),
    ),
  ).catchError((_) => <String, dynamic>{});

  Future<void> claim(String code, String userId, String name) => _send(
    () => _client.post(
      Uri.parse('$apiUrl/invites/$code/claim'),
      headers: _json,
      body: jsonEncode({'userId': userId, 'name': name}),
    ),
  );

  Stream<AvailabilityEvent> availability(String activityId, {required void Function() onOpen}) async* {
    final client = http.Client();
    try {
      final response = await client
          .send(http.Request('GET', Uri.parse('$apiUrl/stream?activityId=$activityId')))
          .timeout(const Duration(seconds: 8));
      onOpen();
      final lines = response.stream
          .timeout(const Duration(seconds: 30))
          .transform(utf8.decoder)
          .transform(const LineSplitter());
      await for (final line in lines) {
        if (line.startsWith('data: ')) yield AvailabilityEvent.fromJson(jsonDecode(line.substring(6)));
      }
    } finally {
      client.close();
    }
  }
}
