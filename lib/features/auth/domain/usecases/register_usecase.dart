import '../../../../core/usecase/usecase.dart';
import '../repositories/auth_repository.dart';

class RegisterParams {
  const RegisterParams({
    required this.fullName,
    required this.email,
    required this.password,
    this.phone,
    this.birthDate,
    this.weightKg,
    this.targetRangeMin,
    this.targetRangeMax,
  });

  final String fullName;
  final String email;
  final String password;
  final String? phone;
  final DateTime? birthDate;
  final double? weightKg;
  final int? targetRangeMin;
  final int? targetRangeMax;
}

class RegisterUseCase implements UseCase<bool, RegisterParams> {
  const RegisterUseCase(this.repository);

  final AuthRepository repository;

  @override
  Future<bool> call(RegisterParams params) {
    return repository.register(
      fullName: params.fullName,
      email: params.email,
      password: params.password,
      phone: params.phone,
      birthDate: params.birthDate,
      weightKg: params.weightKg,
      targetRangeMin: params.targetRangeMin,
      targetRangeMax: params.targetRangeMax,
    );
  }
}
