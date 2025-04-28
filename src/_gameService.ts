
/* import { Collection, WithId, Document } from 'mongodb'; // Import WithId and Document
import { getDb } from './db';
import { IGameState } from './interfaces';

const GAMES_COLLECTION = 'games'; // MongoDB collection name

// Define a type for the document stored in MongoDB, excluding the default _id
// Or ensure IGameState doesn't conflict with _id if you keep it simple
type GameDocument = Omit<IGameState, '_id'>; // Example if IGameState might have _id


function getGamesCollection(): Collection<GameDocument> {
     // Use GameDocument type here
    return getDb().collection<GameDocument>(GAMES_COLLECTION);
}

async function saveGameState(gameState: IGameState): Promise<void> {
    try {
        const collection = getGamesCollection();
        // Ensure we don't try to insert _id if it's managed by Mongo implicitly
        const { _id, ...gameDataToSave } = gameState as any; // Exclude _id if present

        // Use replaceOne with upsert: inserts if not exists, replaces if exists
        await collection.replaceOne({ gameId: gameState.gameId }, gameDataToSave, { upsert: true });
        console.log(`Game state saved/updated for gameId: ${gameState.gameId}`);
    } catch (error) {
        console.error(`Error saving game state for gameId ${gameState.gameId}:`, error);
        throw new Error('Database error while saving game state.');
    }
}

async function findGameById(gameId: string): Promise<IGameState | null> {
    try {
        const collection = getGamesCollection();
        // Fetch the document which might include _id
        const gameDoc = await collection.findOne({ gameId: gameId });

        if (!gameDoc) {
            return null;
        }

        // Map the MongoDB document (which might include _id) back to IGameState
        // If IGameState definition *requires* excluding _id, do it here.
        // If IGameState allows optional _id, this mapping might be simpler.
        // For simplicity, let's assume direct mapping works or IGameState allows optional _id
        const { _id, ...gameStateData } = gameDoc as WithId<GameDocument>;

        // Reconstruct to fit IGameState if necessary, e.g., ensure all fields are present
        // This example assumes gameDoc structure matches IGameState after removing _id
        const gameState: IGameState = gameStateData as IGameState; // Cast needed if structure matches

        return gameState;
    } catch (error) {
        console.error(`Error finding game state for gameId ${gameId}:`, error);
        throw new Error('Database error while finding game state.');
    }
}

export { saveGameState, findGameById };
*/