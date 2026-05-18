import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({required this.email, required this.fullName});

  final String email;
  final String fullName;

  @override
  List<Object?> get props => [email, fullName];
}
