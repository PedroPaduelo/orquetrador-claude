import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { importFromUrl } from './import-repo.service.js'

export async function importRepoRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /import-repo
  server.post(
    '/import-repo',
    {
      schema: {
        tags: ['Import'],
        summary: 'Scan a GitHub repo and bulk-import skills, agents, and rules into project',
        body: z.object({
          url: z.string().min(1),
          projectPath: z.string().min(1),
          saveToDb: z.boolean().default(true),
        }),
        response: {
          200: z.object({
            imported: z.array(z.object({
              type: z.string(),
              name: z.string(),
              filesCount: z.number(),
            })),
            skipped: z.array(z.object({
              type: z.string(),
              name: z.string(),
              reason: z.string(),
            })),
            errors: z.array(z.object({
              path: z.string(),
              error: z.string(),
            })),
          }),
        },
      },
    },
    async (request) => {
      const { url, projectPath, saveToDb } = request.body
      return importFromUrl(url, projectPath, saveToDb)
    }
  )
}
