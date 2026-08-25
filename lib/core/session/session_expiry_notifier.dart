import 'package:flutter/foundation.dart';

/// Single signal for "the stored session is no longer valid".
///
/// The `ApiClient` interceptor cannot depend on `AuthCubit`: it is built before
/// the cubits exist in the DI container, so depending on it would close a cycle
/// (design AD-3). It signals here instead, and `App` listens to run the logout
/// and show the notice.
///
/// [signal] latches: N requests failing together produce exactly one
/// notification, so the app never stacks logouts or login screens. [reset]
/// clears the latch when a new session starts, without notifying.
class SessionExpiryNotifier extends ChangeNotifier {
  bool _expired = false;

  /// True once the session was reported invalid and before [reset].
  bool get expired => _expired;

  void signal() {
    if (_expired) return;
    _expired = true;
    notifyListeners();
  }

  void reset() {
    _expired = false;
  }
}
