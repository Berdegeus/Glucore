import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _send() {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.forgotPasswordSuccessMessage)),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotPasswordTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(
                  labelText: l10n.forgotPasswordRegisteredEmailLabel,
                ),
                validator: (value) => (value == null || !value.contains('@'))
                    ? l10n.genericInvalidEmailError
                    : null,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _send,
                child: Text(l10n.forgotPasswordSubmitButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
