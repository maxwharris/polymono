// A rule violation the player can see. status: 400 bad request, 403 not allowed, 404 missing, 409 wrong turn/phase.
class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = { GameError };
