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
      appBar: AppBar(backgroundColor: canvas, surfaceTintColor: Colors.transparent),
      body: SafeArea(
        child: invite == null
            ? _loadError == null
                  ? const _Loading()
                  : _LoadFailed(error: _loadError!, onRetry: _connect)
            : RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
                  children: [
                    if (_offline) _OfflineBanner(onRetry: _load),
                    _Headline(invite: invite),
                    const SizedBox(height: 16),
                    _ActivityCard(activity: invite.activity),
                    const SizedBox(height: 16),
                    _claimPanel(invite),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _claimPanel(Invite invite) {
    final activity = invite.activity;
    if (invite.joined) {
      return _Notice(
        color: lagoon,
        icon: Icons.check_circle,
        title: 'You’re in the plan!',
        body: '${invite.inviterName} will see you’ve joined. See you on ${formatDate(activity.startsAt)}.',
      );
    }
    if (_claimError?.code == 'sold_out') {
      return _Notice(
        color: sunset,
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
          _Notice(color: sunset, icon: Icons.error_outline, title: 'We couldn’t claim your spot', body: _claimError!.message),
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
              ? const SizedBox.square(dimension: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
              : Text('Claim my spot · ${formatPrice(activity.priceMinor, activity.currency)}'),
        ),
        const SizedBox(height: 8),
        const Text('You won’t be charged in this prototype.', textAlign: TextAlign.center, style: TextStyle(color: muted, fontSize: 12)),
      ],
    );
  }
}

class _Headline extends StatelessWidget {
  const _Headline({required this.invite});

  final Invite invite;

  @override
  Widget build(BuildContext context) {
    final recipient = invite.recipient == null ? '' : ', ${invite.recipient}';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          invite.isVouch ? '${invite.inviterName} vouched for you$recipient' : '${invite.inviterName} invited you',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
        ),
        if (invite.isVouch) ...[
          const SizedBox(height: 4),
          const Text('A vouch means they stand behind you.', style: TextStyle(color: muted)),
        ],
      ],
    );
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.activity});

  final Activity activity;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE7E1D9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(activity.title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 12),
              _SpotsPill(spotsLeft: activity.spotsLeft),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${formatDate(activity.startsAt)} · ${formatPrice(activity.priceMinor, activity.currency)}',
            style: const TextStyle(color: muted),
          ),
          if (activity.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(activity.description, style: const TextStyle(height: 1.4)),
          ],
        ],
      ),
    );
  }
}

class _SpotsPill extends StatelessWidget {
  const _SpotsPill({required this.spotsLeft});

  final int spotsLeft;

  @override
  Widget build(BuildContext context) {
    final color = spotsLeft == 0 ? muted : spotsLeft <= 3 ? sunset : lagoon;
    final label = spotsLeft == 0 ? 'Full' : spotsLeft == 1 ? 'Last spot' : '$spotsLeft spots left';
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 250),
      transitionBuilder: (child, animation) => ScaleTransition(scale: animation, child: child),
      child: Container(
        key: ValueKey(label),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
        child: Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
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
      decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
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
        color: const Color(0xFFE7E1D9),
        borderRadius: BorderRadius.circular(16),
        child: ListTile(
          leading: const Icon(Icons.cloud_off),
          title: const Text('You’re offline'),
          subtitle: const Text('Showing details saved on this phone.'),
          trailing: TextButton(onPressed: onRetry, child: const Text('Retry')),
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
      decoration: BoxDecoration(color: const Color(0xFFE7E1D9), borderRadius: BorderRadius.circular(24)),
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
            color: sunset,
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
