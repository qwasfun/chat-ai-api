import express, { Request, Response } from 'express'

import cors from 'cors'

import dotenv from 'dotenv'
import { StreamChat } from 'stream-chat'
import OpenAI from 'openai'
import { db } from './config/database.js'
import { chats, users } from './db/schema.js'
import { eq } from 'drizzle-orm'

import { ChatCompletionMessageParam } from 'openai/resources'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// Initualize Stream Client

if (!process.env.STREAM_API_KEY || !process.env.STREAM_API_SECRET) {
  throw new Error(
    'STREAM_API_KEY and STREAM_API_SECRET must be defined in the environment variables'
  )
}

const chatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY,
  process.env.STREAM_API_SECRET
)

const openai = new OpenAI({
  baseURL: 'https://api.chatanywhere.tech/v1',
  apiKey: process.env.OPENAI_API_KEY
})

// Register user with Stream Chat
app.post(
  '/register-user',
  async (req: Request, res: Response): Promise<any> => {
    try {
      const { name, email } = req.body

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' })
      }

      const userId = email.replace(/[^a-zA-Z0-9_-]/g, '_')

      const userRespone = await chatClient.queryUsers({ id: { $eq: userId } })

      if (!userRespone.users.length) {
        await chatClient.upsertUser({
          id: userId,
          name: name,
          email: email,
          role: 'user'
        })
      }

      const exitingUser = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId))

      if (!exitingUser.length) {
        console.log(
          `User ${userId} does not exist in the database.Adding them...`
        )
        await db.insert(users).values({ userId, name, email })
      }

      res.status(200).json({ message: 'Success', userId, email, name })
    } catch (error) {
      console.log(error)
      res.status(500).json({ error: 'Internal Server Error1' })
    }
    // res.send('Test')
  }
)

app.post('/chat', async (req: Request, res: Response): Promise<any> => {
  const { message, userId } = req.body
  if (!message || !userId) {
    return res.status(400).json({ error: 'Message and user1 are required' })
  }

  try {
    const userRespone = await chatClient.queryUsers({ id: { $eq: userId } })
    if (!userRespone.users.length) {
      return res
        .status(404)
        .json({ error: 'user not found. Please register first' })
    }

    // check user in database
    const exitingUser = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))

    if (!exitingUser.length) {
      return res
        .status(404)
        .json({ error: 'User not found in database, please register' })
    }

    // Fetch users past messages for context
    const chatHistory = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(chats.createAt)
      .limit(10)

    // Format chat history for Open AI
    const conversation: ChatCompletionMessageParam[] = chatHistory.flatMap(
      chat => [
        { role: 'user', content: chat.message },
        { role: 'assistant', content: chat.reply }
      ]
    )

    conversation.push({ role: 'user', content: message })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      // messages: [{ role: 'user', content: message }]
      messages: conversation as ChatCompletionMessageParam[]
    })

    const aiMessage: string =
      response.choices[0].message.content ?? 'No message from AI'

    // Save chat to databases
    await db.insert(chats).values({ userId, message, reply: aiMessage })

    // create or get a channel
    const channel = chatClient.channel('messaging', `chat-${userId}`, {
      name: 'Chat AI',
      created_by_id: 'ai_bot'
    })

    await channel.create()
    await channel.sendMessage({ text: aiMessage, user_id: userId })

    res.status(200).json({ reply: aiMessage })
  } catch (error) {
    console.log(error)
    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
})

app.post(
  '/chat-messages',
  async (req: Request, res: Response): Promise<any> => {
    const { userId } = req.body
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' })
    }

    try {
      const chatHistory = await db
        .select()
        .from(chats)
        .where(eq(chats.userId, userId))
        .orderBy(chats.createAt)
        .limit(10)

      res.status(200).json({ messages: chatHistory })
    } catch (error) {
      console.log('Error fetching chat history', error)
      return res.status(500).json({
        error: 'Internal Server Error'
      })
    }
  }
)

const PORT = process.env.PORT || 5000

app.listen(PORT, () => console.log(`Server running on ${PORT}`))
