
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export async function* generateAIResponseStream(prompt: string, context: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}\n\nUser Question: ${prompt}`,
      config: {
        systemInstruction: "Tu es un assistant universitaire intelligent pour l'ESP de Dakar. Réponds de manière concise, polie et utile en français. Utilise un ton encourageant.",
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      const part = chunk as GenerateContentResponse;
      yield part.text || "";
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    yield "Désolé, une erreur technique est survenue avec l'IA.";
  }
}
