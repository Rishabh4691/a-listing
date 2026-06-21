import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import generateRouter from './routes/generate.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}))
app.use(express.json({ limit: '100mb' }))

app.use('/api', generateRouter)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.listen(PORT, () => {
  console.log(`A-Listing backend running on http://localhost:${PORT}`)
  if (!process.env.NVIDIA_API_KEY) {
    console.warn('  Warning: NVIDIA_API_KEY not set — AI generation will fail until you add it to backend/.env')
  } else {
    console.log('  NVIDIA_API_KEY loaded')
  }
})
