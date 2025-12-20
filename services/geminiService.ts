
import { GoogleGenAI } from "@google/genai";

export async function generateAIResponse(prompt: string, context: string): Promise<string> {
  try {
    // Initialisation au moment de l'appel pour garantir la fraîcheur de l'API KEY et la scalabilité des ressources
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}\n\nUser Question: ${prompt}`,
      config: {
        systemInstruction: "Tu es un assistant universitaire intelligent pour l'ESP de Dakar. Réponds de manière concise, polie et utile.",
        temperature: 0.7,
      },
    });

    return response.text || "Désolé, je n'ai pas pu générer de réponse.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Une erreur technique est survenue avec l'IA.";
  }
}
