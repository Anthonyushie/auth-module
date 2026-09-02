import app from './app';
import { env } from './config/env.config';
import { prisma } from './utils/prisma';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Authentication Server running in [${env.NODE_ENV}] mode on port ${env.PORT}`);
  console.log(`🔗 Health check available at http://localhost:${env.PORT}/health`);
});

// Graceful shutdown handling
const handleShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Database connections closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
