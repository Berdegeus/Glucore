abstract class Failure {
  const Failure(this.message);

  final String message;
}

class CacheFailure extends Failure {
  const CacheFailure([super.message = 'Erro ao acessar cache local']);
}
