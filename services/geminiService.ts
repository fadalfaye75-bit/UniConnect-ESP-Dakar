
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function generateAIResponse(prompt: string, context: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}\n\nUser Question: ${prompt}`,
      config: {
        systemInstruction: "Tu es un assistant universitaire intelligent pour l'ESP de Dakar. Réponds de manière concise, polie et utile. L'école s'appelle l'École Supérieure Polytechnique (ESP).",
        temperature: 0.7,
      },
    });

    return response.text || "Désolé, je n'ai pas pu générer de réponse pour le moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Une erreur est survenue lors de la communication avec l'IA.";
  }
}
