import express from 'express';
import cors from 'cors';
import router from './routes';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});