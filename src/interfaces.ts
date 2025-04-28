// --- Data Model Interfaces ---

interface ITwistAvailability {
    twistId: string;
    name: string;
    usesLeft: number | null;
    // Future: description, constraits, per word/per turn
  }
  
  interface IGameState {
    gameId: string;
    playerIds: string[];
    targetWord: string[];
    currentWords: string[];
    turnNumber: number;
    gameStatus: 'active' | 'completed' | 'failed';
    availableTwists: ITwistAvailability[];
    history: any[]; // Future: Specific history entry type
  }
  
  interface ILetterTwistDetail {
      type: 'ADD' | 'DROP' | 'SWAP';
      letter?: string; // For ADD
      position: number;
      from?: string; // For SWAP
      to?: string;   // For SWAP
  }
  
  interface IPlayerActionDetails {
    // Specific details based on type
    twists?: ILetterTwistDetail[];     // For LETTER_TWIST
    targetSynonymAntonym?: string;     // For WORD_TWIST
    splitIndex?: number;               // For SPLIT
    mergeIndices?: number[];           // For MERGE
    // Future: more fields
  }
  
  interface IPlayerAction {
    type: 'LETTER_TWIST' | 'WORD_TWIST' | 'SPLIT' | 'MERGE' | string; // Future: more twist strings
    targetWordIndex?: number;
    details: IPlayerActionDetails;
  }
  
  interface ITurnInput {
    actions: IPlayerAction[];
    finalWords: string[];
  }
  
  interface IErrorResponse {
      errorCode: string;
      offendingWord?: string;
      message: string;
  }
  
  interface ITurnResponse {
    isValid: boolean;
    updatedGameState?: IGameState;
    errorMessage?: IErrorResponse;
  }
  
  // Export interfaces to be used in other files
  export {
      IGameState,
      IPlayerAction,
      ITurnInput,
      ITurnResponse,
      IErrorResponse,
      ITwistAvailability,
      ILetterTwistDetail,
      IPlayerActionDetails
  };
  
  