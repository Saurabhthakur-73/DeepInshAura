import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ✅ Same Groq client as analyze/route.ts
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function POST(request: NextRequest) {
  try {
    const { messages, documentContext } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const systemPrompt = documentContext
      ? `You are DeepInshAura AI — an expert insurance policy assistant. You have been given the following insurance document analysis to help answer user questions.

DOCUMENT CONTEXT:
${JSON.stringify(documentContext, null, 2)}

Your job:
- Answer questions about THIS specific document clearly and helpfully
- Explain risks, clauses, and recommendations in simple English
- If user asks about claims, guide them step by step
- Always be consumer-focused — protect the policyholder's interests
- Keep answers concise but complete
- Always respond in English only
- If something is not in the document, say so honestly`
      : `You are DeepInshAura AI — an expert insurance assistant. Help users understand insurance policies, claims processes, and document risks. Be helpful, clear, and consumer-focused. Always respond in English only.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.5,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content || "Sorry, I could not generate a response.";

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error("❌ Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500 }
    );
  }
}