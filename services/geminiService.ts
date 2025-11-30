import { AIAnalysis, AutomationRequest } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const getSystemPrompt = (req: AutomationRequest) => `
You are an expert Revit API Automation Engineer and Python Developer. 
Analyze the following automation request for Revit ${req.revitVersion} in Project "${req.projectName}".

REQUEST TITLE: ${req.title}
DESCRIPTION: ${req.description}

Your goal is to provide a JSON response with:
1. complexityScore: An integer 1-10.
2. suggestedNamespaces: A list of relevant Autodesk.Revit.DB namespaces.
3. implementationStrategy: A concise textual explanation of how to solve this.
4. pseudoCode: A pythonic pseudo-code snippet using the Revit API structure.
`;

export const analyzeRequestWithGemini = async (request: AutomationRequest): Promise<AIAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Prepare contents
  const parts: any[] = [{ text: getSystemPrompt(request) }];
  
  // Add images if present
  request.attachments.forEach(att => {
      if (att.type.startsWith('image/')) {
          // Remove base64 header if present for API
          const base64Data = att.data.split(',')[1]; 
          parts.push({
              inlineData: {
                  mimeType: att.type,
                  data: base64Data
              }
          });
      }
  });

  try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    complexityScore: { type: Type.INTEGER },
                    suggestedNamespaces: { 
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    },
                    implementationStrategy: { type: Type.STRING },
                    pseudoCode: { type: Type.STRING }
                },
                required: ["complexityScore", "suggestedNamespaces", "implementationStrategy", "pseudoCode"]
            }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");

      return JSON.parse(text) as AIAnalysis;
  } catch (error) {
      console.error("Gemini Error:", error);
      // Fallback mock if API fails/key invalid in demo
      return {
          complexityScore: 5,
          suggestedNamespaces: ["Autodesk.Revit.DB", "Autodesk.Revit.UI"],
          implementationStrategy: "Error connecting to AI. Please check API Key in .env file.",
          pseudoCode: "# AI Connection Failed\n# Please implement manually"
      };
  }
};