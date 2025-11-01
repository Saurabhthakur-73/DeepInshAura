import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "documents"));
    const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    const reports = docs.map((doc: any) => ({
      id: doc.id,
      title: doc.fileName,
      description: doc.analysis?.summary || "No summary available.",
      severity:
        doc.riskLevel === "HIGH"
          ? "High"
          : doc.riskLevel === "MEDIUM"
          ? "Medium"
          : "Low",
      status: "Open",
      detectedAt: doc.uploadDate || new Date().toISOString(),
      document: {
        id: doc.id,
        name: doc.fileName,
        type: doc.fileType || "PDF",
      },
    }));

    return NextResponse.json({ success: true, reports });
  } catch (error: any) {
    console.error("❌ Failed to load reports:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
