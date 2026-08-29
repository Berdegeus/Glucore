import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import 'core/api/api_client.dart';
import 'core/api/auth_token_store.dart';
import 'core/session/session_expiry_notifier.dart';
import 'core/theme/theme_cubit.dart';
import 'core/theme/theme_preference_store.dart';
import 'features/auth/data/datasources/account_service.dart';
import 'features/auth/data/datasources/auth_local_datasource.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/get_auth_status_usecase.dart';
import 'features/auth/domain/usecases/login_usecase.dart';
import 'features/auth/domain/usecases/logout_usecase.dart';
import 'features/auth/domain/usecases/register_usecase.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/patient/data/datasources/patient_local_datasource.dart';
import 'features/patient/data/datasources/patient_remote_datasource.dart';
import 'features/patient/data/repositories/patient_repository_impl.dart';
import 'features/patient/data/sync/patient_sync_service.dart';
import 'features/patient/domain/repositories/patient_repository.dart';
import 'features/patient/domain/usecases/patient_usecases.dart';
import 'features/patient/presentation/cubit/patient_cubit.dart';
import 'features/patient/presentation/cubit/user_identity_cubit.dart';
import 'features/sensor/data/platform/sensor_platform.dart';
import 'features/sensor/data/repositories/android_sensor_repository.dart';
import 'features/sensor/domain/sensor_repository.dart';
import 'features/sensor/presentation/cubit/sensor_cubit.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  await sl.reset();

  const secureStorage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  final tokenStore = AuthTokenStore(secureStorage);
  final sessionExpiry = SessionExpiryNotifier();
  final dio = ApiClient.create(tokenStore, sessionExpiry);

  sl.registerLazySingleton<AuthTokenStore>(() => tokenStore);
  sl.registerLazySingleton<SessionExpiryNotifier>(
    () => sessionExpiry,
    dispose: (notifier) => notifier.dispose(),
  );
  sl.registerLazySingleton<AccountService>(() => AccountService(dio));

  sl.registerLazySingleton<AuthLocalDataSource>(
    () => RemoteAuthDataSource(dio, tokenStore),
  );
  sl.registerLazySingleton<AuthRepository>(() => AuthRepositoryImpl(sl()));
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => LogoutUseCase(sl()));
  sl.registerLazySingleton(() => GetAuthStatusUseCase(sl()));
  sl.registerLazySingleton(() => RegisterUseCase(sl()));

  sl.registerLazySingleton<SensorPlatform>(() => SensorPlatform());
  sl.registerLazySingleton<SensorRepository>(
    () => AndroidSensorRepository(platform: sl()),
  );

  sl.registerLazySingleton<LocalPatientDataSource>(
    () => LocalPatientDataSource(),
    dispose: (dataSource) => dataSource.close(),
  );
  sl.registerLazySingleton<RemotePatientDataSource>(
    () => RemotePatientDataSource(dio),
  );
  sl.registerLazySingleton<PatientSyncService>(
    () => PatientSyncService(
      local: sl<LocalPatientDataSource>(),
      remote: sl<RemotePatientDataSource>(),
      tokenStore: sl<AuthTokenStore>(),
    ),
    dispose: (service) => service.dispose(),
  );
  sl.registerLazySingleton<PatientRepository>(
    () => PatientRepositoryImpl(
      local: sl<LocalPatientDataSource>(),
      remote: sl<RemotePatientDataSource>(),
      syncService: sl<PatientSyncService>(),
      tokenStore: sl<AuthTokenStore>(),
    ),
  );

  sl.registerLazySingleton<PatientUseCases>(
    () => PatientUseCases.fromRepository(sl<PatientRepository>()),
  );

  sl.registerFactory(
    () => AuthCubit(
      loginUseCase: sl(),
      logoutUseCase: sl(),
      getAuthStatusUseCase: sl(),
      registerUseCase: sl(),
    ),
  );
  sl.registerLazySingleton(() => const ThemePreferenceStore());
  // Single instance: the theme is app-wide state, not per-screen.
  sl.registerLazySingleton(() => ThemeCubit(store: sl<ThemePreferenceStore>()));
  sl.registerFactory(() => SensorCubit(repository: sl()));
  sl.registerFactory(() => PatientCubit(useCases: sl()));
  sl.registerFactory(() => UserIdentityCubit(accountService: sl()));
}
