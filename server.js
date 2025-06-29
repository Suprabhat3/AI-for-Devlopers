const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const port = 3000;

// Initialize OpenAI client for Gemini
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

app.use(express.json());

// System prompt for code review
const SYSTEM_PROMPT = `You are an expert code reviewer and algorithm analyst. Your task is to analyze code and provide detailed feedback.

For any code provided, analyze and return ONLY a valid JSON response with this exact structure:

{
  "timeComplexity": {
    "overall": "O(n)",
    "explanation": "Explain why this is the time complexity"
  },
  "spaceComplexity": {
    "overall": "O(1)",
    "explanation": "Explain the space usage"
  },
  "codeQuality": {
    "score": 7.5,
    "issues": ["List any code quality issues"],
    "suggestions": ["List improvement suggestions"]
  },
  "bugs": ["List any potential bugs or errors"],
  "security": ["List security concerns if any"],
  "performance": ["List performance optimization suggestions"],
  "readability": {
    "score": 8,
    "comments": "Comments about code readability"
  }
}

Rules:
- Return ONLY valid JSON, no additional text
- Provide realistic complexity analysis
- Be specific in explanations
- Score from 1-10 where 10 is perfect
- If no issues found, use empty arrays []`;

// Main code review endpoint
app.post('/review', async (req, res) => {
  try {
  const {code, language = "javascript"} = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Create the user prompt with the code
    const userPrompt = `Analyze this code:

\`\`\`${language}
${code}
\`\`\``;

    // Send to LLM
    const response = await openai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1500,
    });

    // Get the response content
    const reviewResult = response.choices[0].message.content.trim();
    
    // Parse JSON response
    let analysisData;
    try {
      analysisData = JSON.parse(reviewResult);
    } catch (parseError) {
      // Try to extract JSON if wrapped in other text
      const jsonMatch = reviewResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }

    // Send response
    res.json({
      success: true,
      analysis: analysisData,
      metadata: {
        language,
        timestamp: new Date().toISOString(),
        codeLength: code.length
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze code',
      details: error.message
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Code Review API running on http://localhost:${port}`);
  console.log('Send POST request to /review with { "code": "your code", "language": "javascript" }');
});

module.exports = app;