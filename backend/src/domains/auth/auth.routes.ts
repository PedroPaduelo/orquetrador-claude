import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../../lib/prisma.js'
import { BadRequestError, UnauthorizedError } from '../../http/errors/index.js'

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

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '7d' })

      return reply.status(201).send({
        token,
        user: { id: user.id, email: user.email, name: user.name },
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

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '7d' })

      return {
        token,
        user: { id: user.id, email: user.email, name: user.name },
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

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      }
    },
  )
}
