import 'package:flutter/material.dart';

/// Password field used by every screen that asks for a password.
///
/// Starts obscured and owns its own visibility state, so two fields on the same
/// screen toggle independently. Validation stays with the caller: login only
/// requires a non-empty value, while the screens that *define* a password pass
/// a validator built on `PasswordPolicy`.
class PasswordField extends StatefulWidget {
  const PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.helperText,
    this.validator,
  });

  final TextEditingController controller;
  final String label;

  /// Auxiliary text under the field, used to spell out the strength rule.
  final String? helperText;

  final String? Function(String?)? validator;

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscured = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _obscured,
      validator: widget.validator,
      decoration: InputDecoration(
        labelText: widget.label,
        helperText: widget.helperText,
        suffixIcon: IconButton(
          icon: Icon(
            _obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          ),
          onPressed: () => setState(() => _obscured = !_obscured),
        ),
      ),
    );
  }
}
