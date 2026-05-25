import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class LibreNFCPage extends StatelessWidget {
  const LibreNFCPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Libre — Parear sensor')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 100,
                height: 100,
                decoration: BoxDecoration(
                  color: AppTheme.surfaceSunken,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  Icons.nfc_rounded,
                  size: 52,
                  color: AppTheme.inkMuted,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Parear sensor Libre',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.ink,
                ),
              ),
              const SizedBox(height: 10),
              const Text(
                'Aproxime o smartphone do sensor Libre para iniciar a leitura NFC.',
                style: TextStyle(fontSize: 14, color: AppTheme.inkMuted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              FilledButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      // TODO: implement with nfc_manager package
                      content: Text(
                          'NFC não implementado nesta versão — em breve'),
                    ),
                  );
                },
                icon: const Icon(Icons.nfc_rounded),
                label: const Text('Iniciar leitura NFC'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
