import { GoogleGenAI, Type } from "@google/genai";
import { ScrapbookItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function tagItem(content: string, type: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this ${type} and provide 3-5 relevant tags for organization. 
    Content: ${content}
    Return ONLY a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text);
  } catch {
    return ["research", "idea"];
  }
}

export async function semanticSearch(query: string, items: ScrapbookItem[]): Promise<string[]> {
  const itemsSummary = items.map(i => ({ id: i.id, title: i.title, content: i.content, tags: i.tags }));
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `User is looking for: "${query}". 
    Based on these items: ${JSON.stringify(itemsSummary)}
    Return the IDs of the most relevant items in order of relevance.
    Return ONLY a JSON array of strings.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text);
  } catch {
    return [];
  }
}

export async function stickerifyImage(base64Image: string): Promise<{ path: string }> {
  // This is a creative way to "crop" - ask Gemini for a simplified SVG path of the main object
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/png", data: base64Image } },
        { text: "Identify the main object in this image and provide a simplified SVG polygon path (points only, e.g. '0,0 100,0 100,100 0,100') that tightly encloses it. This will be used as a CSS clip-path. Return ONLY the path string." }
      ]
    }
  });
  return { path: response.text?.trim() || "0,0 100,0 100,100 0,100" };
}
