import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
            const Text(
              'velio',
              style: TextStyle(color: sunset, fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 32),
            Text('Got an invite?', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text('Enter the code or paste the link your friend sent you.', style: TextStyle(color: muted, fontSize: 16)),
            const SizedBox(height: 24),
            TextField(
              controller: _controller,
              autofocus: true,
              textCapitalization: TextCapitalization.characters,
              autocorrect: false,
              textInputAction: TextInputAction.go,
              onSubmitted: (_) => _submit(),
              style: const TextStyle(fontSize: 20, letterSpacing: 2, fontWeight: FontWeight.w600),
              decoration: InputDecoration(hintText: 'K7QM2XPA', errorText: _error, errorMaxLines: 2),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: _submit, child: const Text('Open invite')),
            if (recent.isNotEmpty) ...[
              const SizedBox(height: 40),
              const Text('Recent invites', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              for (final invite in recent)
                Card(
                  elevation: 0,
                  color: Colors.white,
                  child: ListTile(
                    title: Text(invite.activity.title),
                    subtitle: Text('From ${invite.inviterName}${widget.store.claimed(invite.code) ? ' · You’re in' : ''}'),
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
