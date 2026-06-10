export class AuthProfileError extends Error {
  constructor(message = "Сервер не вернул профиль пользователя после входа") {
    super(message);
    this.name = "AuthProfileError";
  }
}
