import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as WebSocket from 'ws';

if (!globalThis.WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3000', 'https://almaverdediseno.com', 'https://www.almaverdediseno.com'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
