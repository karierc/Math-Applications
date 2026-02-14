
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getHint = async (
  step: string,
  equation: string,
  userValue: string,
  expectedDescription: string
): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The student is working on a quadratic equation: ${equation}. 
      They are currently on the step: "${step}". 
      The goal of this step is to: ${expectedDescription}.
      The student entered: "${userValue}", which is incorrect.
      Provide a helpful, encouraging hint for a secondary math student. 
      Do not give the answer directly. Keep it under 2 sentences.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text || "Try checking your calculations again!";
  } catch (error) {
    console.error("Gemini Hint Error:", error);
    return "Check your math and try again!";
  }
};
