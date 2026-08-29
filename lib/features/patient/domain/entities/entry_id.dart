import 'package:uuid/uuid.dart';

const _uuid = Uuid();

final _uuidPattern = RegExp(
  r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-'
  r'[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

/// Gera a identidade de uma entrada criada no app (IDENT-01).
String newEntryId() => _uuid.v4();

/// Identidade estável de uma entrada de diário (IDENT-01/IDENT-06).
///
/// Usa o id vindo do servidor quando ele é um UUID bem formado; caso contrário
/// gera um UUID v4 local, para que a entrada nunca fique sem identidade.
String entryIdFrom(Object? candidate) {
  final value = candidate?.toString() ?? '';
  return _uuidPattern.hasMatch(value) ? value : newEntryId();
}
