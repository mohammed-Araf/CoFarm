import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nodeCount, activeAlertsCount, criticalAlertsCount, activeAlertDetails, criticalAlertDetails, temperature, moisture } = body;

    let systemPrompt = `You are a helpful, friendly agricultural assistant for a farmer.
Your goal is to provide a very brief, easy-to-understand summary of their farm's current status based on sensor data.
Do not use technical jargon. Speak directly to the farmer. Keep it to 2-3 short sentences.`;

    let userPrompt = `Here is the current farm data:
- Number of sensors: ${nodeCount}
- Active alerts: ${activeAlertsCount} (${criticalAlertsCount} critical)
`;

    if (criticalAlertsCount > 0 && criticalAlertDetails?.length) {
      userPrompt += `- Critical Issues: ${criticalAlertDetails.join(', ')}\n`;
    } else if (activeAlertsCount > 0 && activeAlertDetails?.length) {
      userPrompt += `- Active Issues: ${activeAlertDetails.join(', ')}\n`;
    }

    if (temperature !== undefined && moisture !== undefined) {
      userPrompt += `- Latest average temperature: ${temperature.toFixed(1)}°C\n`;
      userPrompt += `- Latest average soil moisture: ${moisture.toFixed(1)}%\n`;
    }

    userPrompt += `\nPlease give me a quick summary of how my farm is doing.`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini API Error:', errText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No advice generated.';
    
    return NextResponse.json({ summary });

  } catch (error) {
    console.error('Error fetching farmer advice:', error);
    return NextResponse.json(
      { error: 'Failed to generate advice. Please check your API key.' },
      { status: 500 }
    );
  }
}
