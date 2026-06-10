import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import paymentRouter from './routes/payment.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Express middleware to parse json bodies and urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Payment routes
app.use('/api/payment', paymentRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 PhonePe secure payment server listening on port ${PORT}`);
});
