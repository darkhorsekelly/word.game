import express, { Express, Request, Response } from 'express';
import gameRoutes from './gameApi'; 

const app: Express = express();
const PORT: number | string = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Mount game API routes
app.use('/api', gameRoutes);

// Basic route, testing
app.get('/', (req: Request, res: Response) => {
  res.send('Word.game server is running! (TypeScript)');
});

// Startup
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

