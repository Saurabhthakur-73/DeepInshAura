import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import OpenAI from "openai";

// ✅ Groq client
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

// 🧠 Fallback heuristic
function heuristicRiskFromText(text: string) {
  const lowered = text.toLowerCase();
  const keywords = [
    "exclude", "exclusion", "not cover", "not covered", "waiting period",
    "pre-existing", "pre existing", "claim", "deny", "denied", "terminate",
    "cancel", "fraud", "no cover", "not liable", "limit", "sub-limit",
    "co-pay", "copay"
  ];
  let score = 0;
  for (const kw of keywords) {
    score += (lowered.match(new RegExp(kw, "g")) || []).length;
  }
  const adjusted = score + Math.min(Math.floor(lowered.length / 5000), 5);
  if (adjusted >= 7) return "HIGH";
  if (adjusted >= 3) return "MEDIUM";
  return "LOW";
}

// 🧹 Extract JSON safely
function extractJsonString(raw: string) {
  if (!raw) return raw;
  let s = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

// 🚀 Main API route
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string | null; // ✅ userId receive karo

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!userId)
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });

    console.log("📄 Processing:", file.name, "for user:", userId);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse/lib/pdf-parse.js");
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || "";
      console.log("✅ PDF text extracted, length:", extractedText.length);
    } catch (pdfErr) {
      console.warn("⚠️ PDF parse failed:", pdfErr);
      extractedText = "";
    }

    const trimmedText = extractedText.slice(0, 12000);

    const prompt = `You are an expert AI legal and insurance document risk analyzer with deep knowledge of insurance law, consumer rights, and policy compliance.

Analyze the following insurance document thoroughly and return ONLY a valid JSON object (no markdown, no commentary).

RISK LEVEL SCORING (be strict and detailed):
- HIGH (score 7-10): 
  * Broad exclusion clauses that deny common claims
  * Vague or ambiguous language that favors insurer
  * Hidden sub-limits that drastically reduce coverage
  * Unfair claim denial conditions
  * Excessive waiting periods (>6 months)
  * Unilateral policy cancellation rights for insurer
  * Pre-existing condition exclusions that are overly broad
  * Clauses that shift burden of proof heavily to policyholder

- MEDIUM (score 4-6):
  * Some exclusions but reasonable and clearly stated
  * Moderate waiting periods (2-6 months)
  * Standard claim documentation requirements
  * Some legal complexity but generally fair
  * Limited coverage for certain conditions

- LOW (score 1-3):
  * Clear, transparent language
  * Fair exclusions with proper justification
  * Reasonable claim process
  * Strong consumer protections
  * Educational or informational document (not a contract)

ANALYSIS REQUIREMENTS:
- Identify EVERY risky clause, hidden condition, or unfair term
- Give at least 5-8 specific risks if document is HIGH/MEDIUM risk
- Give at least 5-8 actionable recommendations
- Quote specific clause types when possible
- Be consumer-focused — flag anything that could hurt the policyholder

Return JSON exactly like this:
{
  "summary": "Detailed 3-4 line summary covering document type, main coverage, key concerns, and overall fairness assessment",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "riskScore": <number 1-10>,
  "risks": [
    "Specific risk 1 with explanation of how it harms policyholder",
    "Specific risk 2 with explanation",
    "Specific risk 3 with explanation",
    "Specific risk 4 with explanation",
    "Specific risk 5 with explanation",
    "Add more if found..."
  ],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2", 
    "Specific actionable recommendation 3",
    "Specific actionable recommendation 4",
    "Specific actionable recommendation 5",
    "Add more if needed..."
  ],
  "keyFindings": [
    "Most important finding 1",
    "Most important finding 2",
    "Most important finding 3"
  ],
  "metadata": {
    "type": "Type of insurance document",
    "company": "Company name if found, else 'Unknown'",
    "date": "DD/MM/YYYY if found, else 'Unknown'",
    "parties": "Insurer and Policyholder names if found"
  }
}

Rules:
- Output ONLY valid JSON, no extra text.
- Be thorough — a shallow analysis helps no one.
- Always think from the POLICYHOLDER's perspective.
- If document text is too short or unclear, still give best possible analysis.
- Never return empty arrays for risks or recommendations.

DOCUMENT TEXT:
${trimmedText || "No text could be extracted from this document."}`;

    console.log("🤖 Sending to Groq...");

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const rawResponse = completion.choices[0]?.message?.content || "";
    console.log("✅ Groq response received.");

    const candidate = extractJsonString(rawResponse);
    let analysis: any;

    try {
      analysis = JSON.parse(candidate);
      const rl = typeof analysis?.riskLevel === "string"
        ? analysis.riskLevel.toUpperCase()
        : null;

      if (!["HIGH", "MEDIUM", "LOW"].includes(rl)) {
        console.warn("⚠️ Invalid riskLevel, using heuristic...");
        analysis.riskLevel = heuristicRiskFromText(trimmedText);
      } else {
        analysis.riskLevel = rl;
      }
    } catch (parseErr) {
      console.warn("⚠️ JSON parse failed, fallback used.", parseErr);
      analysis = {
        summary: "AI could not fully parse the document.",
        riskLevel: heuristicRiskFromText(trimmedText),
        risks: ["Document may be non-policy or purely educational."],
        recommendations: [
          "Ensure PDF contains clearly structured text.",
          "Retry with smaller section for clarity.",
        ],
        metadata: {
          type: "Insurance Policy Document",
          company: "Unknown",
          date: new Date().toLocaleDateString(),
          parties: "Insurer and Policyholder",
        },
      };
    }

    // ✅ Save to Firestore WITH userId
    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      analysis,
      riskLevel: analysis.riskLevel,
      userId, // ✅ user ka document
      timestamp: serverTimestamp(),
      uploadDate: new Date().toISOString(),
    });

    console.log("🔥 Saved to Firestore:", docRef.id, "userId:", userId);

    return NextResponse.json({
      success: true,
      documentId: docRef.id,
      fileName: file.name,
      riskLevel: analysis.riskLevel,
      analysis,
    });

  } catch (error: any) {
    console.error("❌ AI Analysis Error:", error);
    return NextResponse.json(
      { error: error.message || "AI analysis failed" },
      { status: 500 }
    );
  }
}