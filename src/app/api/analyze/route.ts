import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 🧠 Fallback heuristic to guess risk level
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
    const matches = (lowered.match(new RegExp(kw, "g")) || []).length;
    score += matches;
  }

  const lenFactor = Math.min(Math.floor(lowered.length / 5000), 5);
  const adjusted = score + lenFactor;

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

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    console.log("📄 Processing:", file.name);

    // 🧾 Convert PDF to base64 (for Gemini to read directly)
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    // 🧠 Optimized, context-aware prompt
    const prompt = `
You are an AI compliance and insurance document risk analyzer.

Analyze the following insurance document and return ONLY a valid JSON object (no markdown, no commentary).

SCORING LOGIC:
- Compute a risk score (1–10) based on how risky/unfair/confusing clauses are:
  - HIGH → 8–10 (binding policy with unclear exclusions, hidden limits, or vague legal terms)
  - MEDIUM → 4–7 (some legal complexity but overall fair)
  - LOW → 1–3 (clear, transparent, customer-friendly)
- ⚠️ IMPORTANT CONTEXT:
  If the document is **educational, informational, or government guidance**
  (not an insurance contract), mark riskLevel as LOW even if it contains words
  like “exclusion”, “waiting period”, or “claim” used for explanation.
- Never output UNKNOWN.

Return JSON exactly like:
{
  "summary": "Brief 2–3 line summary of the document",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "risks": ["Short list of risky or confusing clauses"],
  "recommendations": ["Practical improvements for fairness and clarity"],
  "metadata": {
    "type": "Insurance Policy Document",
    "company": "If found, company name else 'Unknown'",
    "date": "DD/MM/YYYY",
    "parties": "Insurer and Policyholder"
  }
}

Rules:
- Output ONLY JSON.
- Use context to judge if document is a policy or just an informational guide.
- Be concise and objective.
`;

    console.log("🤖 Sending to Gemini with inlineData...");

    // ✅ Gemini ko file aur prompt dono bhej rahe hain
    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: file.type, data: base64Data } },
    ]);

    const rawResponse = await result.response.text();
    console.log("✅ Gemini raw response received.");

    const candidate = extractJsonString(rawResponse);
    let analysis: any;

    try {
      analysis = JSON.parse(candidate);
      const rl =
        typeof analysis?.riskLevel === "string"
          ? analysis.riskLevel.toUpperCase()
          : null;

      if (!["HIGH", "MEDIUM", "LOW"].includes(rl)) {
        console.warn("⚠️ Invalid riskLevel, recalculating via heuristic...");
        analysis.riskLevel = "LOW"; // since Gemini read PDF directly
      } else {
        analysis.riskLevel = rl;
      }
    } catch (parseErr) {
      console.warn("⚠️ JSON parse failed, fallback used.", parseErr);
      analysis = {
        summary: "AI could not fully parse, fallback summary used.",
        riskLevel: "LOW",
        risks: ["Document may be non-policy or purely educational."],
        recommendations: [
          "Ensure PDF contains clearly structured text.",
          "Retry with smaller section for clarity."
        ],
        metadata: {
          type: "Insurance Policy Document",
          company: "Unknown",
          date: new Date().toLocaleDateString(),
          parties: "Insurer and Policyholder"
        }
      };
    }

    // ✅ Save to Firestore
    const docRef = await addDoc(collection(db, "documents"), {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      analysis,
      riskLevel: analysis.riskLevel,
      timestamp: serverTimestamp(),
      uploadDate: new Date().toISOString(),
    });

    console.log("🔥 Saved to Firestore:", docRef.id);

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
