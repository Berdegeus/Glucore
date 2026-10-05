import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sharing/data/sharing_repository_impl.dart';
import 'package:glucore/features/sharing/domain/repositories/sharing_repository.dart';
import 'package:glucore/features/sharing/presentation/cubit/sharing_cubit.dart';
import 'package:glucore/injection_container.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(initDependencies);
  tearDown(() => sl.reset());

  test('CON-01: sl<SharingCubit>() resolve depois de initDependencies()', () {
    final cubit = sl<SharingCubit>();
    addTearDown(cubit.close);

    expect(cubit, isA<SharingCubit>());
  });

  test('o cubit é uma fábrica (uma instância por tela) sobre a porta do domínio',
      () {
    final first = sl<SharingCubit>();
    final second = sl<SharingCubit>();
    addTearDown(first.close);
    addTearDown(second.close);

    expect(identical(first, second), isFalse);
    expect(sl<SharingRepository>(), isA<SharingRepositoryImpl>());
  });
}
