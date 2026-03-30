import 'dart:async';
import 'package:flutter/material.dart';

import '../../domain/models.dart';
import '../../domain/events.dart';
import '../../domain/sensor_repository.dart';

class SensorController extends ChangeNotifier {
  final SensorRepository repository;
  SensorUiState _state = SensorUiState.initial;
  StreamSubscription<SensorEvent>? _eventSubscription;

  SensorUiState get state => _state;

  SensorController({required this.repository});

  Future<void> init() async {
    _listenToEvents();
    try {
      final restored = await repository.restoreSession();
      if (restored != null) {
        _state = _state.copyWith(status: SensorConnectionStatus.disconnected, session: restored);
      } else {
        _state = SensorUiState.initial;
      }
      notifyListeners();
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  void _listenToEvents() {
    _eventSubscription?.cancel();
    _eventSubscription = repository.observeSessionEvents().listen((event) {
      _state = SensorUiState(
        status: event.status,
        session: event.session ?? _state.session,
        warmupInfo: event.warmupInfo ?? _state.warmupInfo,
        reading: event.reading ?? _state.reading,
        failure: event.failure,
      );
      notifyListeners();
    }, onError: (error) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(error.toString()));
      notifyListeners();
    });
  }

  Future<void> registerSensor(String barcode) async {
    _state = _state.copyWith(status: SensorConnectionStatus.scanning, failure: null);
    notifyListeners();
    try {
      await repository.registerSensor(barcode);
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  Future<void> submitTransmitter(String transmitterBarcode) async {
    try {
      await repository.submitTransmitter(transmitterBarcode);
      if (_state.session != null) {
        _state = _state.copyWith(session: _state.session!.copyWith(transmitterId: transmitterBarcode));
        notifyListeners();
      }
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  Future<void> startMonitoring() async {
    _state = _state.copyWith(status: SensorConnectionStatus.scanning, failure: null);
    notifyListeners();
    try {
      await repository.startMonitoring();
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  Future<void> stopMonitoring() async {
    try {
      await repository.stopMonitoring();
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  Future<void> clearSession() async {
    try {
      await repository.clearSession();
      _state = SensorUiState.initial;
      notifyListeners();
    } catch (e) {
      _state = _state.copyWith(status: SensorConnectionStatus.error, failure: SensorFailure(e.toString()));
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _eventSubscription?.cancel();
    super.dispose();
  }
}
