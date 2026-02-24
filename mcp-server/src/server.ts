#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { randomUUID } from 'crypto'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { registerAllTools } from './tools/index.js'

const PORT = parseInt(process.env.MCP_PORT || '3334', 10)
const API_URL = process.env.EXECUT_API_URL || 'http://localhost:3333'

const transports: Record<string, StreamableHTTPServerTransport> = {}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'execut-orchestrator',
    version: '1.0.0',
  })
  registerAllTools(server)
  return server
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, last-event-id, mcp-protocol-version')
  res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  if (url.pathname === '/mcp') {
    const sessionId = req.headers['mcp-session-id'] as string | undefined

    if (req.method === 'POST') {
      const body = await new Promise<string>((resolve) => {
        let data = ''
        req.on('data', (chunk: Buffer) => { data += chunk.toString() })
        req.on('end', () => resolve(data))
      })

      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(body)
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      if (!sessionId && isInitializeRequest(parsedBody)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        })

        const mcpServer = createMcpServer()
        await mcpServer.connect(transport)
        await transport.handleRequest(req, res, parsedBody)

        const newSessionId = transport.sessionId
        if (newSessionId) {
          transports[newSessionId] = transport
          transport.onclose = () => { delete transports[newSessionId] }
        }
        return
      }

      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res, parsedBody)
        return
      }

      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing or invalid session' }))
      return
    }

    if (req.method === 'GET') {
      if (!sessionId || !transports[sessionId]) {
        res.writeHead(400)
        res.end('Invalid session')
        return
      }
      await transports[sessionId].handleRequest(req, res)
      return
    }

    if (req.method === 'DELETE') {
      if (sessionId && transports[sessionId]) {
        await transports[sessionId].close()
        delete transports[sessionId]
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
      } else {
        res.writeHead(404)
        res.end('Session not found')
      }
      return
    }
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', sessions: Object.keys(transports).length }))
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Execut MCP Server running on http://0.0.0.0:${PORT}/mcp`)
  console.log(`API backend: ${API_URL}`)
})
