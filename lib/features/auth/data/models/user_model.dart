import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({required super.email, required super.fullName});

  Map<String, dynamic> toMap() {
    return {'email': email, 'fullName': fullName};
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      email: map['email'] as String? ?? '',
      fullName: map['fullName'] as String? ?? '',
    );
  }
}
