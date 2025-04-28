
import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IGameState, ITurnInput, ITurnResponse, IErrorResponse } from './interfaces'; // Import interfaces
import { saveGameState, findGameById } from './gameService';
import asyncHandler from 'express-async-handler';

const router: Router = express.Router();

// --- Configuration ---
const WORD_LIST_FILE = 'words.txt'; // Used for starting and target words
const BLOCK_LIST_FILE = 'block.txt'; // Profanity filter

// External API for dictionary validation
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Placeholder
const PLAYER_ID_V1 = 'player_001';

// --- Pre-loader on server start ---
let gameWordList: string[] = [];

try {
    gameWordList = loadWords(path.resolve(__dirname, WORD_LIST_FILE));
} catch (error) {
    console.error('FATAL: Failed to load word list.');
    process.exit(1);
}

let blockListSet: Set<string> = new Set();
try {
    blockListSet = loadBlockList(path.resolve(__dirname, BLOCK_LIST_FILE));
    console.log(`Loaded ${blockListSet.size} words into profanity filter.`);
} catch (error) {
    console.error("ERROR: Could not load profanity block list.", error);
}

// --- Helper Functions ---

// Function to load words from the file
function loadWords(filePath: string): string[] {
    try {
        const absolutePath = path.resolve(__dirname, filePath);
        const data = fs.readFileSync(absolutePath, 'utf8');
        const words = data.split(/\r?\n/)
            .map(word => word.trim())
            .filter(word => word.length > 0);
        if (words.length < 2) {
            throw new Error('Word list must contain at least two words.');
        }
        console.log(`Loaded ${words.length} words.`);
        return words;
    } catch (err: any) {
        console.error(`Error loading word list from ${filePath}:`, err);
        throw new Error(`Failed to load word list: ${err.message}`);
    }
}

// Function to load block list into a Set
// --- NEW: Function to load block list into a Set ---
function loadBlockList(filePath: string): Set<string> {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const words = data.split(/\r?\n/)
                          .map(word => word.trim().toLowerCase()) // Store lowercase
                          .filter(word => word.length > 0);
        return new Set(words);
    } catch (err: any) {
        console.error(`Error loading block list from ${filePath}:`, err);
        
        // If there's an error, just return a blank Set
        return new Set();
  }
}

// Pick random words for start and target
function selectRandomWords(wordList: string[]): { startWord: string; targetWord: string } {
    if (!wordList || wordList.length < 2) {
      throw new Error('Insufficient words in the list to select start and target.');
    }
    let startIndex = Math.floor(Math.random() * wordList.length);
    let targetIndex = Math.floor(Math.random() * wordList.length);
    while (targetIndex === startIndex) {
      targetIndex = Math.floor(Math.random() * wordList.length);
    }
    return {
      startWord: wordList[startIndex],
      targetWord: wordList[targetIndex]
    };
  }

// Dictionary API validation helper 
async function validateWordWithApi(word: string): Promise<{ isValid: boolean; error?: string }> {
    if (!word || word.trim().length === 0) {
        return { isValid: false, error: 'Empty word submitted' };
    }

    const url = `${DICTIONARY_API_URL}${encodeURIComponent(word)}`;

    try {
        const response = await fetch(url);

        if (response.ok) {
            // Word is in the dictionary

            return { isValid: true };
        }
        else if (response.status === 404) {
            // Not found
            return { isValid: false, error: `Word "${word}" is not a real word.` };
        }
        else {
            // Any other API error
            console.error(`Dictionary API error for "${word}": Status ${response.status}`);
            return { isValid: false, error: `We had trouble checking your word: "${word}"` };
        }
    } catch (error: any) {
        console.error(`Network error validating word "${word}":`, error);
        return { isValid: false, error: `Network error validating ${word}": ${error.message}` };
    }
}

// --- API Endpoints ---

// POST /api/games - Start new game
router.post('/games', asyncHandler(async(req: Request, res: Response<IGameState | IErrorResponse>) => {
    try {
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

        // --- Persist initialGameState to your database (e.g., MongoDB) ---
        await saveGameState(initialGameState);

        res.status(201).json(initialGameState);

    } catch (error: any) {
        console.error('Error starting new game:', error);
        const errorResponse: IErrorResponse = {
            errorCode: 'GAME_START_FAILED',
            message: `Failed to start a new game. ${error.message}`
        };
        res.status(500).json(errorResponse);
    }
}));

// POST /api/games/{gameId}/turns - Submit a turn
router.post('/games/:gameId/turns', asyncHandler(async ( 
    req: Request<{ gameId: string }, unknown, ITurnInput, unknown>, 
    res: Response<ITurnResponse | IErrorResponse>
) => {
    const { gameId } = req.params;
    const turnInput: ITurnInput = req.body;

    console.log(`Received turn for game ${gameId}:`, turnInput);

    // --- 1. Fetch Current Game State for gameId from DB ---
    const currentGameState: IGameState | null = await findGameById(gameId);

    if (!currentGameState) {
         res.status(404).json({ errorCode: 'GAME_NOT_FOUND', message: `Game with ID ${gameId} not found.` }); return;
    }
     if (currentGameState.gameStatus !== 'active') {
        res.status(400).json({ errorCode: 'GAME_NOT_ACTIVE', message: `Game ${gameId} is already ${currentGameState.gameStatus}.` }); return;
    }


    // --- 2. Validate TurnInput structure (Basic Check) ---
    if (!turnInput || !Array.isArray(turnInput.actions) || !Array.isArray(turnInput.finalWords) || turnInput.finalWords.length === 0) {
        res.status(400).json({ errorCode: 'INVALID_INPUT', message: 'Invalid turn input structure.' }); return;
    }

    // --- 3. Validate finalWords ---

    // --- 3a. Dictionary Check ---
    const validationPromises = turnInput.finalWords.map(word => validateWordWithApi(word));
    const validationResults = await Promise.all(validationPromises);
    const invalidResult = validationResults.find(result => !result.isValid);

    if (invalidResult) {
        const errorResponse: IErrorResponse = {
            errorCode: 'INVALID_WORD',
            offendingWord: turnInput.finalWords[validationResults.indexOf(invalidResult)],
            message: invalidResult.error || 'One or more of the words are not real words.'
        };
         res.status(400).json(errorResponse); return;
    }

    console.log('All final words passed dictionary validation.');

    // --- 3b. Profanity chcek --
    const profaneWord = turnInput.finalWords.find(word => blockListSet.has(word.toLowerCase()));
    if (profaneWord) {
        const errorResponse: IErrorResponse = {
            errorCode: 'PROFANITY_DETECTED',
            offendingWord: profaneWord,
            message: `Profanity detected. The word "${profaneWord}" is not allowed.`
        };
         res.status(400).json(errorResponse); return;
    }

    // --- TODO: Profanity Check ---
    console.log('All final words passed profanity filter.');


    // --- TODO: 4. Simulate actions and validate against rules ---
    // --- TODO: 5. Verify simulated outcome matches finalWords ---
    // --- TODO: 6. If valid: Update Game State, Persist, Check Win Condition ---
    let updatedGameState: IGameState | null = null; // Result of successful validation/update
    let isValidTurn = false; // Set to true if steps 4, 5, 6 succeed


    // --- TODO: 7. If invalid: Prepare detailed error response ---


    // Placeholder response (validation passed dictionary check, but rest not implemented)
    const response: ITurnResponse = {
        isValid: false,
        errorMessage: {
            errorCode: 'NOT_FULLY_IMPLEMENTED',
            message: 'Word validation passed, but action simulation and rule validation are not yet implemented.'
        }
    };

    res.status(501).json(response); // Still 501 until fully implemented

})); 

// --- Export Router ---
export default router;

