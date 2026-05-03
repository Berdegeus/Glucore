import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({required super.email});

  Map<String, dynamic> toMap() {
    return {'email': email};
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(email: map['email'] as String? ?? '');
  }
}
