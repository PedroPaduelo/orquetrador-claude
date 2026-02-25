import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../../lib/prisma.js'
import { BadRequestError, UnauthorizedError } from '../../http/errors/index.js'

const PROJECT_BASE_PATH = process.env.PROJECT_BASE_PATH || '/workspace/temp-orquestrador'

function ensureUserDir(userId: string): string {
  const userDir = join(PROJECT_BASE_PATH, 'users', userId, 'projetos')
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true })
  }
  return userDir
}

export async function authRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /auth/register
  server.post(
    '/auth/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: z.object({
          email: z.string().email(),
          password: z.string().min(6),
          name: z.string().optional(),
        }),
        response: {
          201: z.object({
            token: z.string(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              basePath: z.string(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        throw new BadRequestError('Email ja cadastrado')
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: { email, passwordHash, name },
      })

      const basePath = ensureUserDir(user.id)
      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '7d' })

      return reply.status(201).send({
        token,
        user: { id: user.id, email: user.email, name: user.name, basePath },
      })
    },
  )

  // POST /auth/login
  server.post(
    '/auth/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        body: z.object({
          email: z.string().email(),
          password: z.string(),
        }),
        response: {
          200: z.object({
            token: z.string(),
            user: z.object({
              id: z.string(),
              email: z.string(),
              name: z.string().nullable(),
              basePath: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { email, password } = request.body

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        throw new UnauthorizedError('Email ou senha invalidos')
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        throw new UnauthorizedError('Email ou senha invalidos')
      }

      const basePath = ensureUserDir(user.id)
      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '7d' })

      return {
        token,
        user: { id: user.id, email: user.email, name: user.name, basePath },
      }
    },
  )

  // GET /auth/me
  server.get(
    '/auth/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Get current user profile',
        response: {
          200: z.object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable(),
            basePath: z.string(),
            createdAt: z.string(),
          }),
        },
      },
    },
    async (request) => {
      const userId = await request.getCurrentUserId()

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new UnauthorizedError('Usuario nao encontrado')
      }

      const basePath = ensureUserDir(user.id)

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        basePath,
        createdAt: user.createdAt.toISOString(),
      }
    },
  )
}
