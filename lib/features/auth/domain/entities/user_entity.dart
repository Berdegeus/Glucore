import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  const UserEntity({required this.email});

  final String email;

  @override
  List<Object?> get props => [email];
}
