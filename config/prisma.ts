import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: process.env.NEXT_PUBLIC_DEBUG_MODE ? [ 'query', 'info', 'warn', 'error'] : []
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma