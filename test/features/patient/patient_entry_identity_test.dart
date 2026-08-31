import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';

/// IDENT-01, IDENT-02 e IDENT-06: identidade própria e estável das entradas de
/// diário (carboidrato, insulina e alerta).
void main() {
  final uuidV4 = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );

  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);
  final t1 = DateTime.fromMillisecondsSinceEpoch(1700000600000);

  group('IDENT-01: entrada criada no app recebe UUID v4', () {
    test('CarbEntry.create gera um id v4 distinto por entrada', () {
      final first = CarbEntry.create(grams: 45, description: 'Almoço', time: t0);
      final second =
          CarbEntry.create(grams: 45, description: 'Almoço', time: t0);

      expect(first.id, matches(uuidV4));
      expect(second.id, matches(uuidV4));
      expect(first.id, isNot(second.id));
    });

    test('InsulinEntry.create gera um id v4 distinto por entrada', () {
      final first = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );
      final second = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );

      expect(first.id, matches(uuidV4));
      expect(second.id, matches(uuidV4));
      expect(first.id, isNot(second.id));
    });

    test('AppAlertItem.create gera um id v4 distinto por entrada', () {
      final first =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);
      final second =
          AppAlertItem.create(type: AppAlertType.glucoseLow, timestamp: t0);

      expect(first.id, matches(uuidV4));
      expect(second.id, matches(uuidV4));
      expect(first.id, isNot(second.id));
    });
  });

  group('IDENT-02: mudar o horário preserva o id', () {
    test('CarbEntry.copyWith mantém o id ao mudar horário e gramas', () {
      final original =
          CarbEntry.create(grams: 45, description: 'Almoço', time: t0);

      final edited = original.copyWith(time: t1, grams: 60);

      expect(edited.id, original.id);
      expect(edited.time, t1);
      expect(edited.grams, 60);
      expect(edited.description, 'Almoço');
    });

    test('InsulinEntry.copyWith mantém o id ao mudar horário', () {
      final original = InsulinEntry.create(
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );

      final edited = original.copyWith(time: t1, units: 6);

      expect(edited.id, original.id);
      expect(edited.time, t1);
      expect(edited.units, 6);
      expect(edited.type, InsulinType.bolus);
      expect(edited.dayOfWeek, kDaysOfWeek[2]);
    });

    test('AppAlertItem.copyWith mantém o id ao mudar horário', () {
      final original =
          AppAlertItem.create(type: AppAlertType.glucoseHigh, timestamp: t0);

      final edited = original.copyWith(timestamp: t1);

      expect(edited.id, original.id);
      expect(edited.timestamp, t1);
      expect(edited.type, AppAlertType.glucoseHigh);
    });
  });

  group('serialização carrega o id', () {
    test('CarbEntry: toJson inclui id e fromJson usa o id do servidor', () {
      const serverId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
      final json = CarbEntry(
        id: serverId,
        grams: 30,
        description: 'Lanche',
        time: t0,
      ).toJson();

      expect(json['id'], serverId);

      final restored = CarbEntry.fromJson(json);
      expect(restored.id, serverId);
      expect(restored.grams, 30);
      expect(restored.description, 'Lanche');
      expect(restored.time, t0);
    });

    test('InsulinEntry: toJson inclui id e fromJson usa o id do servidor', () {
      const serverId = '9c858901-8a57-4791-81fe-4c455b099bc9';
      final json = InsulinEntry(
        id: serverId,
        units: 3,
        type: InsulinType.basal,
        time: t0,
        dayOfWeek: kDaysOfWeek[1],
      ).toJson();

      expect(json['id'], serverId);

      final restored = InsulinEntry.fromJson(json);
      expect(restored.id, serverId);
      expect(restored.units, 3);
      expect(restored.type, InsulinType.basal);
      expect(restored.dayOfWeek, kDaysOfWeek[1]);
    });

    test('AppAlertItem: toJson inclui id e fromJson usa o id do servidor', () {
      const serverId = 'b1e0f1b0-7c4a-4b3e-8a2d-5c9f6d2e1a77';
      final json = AppAlertItem(
        id: serverId,
        type: AppAlertType.syncFailure,
        timestamp: t0,
      ).toJson();

      expect(json['id'], serverId);

      final restored = AppAlertItem.fromJson(json);
      expect(restored.id, serverId);
      expect(restored.type, AppAlertType.syncFailure);
      expect(restored.timestamp, t0);
    });
  });

  group('IDENT-06: id ausente ou malformado vira id local', () {
    test('CarbEntry.fromJson sem id gera um id v4 local', () {
      final restored = CarbEntry.fromJson({
        'grams': 20,
        'description': 'Fruta',
        'timeMs': t0.millisecondsSinceEpoch,
      });

      expect(restored.id, matches(uuidV4));
      expect(restored.grams, 20);
      expect(restored.time, t0);
    });

    test('CarbEntry.fromJson com id fora do formato UUID gera id v4 local', () {
      final restored = CarbEntry.fromJson({
        'id': 'not-a-uuid',
        'grams': 20,
        'description': 'Fruta',
        'timeMs': t0.millisecondsSinceEpoch,
      });

      expect(restored.id, isNot('not-a-uuid'));
      expect(restored.id, matches(uuidV4));
    });

    test('InsulinEntry.fromJson sem id e com id inválido gera id v4 local', () {
      final missing = InsulinEntry.fromJson({
        'units': 2,
        'type': InsulinType.correction.name,
        'timeMs': t0.millisecondsSinceEpoch,
        'dayOfWeek': kDaysOfWeek[0],
      });
      final malformed = InsulinEntry.fromJson({
        'id': '123',
        'units': 2,
        'type': InsulinType.correction.name,
        'timeMs': t0.millisecondsSinceEpoch,
        'dayOfWeek': kDaysOfWeek[0],
      });

      expect(missing.id, matches(uuidV4));
      expect(malformed.id, isNot('123'));
      expect(malformed.id, matches(uuidV4));
    });

    test('AppAlertItem.fromJson sem id e com id inválido gera id v4 local', () {
      final missing = AppAlertItem.fromJson({
        'type': AppAlertType.glucoseLow.name,
        'timestampMs': t0.millisecondsSinceEpoch,
      });
      final malformed = AppAlertItem.fromJson({
        'id': '',
        'type': AppAlertType.glucoseLow.name,
        'timestampMs': t0.millisecondsSinceEpoch,
      });

      expect(missing.id, matches(uuidV4));
      expect(malformed.id, matches(uuidV4));
    });
  });
}
