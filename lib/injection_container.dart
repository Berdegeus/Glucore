import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'features/auth/data/datasources/auth_local_datasource.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'features/auth/domain/usecases/login_usecase.dart';
import 'features/auth/domain/usecases/logout_usecase.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/patient/data/datasources/patient_local_datasource.dart';
import 'features/patient/data/repositories/patient_local_repository.dart';
import 'features/patient/presentation/cubit/patient_cubit.dart';
import 'features/sensor/data/platform/sensor_platform.dart';
import 'features/sensor/data/repositories/android_sensor_repository.dart';
import 'features/sensor/domain/sensor_repository.dart';
import 'features/sensor/presentation/cubit/sensor_cubit.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  await sl.reset();
  final sharedPreferences = await SharedPreferences.getInstance();

  sl.registerLazySingleton<SharedPreferences>(() => sharedPreferences);

  sl.registerLazySingleton<AuthLocalDataSource>(
    () => AuthLocalDataSourceImpl(sl()),
  );

  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(sl()),
  );

  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => LogoutUseCase(sl()));
  sl.registerLazySingleton(() => GetAuthStatusUseCase(sl()));

  sl.registerLazySingleton<SensorPlatform>(() => SensorPlatform());
  sl.registerLazySingleton<SensorRepository>(
    () => AndroidSensorRepository(platform: sl()),
  );

  sl.registerLazySingleton<PatientLocalDataSource>(
    () => SharedPrefsPatientLocalDataSource(sl()),
  );
  sl.registerLazySingleton(() => PatientLocalRepository(sl()));

  sl.registerFactory(
    () => AuthCubit(
      loginUseCase: sl(),
      logoutUseCase: sl(),
      getAuthStatusUseCase: sl(),
    ),
  );
  sl.registerFactory(() => SensorCubit(repository: sl()));
  sl.registerFactory(() => PatientCubit(repository: sl()));
}
