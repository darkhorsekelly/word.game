import { Collection, WithId, Document } from 'mongodb';
import { getDb } from './db';
import { IGameState } from './interfaces';

const GAMES_COLLECTION = 'games';

type GameDocument = Omit<IGameState, '_id'>;

function getGamesCollection(): Collection<GameDocument> {
    return getDb().collection<GameDocument>(GAMES_COLLECTION);
}

async function saveGameState(gameState: IGameState): Promise<void> {
    try {
        const collection = getGamesCollection();

        const { _id, ...gameDataToSave } = gameState as any;

        // upsert inserts if not exists, replaces if exists
        await collection.replaceOne({ gameId: gameState.gameId },gameDataToSave, { upsert: true });
        console.log(`Game state saved/updated for gameId: ${gameState.gameId}`);
    } catch (error) {
        console.error(`Error saving game state for gameId ${gameState.gameId}:`);
        throw new Error('Database error while saving game state.');
    }
}

async function findGameById(gameId: string): Promise<IGameState | null> {
    try {
        const collection = getGamesCollection();
        // Fetch doc, it may include _id

        const gameDoc = await collection.findOne({ gameId: gameId });

        if (!gameDoc) {
            return null;
        }

        const { _id, ...gameStateData } = gameDoc as WithId<GameDocument>;
        const gameState: IGameState = gameStateData as IGameState;
        return gameState;
    } catch (error) {
        console.error(`Error finding game state for gameId ${gameId}:`, error);
        throw new Error('Database error while finding game state.');
    }
}

export { saveGameState, findGameById };