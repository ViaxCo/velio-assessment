import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'format.dart';
import 'main.dart';
import 'store.dart';

class InviteScreen extends StatefulWidget {
  const InviteScreen({super.key, required this.code, required this.api, required this.store});

  final String code;
  final Api api;
  final Store store;

  @override
  State<InviteScreen> createState() => _InviteScreenState();
}

class _InviteScreenState extends State<InviteScreen> {
  late final _name = TextEditingController(text: widget.store.name);
  Invite? _invite;
  ApiException? _loadError;
  bool _offline = false;
  bool _claiming = false;
  ApiException? _claimError;
  bool _tracked = false;
  StreamSubscription<AvailabilityEvent>? _live;
  Timer? _retry;

  @override
  void initState() {
    super.initState();
    final cached = widget.store.cachedInvite(widget.code);
    if (cached != null) _invite = Invite.fromJson(cached);
    _connect();
  }

  @override
  void dispose() {
    _live?.cancel();
    _retry?.cancel();
    _name.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    _retry?.cancel();
    _live?.cancel();
    if (_invite == null && !await _load()) {
      if (_loadError?.isOffline ?? false) _retryLater();
      return;
    }
    if (!mounted) return;
    _live = widget.api.availability(_invite!.activity.id, onOpen: _load).listen(
      (event) => setState(() => _invite = _invite!.copyWith(activity: _invite!.activity.apply(event))),
      onError: (_) => _retryLater(),
      onDone: _retryLater,
      cancelOnError: true,
    );
  }

  void _retryLater() {
    if (_invite != null) setState(() => _offline = true);
    _retry?.cancel();
    _retry = Timer(const Duration(seconds: 3), () {
      if (mounted) _connect();
    });
  }

  Future<bool> _load() async {
    try {
      final json = await widget.api.getInvite(widget.code, widget.store.deviceId);
      widget.store.saveInvite(json);
      if (!mounted) return true;
      final fresh = Invite.fromJson(json);
      final current = _invite?.activity;
      setState(() {
        _invite = current != null && current.version > fresh.activity.version ? fresh.copyWith(activity: current) : fresh;
        _offline = false;
        _loadError = null;
      });
      if (!_tracked) {
        _tracked = true;
        widget.api.trackOpened(widget.code, widget.store.deviceId);
      }
      return true;
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _offline = error.isOffline && _invite != null;
          _loadError = _offline ? null : error;
        });
      }
      return false;
    }
  }

  Future<void> _claim() async {
    final name = _name.text.trim();
    if (name.isEmpty) return;
    HapticFeedback.selectionClick();
    setState(() {
      _claiming = true;
      _claimError = null;
    });
    try {
      await widget.api.claim(widget.code, widget.store.deviceId, name);
      widget.store.name = name;
      HapticFeedback.mediumImpact();
      _invite = _invite!.copyWith(joined: true);
      widget.store.saveInvite({...widget.store.cachedInvite(widget.code)!, 'joined': true});
      _load();
    } on ApiException catch (error) {
      HapticFeedback.heavyImpact();
      _claimError = error;
      if (error.code == 'sold_out') _invite = _invite!.copyWith(activity: _invite!.activity.full());
      if (error.code == 'invite_used') _invite = _invite!.copyWith(used: true);
    }
    if (mounted) setState(() => _claiming = false);
  }

  @override
  Widget build(BuildContext context) {
    final invite = _invite;
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: invite == null
            ? _loadError == null
                  ? const _Loading()
                  : _LoadFailed(error: _loadError!, onRetry: _connect)
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  children: staggered([
                    if (_offline) _OfflineBanner(onRetry: _load),
                    Text(invite.activity.title, style: display.copyWith(fontSize: 30)),
                    const SizedBox(height: 16),
                    _Detail(icon: Icons.calendar_today_outlined, text: formatDate(invite.activity.startsAt)),
                    const SizedBox(height: 10),
                    _Detail(
                      icon: Icons.confirmation_number_outlined,
                      text: formatPrice(invite.activity.priceMinor, invite.activity.currency),
                    ),
                    const SizedBox(height: 16),
                    Align(alignment: Alignment.centerLeft, child: _SpotsPill(spotsLeft: invite.activity.spotsLeft)),
                    if (invite.activity.description.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(invite.activity.description, style: const TextStyle(color: muted, fontSize: 16, height: 1.45)),
                    ],
                    const SizedBox(height: 20),
                    _InvitedBy(invite: invite),
                    const SizedBox(height: 24),
                    _claimPanel(invite),
                  ]),
                ),
              ),
      ),
    );
  }

  Widget _claimPanel(Invite invite) {
    final activity = invite.activity;
    if (invite.joined) {
      return _Notice(
        color: lime,
        icon: Icons.check_circle,
        title: 'You’re in the plan!',
        body: '${invite.inviterName} will see you’ve joined. See you on ${formatDate(activity.startsAt)}.',
      );
    }
    if (_claimError?.code == 'sold_out') {
      return _Notice(
        color: alert,
        icon: Icons.sentiment_dissatisfied,
        title: 'So close. The last spot just went.',
        body: 'We didn’t book you. Ask ${invite.inviterName} what’s next.',
      );
    }
    if (invite.used) {
      return _Notice(
        color: muted,
        icon: Icons.link_off,
        title: 'This personal invite has already been used',
        body: 'Ask ${invite.inviterName} to send you a new one.',
      );
    }
    if (activity.started) {
      return const _Notice(color: muted, icon: Icons.schedule, title: 'This activity has already started');
    }
    if (activity.spotsLeft == 0) {
      return _Notice(
        color: muted,
        icon: Icons.event_busy,
        title: 'This one filled up before you got here',
        body: 'Ask ${invite.inviterName} about the next one.',
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_claimError != null) ...[
          _Notice(color: alert, icon: Icons.error_outline, title: 'We couldn’t claim your spot', body: _claimError!.message),
          const SizedBox(height: 12),
        ],
        TextField(
          controller: _name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.done,
          autofillHints: const [AutofillHints.givenName],
          onSubmitted: (_) => _claim(),
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Your first name'),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _claiming || _name.text.trim().isEmpty ? null : _claim,
          child: _claiming
              ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: ink))
              : Text('Claim my spot · ${formatPrice(activity.priceMinor, activity.currency)}'),
        ),
        const SizedBox(height: 8),
        const Text('You won’t be charged in this prototype.', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 12)),
      ],
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: muted),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: const TextStyle(color: muted, fontSize: 16, fontWeight: FontWeight.w500))),
      ],
    );
  }
}

class _SpotsPill extends StatelessWidget {
  const _SpotsPill({required this.spotsLeft});

  final int spotsLeft;

  @override
  Widget build(BuildContext context) {
    final color = spotsLeft == 0 ? muted : spotsLeft <= 3 ? alert : lime;
    final label = spotsLeft == 0 ? 'Full' : spotsLeft == 1 ? 'Last spot' : '$spotsLeft spots left';
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
      child: Container(
        key: ValueKey(label),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

class _InvitedBy extends StatelessWidget {
  const _InvitedBy({required this.invite});

  final Invite invite;

  @override
  Widget build(BuildContext context) {
    final recipient = invite.recipient == null ? '' : ', ${invite.recipient}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(color: lime, shape: BoxShape.circle),
            child: Text(invite.inviterName.substring(0, 1).toUpperCase(), style: display.copyWith(fontSize: 18)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invite.isVouch ? '${invite.inviterName} vouched for you$recipient' : '${invite.inviterName} invited you',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  invite.isVouch ? 'A vouch means they stand behind you.' : 'Anyone with this link can join.',
                  style: const TextStyle(color: muted, fontSize: 14),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.color, required this.icon, required this.title, this.body});

  final Color color;
  final IconData icon;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                if (body != null) ...[const SizedBox(height: 4), Text(body!, style: const TextStyle(color: muted))],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          leading: const Icon(Icons.cloud_off, color: muted),
          title: const Text('You’re offline', style: TextStyle(fontWeight: FontWeight.w700)),
          subtitle: const Text('Showing details saved on this phone.', style: TextStyle(color: muted)),
          trailing: TextButton(onPressed: onRetry, style: TextButton.styleFrom(foregroundColor: ink), child: const Text('Retry')),
        ),
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    Widget block(double height) => Container(
      height: height,
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
    );
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(children: [block(32), block(140), block(52)]),
    );
  }
}

class _LoadFailed extends StatelessWidget {
  const _LoadFailed({required this.error, required this.onRetry});

  final ApiException error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final notFound = error.code == 'invite_not_found';
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Notice(
            color: alert,
            icon: notFound ? Icons.search_off : Icons.cloud_off,
            title: notFound ? 'We couldn’t find that invite' : 'We couldn’t load this invite',
            body: notFound ? 'Check the code with the friend who sent it.' : error.message,
          ),
          const SizedBox(height: 16),
          notFound
              ? FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Enter another code'))
              : FilledButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
