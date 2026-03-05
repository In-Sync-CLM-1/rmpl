import { corsHeaders } from './cors-headers.ts';

export function successResponse<T>(data: T, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      ...corsHeaders, 
      'Content-Type': 'application/json' 
    },
  });
}

export function errorResponse(message: string, status = 400, details?: any) {
  console.error('Error response:', { message, status, details });
  
  return new Response(
    JSON.stringify({ 
      error: message,
      ...(details && { details }),
    }), 
    {
      status,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    }
  );
}

export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401);
}

export function notFoundResponse(message = 'Not found') {
  return errorResponse(message, 404);
}

export function serverErrorResponse(message = 'Internal server error', details?: any) {
  return errorResponse(message, 500, details);
}
