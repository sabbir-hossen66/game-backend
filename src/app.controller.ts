import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'PlayRoom Game & Voice Backend',
      version: '1.0.0',
    };
  }

  @Get('api/health')
  getHealth() {
    return {
      status: 'ok',
      message: 'PlayRoom Game & Voice Backend is healthy and running',
      timestamp: new Date().toISOString(),
    };
  }
}
