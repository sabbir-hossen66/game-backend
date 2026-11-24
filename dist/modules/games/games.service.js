"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GamesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesService = void 0;
const common_1 = require("@nestjs/common");
const rps_game_engine_1 = require("./engine/rps-game.engine");
let GamesService = GamesService_1 = class GamesService {
    constructor() {
        this.logger = new common_1.Logger(GamesService_1.name);
        this.games = new Map();
    }
    startGame(roomCode, playerIds, targetScore, broadcastState, onGameOver) {
        const upperCode = roomCode.toUpperCase();
        this.endGame(upperCode);
        const engine = new rps_game_engine_1.RpsGameEngine(playerIds[0], playerIds[1], targetScore, (state) => {
            broadcastState(upperCode, (uid) => engine.getClientState(uid));
            if (state.phase === 'game_over' && onGameOver) {
                onGameOver(state.matchWinnerId);
            }
        });
        this.games.set(upperCode, engine);
        engine.start();
        this.logger.log(`Game started in room ${upperCode} between ${playerIds[0]} and ${playerIds[1]}`);
        return engine;
    }
    getGame(roomCode) {
        return this.games.get(roomCode.toUpperCase());
    }
    makeChoice(roomCode, userId, choice) {
        const game = this.games.get(roomCode.toUpperCase());
        if (!game)
            return false;
        return game.makeChoice(userId, choice);
    }
    requestRematch(roomCode, userId) {
        const game = this.games.get(roomCode.toUpperCase());
        if (!game)
            return false;
        return game.requestRematch(userId);
    }
    endGame(roomCode) {
        const upperCode = roomCode.toUpperCase();
        const game = this.games.get(upperCode);
        if (game) {
            game.destroy();
            this.games.delete(upperCode);
            this.logger.log(`Game destroyed for room ${upperCode}`);
        }
    }
};
exports.GamesService = GamesService;
exports.GamesService = GamesService = GamesService_1 = __decorate([
    (0, common_1.Injectable)()
], GamesService);
//# sourceMappingURL=games.service.js.map