import { NextRequest, NextResponse } from "next/server";

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: Array<{
    text?: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
    }>;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const word = searchParams.get("word");

    if (!word) {
      return NextResponse.json(
        { error: "Từ cần tra là bắt buộc" },
        { status: 400 }
      );
    }

    // Fetch from Free Dictionary API
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Không tìm thấy nghĩa của từ này" },
        { status: 404 }
      );
    }

    const data: DictionaryEntry[] = await response.json();

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy nghĩa của từ này" },
        { status: 404 }
      );
    }

    const entry = data[0];

    // Extract first definition
    const firstMeaning = entry.meanings[0];
    const firstDefinition = firstMeaning?.definitions[0];

    return NextResponse.json({
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics.find((p) => p.text)?.text,
      audio: entry.phonetics.find((p) => p.audio)?.audio,
      partOfSpeech: firstMeaning?.partOfSpeech,
      definition: firstDefinition?.definition,
      example: firstDefinition?.example,
      meanings: entry.meanings.map((m) => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions.slice(0, 3).map((d) => d.definition),
      })),
    });
  } catch (error) {
    console.error("Dictionary lookup error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tra từ điển" },
      { status: 500 }
    );
  }
}
