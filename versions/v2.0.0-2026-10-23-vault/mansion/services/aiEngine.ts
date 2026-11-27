import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI with ADC (IAM service account)
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: 'us-central1'
});

const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

export interface PropertyRecord {
  address: string;
  structure_details: string;
}

export interface DistressScores {
  overgrowth: number;
  structuralDamage: number;
  overallDistressScore: number;
}

export async function generateOutreachAI(ownerName: string, address: string): Promise<string> {
  const prompt = `Write a professional, compassionate, and persuasive letter to property owner ${ownerName} regarding their property at ${address}. The tone should be helpful and indicate interest in potential acquisition options due to the property's current state.`;

  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const response = await result.response;
  return response.text() || 'Outreach generation failed.';
}

export async function analyzeVisualDistressAI(structureDetails: string): Promise<DistressScores> {
  const prompt = `Analyze the following property description for indicators of abandonment or distress: ${structureDetails}. Output a JSON object with scores (0-10) for 'overgrowth', 'structuralDamage', and 'overallDistressScore'.`;

  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] });
  const response = await result.response;
  const text = response.text() || '{}';
  return JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));
}
