import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, source = "en", target = "vi" } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Using Google Translate API (free endpoint)
    // Note: For production, consider using official Google Cloud Translation API
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Translation failed");
    }

    const data = await response.json();

    // Extract translated text from the response
    let translation = "";
    if (data && data[0]) {
      translation = data[0].map((item: any) => item[0]).join("");
    }

    return NextResponse.json({ translation });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: "Không thể dịch câu này" },
      { status: 500 }
    );
  }
}
