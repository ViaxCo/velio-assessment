import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'api.dart';
import 'invite_screen.dart';
import 'main.dart';
import 'store.dart';

String? parseInviteCode(String input) {
  final afterPath = input.contains('/i/') ? input.split('/i/').last : input;
  final code = afterPath.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();
  return code.length == 8 ? code : null;
}

class EnterCodeScreen extends StatefulWidget {
  const EnterCodeScreen({super.key, required this.api, required this.store});

  final Api api;
  final Store store;

  @override
  State<EnterCodeScreen> createState() => _EnterCodeScreenState();
}

class _EnterCodeScreenState extends State<EnterCodeScreen> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _open(String code) async {
    HapticFeedback.selectionClick();
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => InviteScreen(code: code, api: widget.api, store: widget.store)),
    );
    setState(() {});
  }

  void _submit() {
    final code = parseInviteCode(_controller.text);
    if (code == null) {
      HapticFeedback.lightImpact();
      setState(() => _error = 'Invite codes have 8 letters and numbers, like K7QM2XPA.');
      return;
    }
    setState(() => _error = null);
    _open(code);
  }

  @override
  Widget build(BuildContext context) {
    final recent = widget.store.recentCodes
        .map((code) => widget.store.cachedInvite(code))
        .whereType<Map<String, dynamic>>()
        .map(Invite.fromJson)
        .toList();

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 24),
          children: [
            Align(alignment: Alignment.centerLeft, child: SvgPicture.asset('assets/logo.svg', height: 28)),
            const SizedBox(height: 40),
            Text('Got an invite?', style: display.copyWith(fontSize: 34)),
            const SizedBox(height: 10),
            const Text('Enter the code or paste the link your friend sent you.', style: TextStyle(color: muted, fontSize: 16, height: 1.4)),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              textInputAction: TextInputAction.go,
              onSubmitted: (_) => _submit(),
              style: const TextStyle(fontSize: 20, letterSpacing: 2, fontWeight: FontWeight.w700),
              decoration: InputDecoration(hintText: 'K7QM2XPA', errorText: _error, errorMaxLines: 2),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _submit, child: const Text('Open invite')),
            if (recent.isNotEmpty) ...[
              const SizedBox(height: 40),
              Text('Recent invites', style: display.copyWith(fontSize: 20)),
              const SizedBox(height: 12),
              for (final invite in recent)
                Card(
                  child: ListTile(
                    title: Text(invite.activity.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(
                      'From ${invite.inviterName}${invite.joined ? ' · You’re in' : ''}',
                      style: const TextStyle(color: muted),
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _open(invite.code),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
