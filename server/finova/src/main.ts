import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true
  }));
  app.enableCors({
    "origin": 'https://finova-frontend.onrender.com',
    "credentials": true,
    methods: ['GET','POST', 'PUT','DELETE'],
    allowedHeaders: ['Content-type', 'Authorization','Set-Cookie']
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
