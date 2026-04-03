import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _birthController;
  late final TextEditingController _weightController;
  late final TextEditingController _targetController;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;

    final l10n = context.l10n;
    _nameController = TextEditingController(text: l10n.profileDefaultName);
    _birthController = TextEditingController(text: '1995-08-10');
    _weightController = TextEditingController(text: '72');
    _targetController = TextEditingController(text: '90-140');
    _initialized = true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _birthController.dispose();
    _weightController.dispose();
    _targetController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(labelText: l10n.profileNameLabel),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.genericRequiredFieldError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _birthController,
                decoration:
                    InputDecoration(labelText: l10n.profileBirthDateLabel),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.genericRequiredFieldError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _weightController,
                decoration: InputDecoration(labelText: l10n.profileWeightLabel),
                keyboardType: TextInputType.number,
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.genericRequiredFieldError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _targetController,
                decoration: InputDecoration(
                  labelText: l10n.profileTargetRangeLabel,
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.genericRequiredFieldError
                    : null,
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () {
                  if (!_formKey.currentState!.validate()) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(l10n.profileUpdatedSuccessMessage),
                    ),
                  );
                },
                child: Text(l10n.profileSaveChangesButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
