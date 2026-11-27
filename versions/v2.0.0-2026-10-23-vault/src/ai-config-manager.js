'use strict';
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const REVENUE_CONFIG_PATH = path.resolve(__dirname, '../revenue_streams_config.json');
const SETTLEMENT_CONFIG_PATH = path.resolve(__dirname, '../direct_settlement_config.json');

class AIConfigManager {
    async handleInstruction(userPrompt) {
        if (!OPENROUTER_KEY) {
            return { status: 'ERROR', message: 'OPENROUTER_API_KEY is not configured in .env.' };
        }

        try {
            const currentRevenueConfig = fs.readFileSync(REVENUE_CONFIG_PATH, 'utf8');
            const currentSettlementConfig = fs.readFileSync(SETTLEMENT_CONFIG_PATH, 'utf8');

            const systemPrompt = `You are the Chronos OS AI Configuration Manager. You manage JSON configuration files for a high-frequency 24/7 revenue and settlement system.
Current revenue_streams_config.json:
${currentRevenueConfig}

Current direct_settlement_config.json:
${currentSettlementConfig}

The user will give an instruction on how to modify the configuration.
Respond with a JSON object containing:
{
  "updatedRevenueConfig": { ... },
  "updatedSettlementConfig": { ... },
  "explanation": "Brief summary of what was updated"
}
Ensure the JSON is valid and preserves all required configuration schemas.`;

            // Call OpenRouter API
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://chronos.os',
                    'X-Title': 'Chronos OS AI Config Manager'
                },
                body: JSON.stringify({
                    model: 'anthropic/claude-3.5-sonnet', // or openrouter default
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            const data = await response.json();
            if (data.choices && data.choices[0] && data.choices[0].message) {
                const content = JSON.parse(data.choices[0].message.content);
                
                if (content.updatedRevenueConfig) {
                    fs.writeFileSync(REVENUE_CONFIG_PATH, JSON.stringify(content.updatedRevenueConfig, null, 2));
                }
                if (content.updatedSettlementConfig) {
                    fs.writeFileSync(SETTLEMENT_CONFIG_PATH, JSON.stringify(content.updatedSettlementConfig, null, 2));
                }

                return {
                    status: 'SUCCESS',
                    explanation: content.explanation || 'Configurations successfully updated by AI agent.',
                    updatedRevenueConfig: content.updatedRevenueConfig,
                    updatedSettlementConfig: content.updatedSettlementConfig
                };
            } else {
                return { status: 'ERROR', message: 'Invalid response from OpenRouter API.' };
            }
        } catch (err) {
            return { status: 'ERROR', message: err.message };
        }
    }
}

module.exports = new AIConfigManager();
