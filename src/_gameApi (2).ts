
import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import asyncHandler from 'express-async-handler'; // Use async handler
import { IGameState, ITurnInput, ITurnResponse, IErrorResponse } from './interfaces';
import { saveGameState, findGameById } from './gameService'; // Import DB service functions

const router: Router = express.Router();

// --- Configuration ---
const WORD_LIST_FILE = 'words.txt';
const BLOCK_LIST_FILE = 'block.txt';
const PLAYER_ID_V1 = 'player_001';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// --- Pre-load Lists ---
let gameWordList: string[] = [];
try {
    gameWordList = loadWords(path.resolve(__dirname, WORD_LIST_FILE));
} catch (error) { console.error("FATAL: Could not load game word list.", error); process.exit(1); }

let blockListSet: Set<string> = new Set();
try {
    blockListSet = loadBlockList(path.resolve(__dirname, BLOCK_LIST_FILE));
    console.log(`Loaded ${blockListSet.size} words into profanity block list.`);
} catch (error) { console.error("ERROR: Could not load profanity block list.", error); }


// --- Helper Functions --- (loadWords, loadBlockList, selectRandomWords, validateWordWithApi - Unchanged)
// Function to load standard words
function loadWords(filePath: string): string[] {
  try { const data = fs.readFileSync(filePath, 'utf8'); const words = data.split(/\r?\n/).map(word => word.trim()).filter(word => word.length > 0); if (words.length < 2 && filePath.endsWith(WORD_LIST_FILE)) { throw new Error('Word list must contain at least two words.'); } return words; } catch (err: any) { console.error(`Error loading word list from ${filePath}:`, err); throw new Error(`Could not load word list: ${err.message}`); }
}
// Function to load block list into a Set
function loadBlockList(filePath: string): Set<string> {
    try { const data = fs.readFileSync(filePath, 'utf8'); const words = data.split(/\r?\n/).map(word => word.trim().toLowerCase()).filter(word => word.length > 0); return new Set(words); } catch (err: any) { console.error(`Error loading block list from ${filePath}:`, err); throw new Error(`Could not load block list: ${err.message}`); }
}
// Function to select random words
function selectRandomWords(wordList: string[]): { startWord: string; targetWord: string } {
  if (!wordList || wordList.length < 2) { throw new Error('Insufficient words in list.'); } let startIndex = Math.floor(Math.random() * wordList.length); let targetIndex = Math.floor(Math.random() * wordList.length); while (targetIndex === startIndex) { targetIndex = Math.floor(Math.random() * wordList.length); } return { startWord: wordList[startIndex], targetWord: wordList[targetIndex] };
}
// Dictionary API Validation Helper
async function validateWordWithApi(word: string): Promise<{ isValid: boolean; error?: string }> {
    if (!word || word.trim().length === 0) { return { isValid: false, error: 'Empty word submitted' }; } const url = `${DICTIONARY_API_URL}${encodeURIComponent(word)}`; try { const response = await fetch(url); if (response.ok) { return { isValid: true }; } else if (response.status === 404) { return { isValid: false, error: `Word "${word}" not found in dictionary.` }; } else { console.error(`Dictionary API error for "${word}": Status ${response.status}`); return { isValid: false, error: `API error validating "${word}". Status: ${response.status}` }; } } catch (error: any) { console.error(`Network error validating word "${word}":`, error); return { isValid: false, error: `Network error validating "${word}": ${error.message}` }; }
}

// --- API Endpoints ---

// POST /api/games - Start a new game (UPDATED with saveGameState)
router.post('/games', asyncHandler(async (req: Request, res: Response<IGameState | IErrorResponse>) => {
    const { startWord, targetWord } = selectRandomWords(gameWordList);
    const gameId = crypto.randomUUID();
    const initialGameState: IGameState = {
      gameId: gameId,
      playerIds: [PLAYER_ID_V1],
      targetWord: [targetWord],
      currentWords: [startWord],
      turnNumber: 1,
      gameStatus: 'active',
      availableTwists: [],
      history: []
    };

    // --- Persist initialGameState to DB ---
    await saveGameState(initialGameState); // Use the service function

    res.status(201).json(initialGameState);

}));

// POST /api/games/{gameId}/turns - Submit a turn (UPDATED with findGameById and Save placeholder)
router.post('/games/:gameId/turns', asyncHandler(async (
    req: Request<{ gameId: string }, unknown, ITurnInput, unknown>,
    res: Response<ITurnResponse | IErrorResponse>
) => {
    const { gameId } = req.params;
    const turnInput: ITurnInput = req.body;

    console.log(`Received turn for game ${gameId}:`, turnInput);

    // --- 1. Fetch Current Game State for gameId from DB ---
    const currentGameState: IGameState | null = await findGameById(gameId); // Use service function

    if (!currentGameState) {
        res.status(404).json({ errorCode: 'GAME_NOT_FOUND', message: `Game with ID ${gameId} not found.` }); return;
    }
    if (currentGameState.gameStatus !== 'active') {
        res.status(400).json({ errorCode: 'GAME_NOT_ACTIVE', message: `Game ${gameId} is already ${currentGameState.gameStatus}.` }); return;
    }

    // --- 2. Validate TurnInput structure ---
    if (!turnInput || !Array.isArray(turnInput.actions) || !Array.isArray(turnInput.finalWords) || turnInput.finalWords.length === 0) {
        res.status(400).json({ errorCode: 'INVALID_INPUT', message: 'Invalid turn input structure.' }); return;
    }

    // --- 3a. Validate finalWords against Dictionary API ---
    const validationPromises = turnInput.finalWords.map(word => validateWordWithApi(word));
    const validationResults = await Promise.all(validationPromises);
    const invalidResult = validationResults.find(result => !result.isValid);
    if (invalidResult) {
        const errorResponse: IErrorResponse = {
            errorCode: 'INVALID_WORD',
            offendingWord: turnInput.finalWords[validationResults.indexOf(invalidResult)],
            message: invalidResult.error || 'One or more submitted words are invalid.'
        };
         res.status(400).json(errorResponse); return;
    }
    console.log('All final words passed dictionary validation.');

    // --- 3b. Profanity Check ---
    const profaneWord = turnInput.finalWords.find(word => blockListSet.has(word.toLowerCase()));
    if (profaneWord) {
        const errorResponse: IErrorResponse = {
            errorCode: 'PROFANITY_DETECTED',
            offendingWord: profaneWord,
            message: `The word "${profaneWord}" is not allowed.`
        };
         res.status(400).json(errorResponse); return;
    }
    console.log('All final words passed profanity check.');


    // --- TODO: 4. Simulate actions and validate against rules ---
    // --- TODO: 5. Verify simulated outcome matches finalWords ---
    // --- TODO: 6. If valid: Update Game State, Check Win Condition ---
    let updatedGameState: IGameState | null = null; // Result of successful validation/update
    let isValidTurn = false; // Set to true if steps 4, 5, 6 succeed

    // Placeholder logic until validation is implemented:
    if (false) { // Replace 'false' with actual validation result
        // Example of updating state (modify as needed based on validation)
        updatedGameState = {
             ...currentGameState, // Spread existing state
             currentWords: turnInput.finalWords, // Update words
             turnNumber: currentGameState.turnNumber + 1, // Increment turn
             history: [...currentGameState.history, { turn: currentGameState.turnNumber, input: turnInput } ], // Add to history
             // TODO: Check Win Condition and update gameStatus if needed
             gameStatus: currentGameState.gameStatus // Placeholder
        };
        isValidTurn = true;

        // --- 6b. Persist Updated State ---
        // Use await here since saveGameState is async
        await saveGameState(updatedGameState); // Save the updated state
        console.log(`Game state updated and saved for gameId: ${gameId}`);

    } else {
        // Keep isValidTurn = false if validation fails
    }


    // --- 7. Send Response ---
    if (isValidTurn && updatedGameState) {
         const response: ITurnResponse = {
            isValid: true,
            updatedGameState: updatedGameState
        };
        res.status(200).json(response);
    } else {
        // If validation failed in TODO steps 4-6
         // Still return 501 if the logic isn't implemented, otherwise use 400 for bad request
         res.status(501).json({
              isValid: false,
              errorMessage: { errorCode: 'NOT_FULLY_IMPLEMENTED', message: 'Action validation not implemented.'}
         });
    }

}));

// --- Export Router ---
export default router; // Use ES module export
