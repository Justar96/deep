// Quick test of the real OpenAI Responses API
import { OpenAI } from 'openai'

async function testResponsesAPI() {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'test'
  })
  
  try {
    console.log('Testing Responses API...')
    
    const response = await client.responses.create({
      model: 'gpt-4o',
      input: 'Say hello in exactly 5 words.'
    })
    
    console.log('Success! Response:', {
      id: response.id,
      model: response.model,
      output: response.output?.slice(0, 1), // Just first item
      usage: response.usage
    })
    
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testResponsesAPI()