import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing VITE_GEMINI_API_KEY in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

// Schema matching Supabase 'recipes' table
export interface Recipe {
    title: string;
    description: string;
    time: string; // STRICT string, e.g. "20m"
    calories: number; // STRICT number
    difficulty: "Easy" | "Medium" | "Hard";
    ingredients: Array<{
        item: string;
        amount: string;
        unit: string;
    }>;
    instructions: string[]; // Added instructions as it's standard, though not explicitly requested in prompt, it's essential for a recipe.
    image_url?: string; // Optional, AI might extract a URL from text or we use the input image URL context elsewhere
}

export async function generateRecipeFromImage(
    imageFile: File | Blob,
    additionalContext?: string
): Promise<Recipe | null> {
    if (!API_KEY) {
        throw new Error("Gemini API Key not configured.");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
    You are an expert Chef and Data Scientist. Your task is to extract a structured recipe from the provided image(s).
    
    ## Output Schema (Strict JSON)
    The output must define a recipe matching this exact JSON structure (Supabase compatibility):
    {
      "title": "string",
      "description": "string (brief appetizing summary)",
      "time": "string (e.g., '20m', '1h 30m')", 
      "calories": number (integer),
      "difficulty": "Easy" | "Medium" | "Hard",
      "ingredients": [
        { "item": "string", "amount": "string", "unit": "string" }
      ],
      "instructions": ["string", "string", ...]
    }

    ## Data Integrity Rules
    1. **Time**: Must be a string. format: "XM" or "XH YM". precision: minutes.
    2. **Calories**: Must be a number. If unknown, estimate based on ingredients.
    3. **Ingredients**: Extract quantity, unit, and name separately.
    4. **Sources Priority**:
       - If the image contains text (Book, Recipe Card), prioritize that text largely (Prio 1).
       - If it's a screenshot of a website with a URL visible, prefer the text content (Prio 2).
       - If it's just a food photo, infer the recipe (Prio 3).
    
    ## Multi-Shot Ingestion
    If multiple images are provided, synthesize the information. 
    - Use the most detailed source for ingredients.
    - Use the most appetizing description.

    Return ONLY the raw JSON. No markdown formatting.
  `;

    try {
        const imageParts = await fileToGenerativePart(imageFile);

        const result = await model.generateContent([prompt, imageParts, additionalContext || ""]);
        const response = await result.response;
        const text = response.text();

        // Clean markdown if present
        const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return JSON.parse(cleanedText) as Recipe;
    } catch (error) {
        console.error("AI Recipe Generation Failed:", error);
        return null;
    }
}

async function fileToGenerativePart(file: File | Blob): Promise<{ inlineData: { data: string; mimeType: string } }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const base64Content = base64data.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Content,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
