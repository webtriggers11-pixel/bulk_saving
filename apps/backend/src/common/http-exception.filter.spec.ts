import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import type { ApiResponse } from '@bulk/shared';
import { HttpExceptionFilter } from './http-exception.filter';
import { ErrorCode } from './error-codes';

interface CapturedResponse {
  statusCode: number;
  body: ApiResponse<never>;
}

function makeHost(captured: CapturedResponse): ArgumentsHost {
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return {
        json(body: ApiResponse<never>) {
          captured.body = body;
          return body;
        },
      };
    },
  };
  return {
    switchToHttp: () => ({
      getResponse: <T>() => response as T,
      getRequest: <T>() => ({}) as T,
      getNext: <T>() => ({}) as T,
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps a known HttpException to the error envelope with the right status', () => {
    const captured = {} as CapturedResponse;
    filter.catch(new BadRequestException('Bad input'), makeHost(captured));

    expect(captured.statusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body.success).toBe(false);
    if (captured.body.success === false) {
      expect(captured.body.error.code).toBe(ErrorCode.BAD_REQUEST);
      expect(captured.body.error.message).toBe('Bad input');
    }
  });

  it('honours an explicit code in the exception payload', () => {
    const captured = {} as CapturedResponse;
    filter.catch(
      new HttpException({ code: 'ROUND_CLOSED', message: 'No longer open.' }, HttpStatus.CONFLICT),
      makeHost(captured),
    );

    expect(captured.statusCode).toBe(HttpStatus.CONFLICT);
    if (captured.body.success === false) {
      expect(captured.body.error.code).toBe('ROUND_CLOSED');
      expect(captured.body.error.message).toBe('No longer open.');
    }
  });

  it('falls back to INTERNAL_ERROR for unknown throwables', () => {
    const captured = {} as CapturedResponse;
    filter.catch(new Error('boom'), makeHost(captured));

    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    if (captured.body.success === false) {
      expect(captured.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    }
  });
});
