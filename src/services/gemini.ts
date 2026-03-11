import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { ScrapbookItem } from "../types";

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export async function tagItem(content: string, type: string): Promise<string[]> {
  if (!ai) return ["idea"]; // Return default tag if no AI
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this ${type} and provide 3-5 relevant tags for organization. 
      Content: ${content}
      Return ONLY a JSON array of strings.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (e) {
    console.warn("AI Tagging failed or key missing:", e);
    return ["idea"];
  }
}

export async function semanticSearch(query: string, items: ScrapbookItem[]): Promise<string[]> {
  if (!ai) {
    // Fallback to simple keyword search if no AI
    const q = query.toLowerCase();
    return items
      .filter(i => 
        i.title?.toLowerCase().includes(q) || 
        i.content?.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      )
      .map(i => i.id);
  }
  
  const itemsSummary = items.map(i => ({ id: i.id, title: i.title, content: i.content, tags: i.tags }));
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User is looking for: "${query}". 
      Based on these items: ${JSON.stringify(itemsSummary)}
      Return the IDs of the most relevant items in order of relevance.
      Return ONLY a JSON array of strings.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (e) {
    console.warn("AI Search failed or key missing:", e);
    return [];
  }
}

export async function stickerifyImage(base64Image: string): Promise<{ path: string }> {
  if (!ai) return { path: "0,0 100,0 100,100 0,100" }; // Return square path if no AI
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Image } },
          { text: "Identify the main object in this image and provide a simplified SVG polygon path (points only, e.g. '0,0 100,0 100,100 0,100') that tightly encloses it. This will be used as a CSS clip-path. Return ONLY the path string." }
        ]
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });
    return { path: response.text?.trim() || "0,0 100,0 100,100 0,100" };
  } catch (e) {
    console.warn("AI Stickerify failed or key missing:", e);
    return { path: "0,0 100,0 100,100 0,100" };
  }
}
