import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization');
    
    const response = await fetch('http://localhost:9000/projects', {
      headers: {
        'Authorization': token || '',
      },
    });
    
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 