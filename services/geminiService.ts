
import { GoogleGenAI } from "@google/genai";

// Standard implementation following @google/genai guidelines
export const generateAIResponse = async (prompt: string, context?: string): Promise<string> => {
  // Always use process.env.API_KEY directly and initialize inside the call for fresh state
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const fullPrompt = `
      Tu es un assistant universitaire intelligent intégré à la plateforme 'UniConnect'.
      Ton rôle est d'aider les étudiants à s'organiser et à comprendre leurs cours.
      Réponds de manière concise, polie et utile en français.
      
      Contexte actuel de l'utilisateur (si disponible): ${context || 'Aucun'}

      Question de l'utilisateur: ${prompt}
    `;

    // Use gemini-3-flash-preview for general text tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fullPrompt,
    });

    // Directly access the .text property from GenerateContentResponse
    return response.text || "Désolé, je n'ai pas pu générer une réponse.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Une erreur est survenue lors de la communication avec l'assistant.";
  }
};
