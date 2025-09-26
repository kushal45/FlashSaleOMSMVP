import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  
  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  
  // Enable CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  
  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  
  // API prefix
  app.setGlobalPrefix('api/v1');
  
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`WebSocket monitoring available on: ws://localhost:${port}/monitoring`);
}
bootstrap();
