import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(l10n.registerSuccessMessage)),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _nameController,
                decoration:
                    InputDecoration(labelText: l10n.registerFullNameLabel),
                validator: (value) =>
                    (value == null || value.trim().length < 3)
                    ? l10n.registerFullNameError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _emailController,
                decoration: InputDecoration(labelText: l10n.genericEmailLabel),
                validator: (value) => (value == null || !value.contains('@'))
                    ? l10n.genericInvalidEmailError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _passwordController,
                obscureText: true,
                decoration:
                    InputDecoration(labelText: l10n.genericPasswordLabel),
                validator: (value) => (value == null || value.length < 4)
                    ? l10n.genericPasswordMinLengthError
                    : null,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submit,
                child: Text(l10n.registerSubmitButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
