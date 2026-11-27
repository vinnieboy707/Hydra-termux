const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateOutreachAI(ownerName, propertyDetails) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Write a professional, compassionate, and persuasive letter to property owner ${ownerName} regarding their property at ${propertyDetails}. The tone should be helpful and indicate interest in potential acquisition options due to the property's current state.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function analyzeVisualDistressAI(propertyDetails) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // In a real-world implementation, you would pass an image buffer here.
  // For now, this analyzes the description text for distress markers.
  const prompt = `Analyze the following property description for indicators of abandonment or distress: ${propertyDetails}. Output a JSON object with scores (0-10) for 'overgrowth', 'structuralDamage', and 'overallDistressScore'.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text().replace(/```json/g, '').replace(/```/g, ''));
}

module.exports = { generateOutreachAI, analyzeVisualDistressAI };
